import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, Logger } from '@nestjs/common';
import {
  overdueFixture,
  overdueNow as now,
  overdueDay as day,
  overdueInstant as instant,
} from './helpers/overdue-fixture.js';
import { LoanOverdueSynchronizer } from '../src/modules/loans/infrastructure/loan-overdue-synchronizer.js';
import { PrismaUserRepository } from '../src/modules/users/infrastructure/persistence/prisma/prisma-user.repository.js';
import { extendEpisodeCalendar } from '../src/modules/rules/domain/episode-calendar.js';
import { instantToDate } from '../src/shared/infrastructure/prisma/instant-to-date.js';

const electronics = '123e4567-e89b-42d3-a456-426614174098';
function setup() {
  const result = overdueFixture();
  const { db } = result;
  for (const version of db.rows('versiones_regla')) {
    const metadata = JSON.parse(version.descripcion);
    if (metadata.category === 'DEPORTES') {
      metadata.categoryId = 'sports-category';
      version.descripcion = JSON.stringify(metadata);
    }
  }
  // No se inicia ningún cliente: préstamos futuros y publicación sintética.
  db.rows('prestamos')[0]!.fechaFin = instant(new Date(now.getTime() + day));
  const policy = db
    .rows('versiones_regla')
    .find((r) => JSON.parse(r.descripcion).key === 'R-RES:LEVE')!;
  db.rows('reservas')[0]!.configurationSnapshot = {
    reservationNoShow: {
      termsVersionId: db.rows('versiones_terminos')[0]!.id,
      ruleVersionId: policy.id,
    },
  };
  return result;
}
const createData = () => ({
  userId: 'user',
  copyId: 'new-copy',
  enforceSingleOpenOperation: false,
  requestedAt: new Date(now.getTime() + 60_000),
  loanDurationHours: 8,
});

describe('regresiones de revisión independiente: solo dobles offline, no PostgreSQL', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(['create', 'pickup'] as const)(
    'confianza cero tras levantamiento indefinido deniega %s y cancela sin no-show',
    async (operation) => {
      const { db, reservations, prisma } = setup();
      db.rows('usuarios')[0]!.confianza = '0.00';
      await prisma.client.runtime().query(
        prisma.sql.public.sanciones
          .insert([
            {
              id: 'materially-lifted',
              usuarioId: 'user',
              estado: 'FINALIZADA',
              confianzaAnterior: '80.00',
              confianzaPosterior: '0.00',
              fechaInicio: instant(new Date(now.getTime() - 2 * day)),
              fechaFin: instant(new Date(now.getTime() - day)),
            },
          ])
          .build(),
      );
      await expect(
        operation === 'create'
          ? reservations.create(createData())
          : reservations.pickup('reservation', now),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
      expect(db.rows('incumplimientos')).toHaveLength(0);
      expect(db.rows('usuarios')[0]!.confianza).toBe('0.00');
      expect(
        (await new PrismaUserRepository(prisma).getLoanEligibility('user'))
          .enabled,
      ).toBe(false);
      expect(db.rows('prestamos')).toHaveLength(1);
    },
  );

  it.each(['create', 'pickup'] as const)(
    'observación no opera electrónicos: %s usa categoría persistida',
    async (operation) => {
      const { db, reservations } = setup();
      db.rows('usuarios')[0]!.confianza = '40.00';
      db.rows('recursos')[0]!.categoriaId = electronics;
      db.rows('categorias_recurso').push({ id: electronics, activo: true });
      await expect(
        operation === 'create'
          ? reservations.create(createData())
          : reservations.pickup('reservation', now),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
      expect(db.rows('prestamos')).toHaveLength(1);
    },
  );

  it('una restricción de confianza cancela solo electrónicos y conserva libros y préstamo activo', async () => {
    const { db, synchronizer } = setup();
    db.rows('usuarios')[0]!.confianza = '40.00';
    db.rows('recursos').push({
      id: 'electronic-resource',
      categoriaId: electronics,
      activo: true,
    });
    db.rows('categorias_recurso').push({ id: electronics, activo: true });
    db.rows('ejemplares').push({
      id: 'electronic-copy',
      recursoId: 'electronic-resource',
      estado: 'RESERVADO',
      condicionFisica: 'APTO',
      habilitado: true,
    });
    db.rows('reservas').push({
      ...db.rows('reservas')[0],
      id: 'electronic-reservation',
      ejemplarId: 'electronic-copy',
    });
    await synchronizer.synchronizeUser('user');
    expect(db.rows('reservas').map((r) => r.estado)).toEqual([
      'CONFIRMADA',
      'CANCELADA',
    ]);
    expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
    expect(db.rows('incumplimientos')).toHaveLength(0);
  });

  it('saldo posterior a sync bajo lock, no el saldo previo, decide la categoría', async () => {
    const { db, reservations, synchronizer } = setup();
    db.rows('usuarios')[0]!.confianza = '55.00';
    db.rows('recursos')[0]!.categoriaId = electronics;
    db.rows('categorias_recurso').push({ id: electronics, activo: true });
    const sync = synchronizer.synchronizeUser.bind(synchronizer);
    vi.spyOn(
      LoanOverdueSynchronizer.prototype,
      'synchronizeUser',
    ).mockImplementation(async (id) => {
      await sync(id);
      // Se cruza mora LIBROS después de la fase confirmada; 55 -> 35.
      db.rows('prestamos')[0]!.fechaInicio = instant(
        new Date(now.getTime() - 101 * day),
      );
      db.rows('prestamos')[0]!.fechaFin = instant(
        new Date(now.getTime() - 100 * day),
      );
    });
    await expect(reservations.create(createData())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.rows('usuarios')[0]!.confianza).toBe('35.00');
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
    expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
  });

  it.each(['create', 'pickup'] as const)(
    'publicación B tras aceptación A deniega %s dentro de protección y conserva mora',
    async (operation) => {
      const { db, reservations, synchronizer } = setup();
      db.rows('prestamos')[0]!.fechaInicio = instant(
        new Date(now.getTime() - 101 * day),
      );
      db.rows('prestamos')[0]!.fechaFin = instant(
        new Date(now.getTime() - 100 * day),
      );
      const sync = synchronizer.synchronizeUser.bind(synchronizer);
      vi.spyOn(
        LoanOverdueSynchronizer.prototype,
        'synchronizeUser',
      ).mockImplementation(async (id) => {
        await sync(id);
        db.rows('versiones_terminos').push({
          ...db.rows('versiones_terminos')[0],
          id: 'terms-B',
          numero: 2,
        });
      });
      await expect(
        operation === 'create'
          ? reservations.create(createData())
          : reservations.pickup('reservation', now),
      ).rejects.toThrow('términos vigentes');
      expect(db.rows('usuarios')[0]!.confianza).toBe('60.00');
      expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
      expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
      const acceptance = db.calls.findIndex(
        (p) => p.table === 'aceptaciones_terminos',
      );
      expect(
        db.calls
          .slice(0, acceptance)
          .some(
            (p) =>
              p.text?.includes('public.versiones_terminos') &&
              p.text.includes('IN SHARE MODE NOWAIT'),
          ),
      ).toBe(true);
    },
  );

  it.each(['pickup', 'cancel'] as const)(
    'esperar reserva/copia hasta después del límite no permite %s con hora antigua',
    async (operation) => {
      for (const table of ['reservas', 'ejemplares']) {
        vi.setSystemTime(now);
        const { db, reservations } = setup();
        const runtime = db.client.runtime(),
          query = runtime.query.bind(runtime);
        const spy = vi
          .spyOn(runtime, 'query')
          .mockImplementation(async (plan) => {
            if (
              plan.table === table &&
              plan.operation === 'update' &&
              !Array.isArray(plan.data) &&
              plan.data?.id
            )
              vi.setSystemTime(new Date(now.getTime() + 60_001));
            return query(plan);
          });
        await expect(
          operation === 'pickup'
            ? reservations.pickup('reservation', now)
            : reservations.cancel({
                reservationId: 'reservation',
                cancelledAt: now,
              }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(db.rows('reservas')[0]!.estado).toBe('VENCIDA');
        expect(db.rows('prestamos')).toHaveLength(1);
        expect(db.rows('incumplimientos')).toHaveLength(1);
        spy.mockRestore();
      }
    },
  );

  it.each(['cancel', 'expire'] as const)(
    'liberación %s retiene no disponible sin reparar/habilitar ni tocar activo',
    async (operation) => {
      for (const reason of [
        'condition',
        'disabled',
        'resource',
        'category',
        'commitment',
        'active-copy',
      ]) {
        vi.setSystemTime(now);
        const { db, reservations } = setup();
        const copy = db.rows('ejemplares')[1]!;
        if (reason === 'condition') copy.condicionFisica = 'DANADO';
        if (reason === 'disabled') copy.habilitado = false;
        if (reason === 'resource') db.rows('recursos')[0]!.activo = false;
        if (reason === 'category')
          db.rows('categorias_recurso')[0]!.activo = false;
        if (reason === 'commitment')
          db.rows('reservas').push({
            ...db.rows('reservas')[0],
            id: 'other',
            usuarioId: 'other',
          });
        if (reason === 'active-copy') copy.estado = 'PRESTADO';
        if (operation === 'expire') {
          db.rows('reservas')[0]!.fechaLimiteRecogida = instant(
            new Date(now.getTime() - 1),
          );
          await reservations.expire(now);
        } else
          await reservations.cancel({
            reservationId: 'reservation',
            cancelledAt: now,
          });
        expect(db.rows('ejemplares')[1]!.estado).toBe(
          reason === 'active-copy' ? 'PRESTADO' : 'NO_DISPONIBLE',
        );
        expect(db.rows('ejemplares')[1]!.condicionFisica).toBe(
          reason === 'condition' ? 'DANADO' : 'APTO',
        );
        expect(db.rows('ejemplares')[1]!.habilitado).toBe(
          reason !== 'disabled',
        );
        expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
      }
    },
  );

  it('un préstamo de política irresoluble no impide vencer ni crear reservas de otro usuario', async () => {
    const { db, reservations } = setup();
    const reserved = {
      ...db.rows('reservas')[0]!,
      fechaLimiteRecogida: instant(new Date(now.getTime() - 1)),
    };
    db.rows('prestamos')[0]!.configurationSnapshot = {
      loanPolicy: { termsVersionId: 'missing', categoryId: 'category' },
    };
    db.rows('prestamos')[0]!.fechaFin = instant(new Date(now.getTime() - day));
    db.rows('usuarios').push({ ...db.rows('usuarios')[0], id: 'healthy' });
    db.rows('ejemplares').push({
      ...db.rows('ejemplares')[1],
      id: 'healthy-copy',
    });
    db.rows('reservas')[0] = { ...reserved, id: 'a-invalid' };
    db.rows('reservas').push({
      ...reserved,
      id: 'z-healthy',
      usuarioId: 'healthy',
      ejemplarId: 'healthy-copy',
    });
    db.rows('aceptaciones_terminos').push({
      ...db.rows('aceptaciones_terminos')[0],
      id: 'accept-healthy',
      usuarioId: 'healthy',
    });
    expect((await reservations.expire(now)).map((r) => r.id)).toEqual([
      'z-healthy',
    ]);
    expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
    expect(db.rows('incumplimientos')).toHaveLength(1);
    const copyId = '123e4567-e89b-42d3-a456-426614174077';
    db.rows('ejemplares')[2]!.id = copyId;
    const resourceId = '123e4567-e89b-42d3-a456-426614174076';
    db.rows('recursos')[0]!.id = resourceId;
    for (const copy of db.rows('ejemplares')) copy.recursoId = resourceId;
    const categoryId = '123e4567-e89b-42d3-a456-426614174075';
    db.rows('recursos')[0]!.categoriaId = categoryId;
    Object.assign(db.rows('categorias_recurso')[0]!, {
      id: categoryId,
      tiempoMaximoPrestamoDias: 14,
    });
    for (const version of db.rows('versiones_regla')) {
      const metadata = JSON.parse(version.descripcion);
      if (metadata.categoryId === 'category') {
        metadata.categoryId = categoryId;
        version.descripcion = JSON.stringify(metadata);
      }
    }
    await expect(
      reservations.create({ ...createData(), userId: 'healthy', copyId }),
    ).resolves.toMatchObject({ status: 'CONFIRMADA' });
    const firstWrite = db.calls.findIndex((p) => p.operation === 'update');
    expect(
      db.calls
        .slice(0, firstWrite)
        .some((p) => p.text?.includes('SHARE ROW EXCLUSIVE MODE NOWAIT')),
    ).toBe(true);
  });

  it('cursor atraviesa más de un lote fallido, límite 100 unidades, retries acotados y vuelta posterior', async () => {
    const { db, reservations } = setup();
    const original = db.rows('reservas')[0]!;
    original.fechaLimiteRecogida = instant(new Date(now.getTime() - 1));
    original.id = 'invalid-000';
    original.configurationSnapshot = {
      reservationNoShow: {
        termsVersionId: 'missing',
        ruleVersionId: 'missing',
      },
    };
    for (let n = 1; n < 101; n++)
      db.rows('reservas').push({
        ...original,
        id: `invalid-${String(n).padStart(3, '0')}`,
      });
    db.rows('ejemplares').push({
      ...db.rows('ejemplares')[1],
      id: 'healthy-copy',
    });
    db.rows('reservas').push({
      ...original,
      id: 'z-healthy',
      ejemplarId: 'healthy-copy',
      configurationSnapshot: null,
      createdAt: instant(new Date('2026-11-02T00:00:00Z')),
    });
    expect(await reservations.expire(now)).toEqual([]);
    const claims = () =>
      db.calls.filter(
        (p) =>
          p.table === 'reservas' &&
          p.operation === 'update' &&
          !Array.isArray(p.data) &&
          p.data?.estado === 'VENCIDA',
      );
    expect(claims()).toHaveLength(200);
    expect(db.rows('incumplimientos')).toHaveLength(0);
    expect((await reservations.expire(now)).map((r) => r.id)).toEqual([
      'z-healthy',
    ]);
    expect(db.rows('incumplimientos')).toHaveLength(1);
    expect(
      db.rows('reservas').filter((r) => r.estado === 'CONFIRMADA'),
    ).toHaveLength(101);
    const before = claims().length;
    await reservations.expire(now);
    expect(claims().length - before).toBe(200);
  });

  it('baja permite cierre por incidencia y finalizado, no ACTIVO ni PLANIFICADO', async () => {
    for (const status of [
      'CERRADO_POR_INCIDENCIA',
      'FINALIZADO',
      'ACTIVO',
      'PLANIFICADO',
    ]) {
      const { db, prisma } = setup();
      db.rows('prestamos')[0]!.estado = status;
      db.rows('reservas')[0]!.estado = 'RECOGIDA';
      const change = new PrismaUserRepository(prisma).updateAffiliationStatus(
        'user',
        false,
      );
      if (['ACTIVO', 'PLANIFICADO'].includes(status))
        await expect(change).rejects.toBeInstanceOf(ConflictException);
      else
        await expect(change).resolves.toMatchObject({
          hasCurrentAffiliation: false,
        });
      expect(
        db.calls.some((p) =>
          ['cuentas_acceso', 'solicitudes_registro'].includes(p.table),
        ),
      ).toBe(false);
    }
  });

  it('mora detectada 100 días tarde no se encola tras falta reciente independiente', async () => {
    const { db, synchronizer, prisma } = setup();
    db.rows('prestamos')[0]!.fechaInicio = instant(
      new Date(now.getTime() - 101 * day),
    );
    db.rows('prestamos')[0]!.fechaFin = instant(
      new Date(now.getTime() - 100 * day),
    );
    await prisma.client
      .runtime()
      .query(
        prisma.sql.public.incumplimientos
          .insert([
            {
              id: 'recent-fact',
              usuarioId: 'user',
              reglaId: 'recent-rule',
              versionReglaId: 'recent-version',
              penalizacionAplicada: '2.00',
              fecha: instant(new Date(now.getTime() - day)),
            },
          ])
          .build(),
      );
    await prisma.client
      .runtime()
      .query(
        prisma.sql.public.sanciones
          .insert([
            {
              id: 'recent',
              usuarioId: 'user',
              incumplimientoId: 'recent-fact',
              estado: 'ACTIVA',
              confianzaAnterior: '82.00',
              confianzaPosterior: '80.00',
              fechaInicio: instant(new Date(now.getTime() - day)),
              fechaFin: instant(new Date(now.getTime() + 6 * day)),
            },
          ])
          .build(),
      );
    await synchronizer.synchronizeUser('user');
    const mora = db.rows('sanciones').find((s) => s.id !== 'recent')!;
    expect(mora.estado).toBe('FINALIZADA');
    expect(instantToDate(mora.fechaFin).getTime()).toBeLessThan(
      now.getTime() - 60 * day,
    );
    expect(instantToDate(db.rows('sanciones')[0]!.fechaFin)).toEqual(
      new Date(now.getTime() + 6 * day),
    );
    expect(
      db.rows('ajustes_incumplimiento').map((a) => a.incrementoDias),
    ).toEqual([7, 7, 16]);
  });

  it('inserción histórica respeta antecedentes ocurridos y desplaza posteriores que solapan, no el hueco reciente', () => {
    const date = (n: number) => new Date(now.getTime() + n * day);
    const result = extendEpisodeCalendar(
      [
        {
          id: 'previous',
          status: 'FINALIZADA',
          effectiveAt: date(-101),
          startsAt: date(-101),
          endsAt: date(-94),
        },
        {
          id: 'following',
          status: 'FINALIZADA',
          effectiveAt: date(-95),
          startsAt: date(-94),
          endsAt: date(-87),
        },
        {
          id: 'recent',
          status: 'ACTIVA',
          effectiveAt: date(-1),
          startsAt: date(-1),
          endsAt: date(6),
        },
      ],
      'late',
      30,
      date(-100),
      now,
    );
    expect(result.find((r) => r.id === 'late')).toMatchObject({
      startsAt: date(-94),
      endsAt: date(-64),
      status: 'FINALIZADA',
    });
    expect(result.find((r) => r.id === 'following')).toMatchObject({
      startsAt: date(-64),
      endsAt: date(-57),
      status: 'FINALIZADA',
    });
    expect(result.find((r) => r.id === 'recent')!.startsAt).toEqual(date(-1));
  });

  it('un tramo finalizado desplazado al presente se recalcula activo, no queda falsamente cumplido', () => {
    const date = (n: number) => new Date(now.getTime() + n * day);
    const result = extendEpisodeCalendar(
      [
        {
          id: 'old',
          status: 'FINALIZADA',
          effectiveAt: date(-10),
          startsAt: date(-10),
          endsAt: date(-3),
        },
        {
          id: 'next',
          status: 'FINALIZADA',
          effectiveAt: date(-9),
          startsAt: date(-3),
          endsAt: date(-1),
        },
      ],
      'old',
      5,
      date(-8),
      now,
    );
    expect(result.find((r) => r.id === 'old')).toMatchObject({
      status: 'ACTIVA',
      endsAt: date(2),
    });
    expect(result.find((r) => r.id === 'next')).toMatchObject({
      status: 'PROGRAMADA',
      startsAt: date(2),
      endsAt: date(4),
    });
  });

  it.each(['inventory', 'publication'])(
    'contención de %s falla antes de escribir cualquier fila',
    async (phase) => {
      const { db, reservations } = setup();
      const runtime = db.client.runtime(),
        query = runtime.query.bind(runtime);
      vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
        if (
          plan.operation === 'lock' &&
          plan.text?.includes(
            phase === 'inventory' ? 'SHARE ROW EXCLUSIVE' : 'IN SHARE MODE',
          )
        )
          throw Object.assign(new Error('simulated lock contention'), {
            code: '55P03',
          });
        return query(plan);
      });
      await expect(reservations.create(createData())).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(
        db.calls.some((p) =>
          ['insert', 'update', 'delete'].includes(p.operation),
        ),
      ).toBe(false);
      expect(db.rows('usuarios')[0]!.confianza).toBe('80.00');
    },
  );
});
