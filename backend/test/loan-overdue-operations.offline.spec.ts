import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import {
  overdueFixture,
  overdueNow,
  overdueDay,
  overdueInstant,
} from './helpers/overdue-fixture.js';
import { LoanOverdueSynchronizer } from '../src/modules/loans/infrastructure/loan-overdue-synchronizer.js';
import * as configuration from '../src/modules/loans/infrastructure/integration/capture-loan-configuration.js';
import { UsersLoanEligibilityAdapter } from '../src/modules/loans/infrastructure/integration/users-loan-eligibility.adapter.js';
import type { GetUserLoanEligibilityUseCase } from '../src/modules/users/application/use-cases/get-user-loan-eligibility.use-case.js';

describe('reevaluación antes de reservar/recoger/vencer, dobles sin garantías PostgreSQL', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(overdueNow);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const createData = (enforceSingleOpenOperation = false) => ({
    userId: 'user',
    copyId: 'new-copy',
    enforceSingleOpenOperation,
    requestedAt: new Date(overdueNow.getTime() + 3_600_000),
    loanDurationHours: 8,
  });

  function manyLoans(db: ReturnType<typeof overdueFixture>['db'], total = 102) {
    const first = db.rows('prestamos')[0]!;
    const copy = db.rows('ejemplares')[0]!;
    for (let n = 1; n < total; n++) {
      const id = `extra-${String(n).padStart(4, '0')}`;
      db.rows('prestamos').push({ ...first, id, ejemplarId: `${id}-copy` });
      db.rows('ejemplares').push({ ...copy, id: `${id}-copy` });
    }
  }

  async function settledLoans(absolved: boolean) {
    const fixture = overdueFixture();
    const { db, synchronizer } = fixture;
    // Semilla sintética persistida de un episodio, no un mock de elegibilidad.
    if (absolved)
      db.rows('prestamos')[0]!.fechaFin = overdueInstant(
        new Date(overdueNow.getTime() - 1),
      );
    await synchronizer.synchronizeUser('user');
    if (absolved) {
      db.rows('sanciones')[0]!.estado = 'ABSUELTA';
      db.rows('prestamos')[0]!.fechaFin = overdueInstant(
        new Date(overdueNow.getTime() - 4 * overdueDay),
      );
    } else {
      db.rows('sanciones')[0]!.estado = 'CUMPLIDA';
      db.rows('sanciones')[0]!.fechaInicio = overdueInstant(
        new Date(overdueNow.getTime() - 2 * overdueDay),
      );
      db.rows('sanciones')[0]!.fechaFin = overdueInstant(
        new Date(overdueNow.getTime() - overdueDay),
      );
    }
    manyLoans(db);
    const episode = db.rows('incumplimientos')[0]!;
    const sanction = db.rows('sanciones')[0]!;
    const adjustments = [...db.rows('ajustes_incumplimiento')];
    for (const loan of db.rows('prestamos').slice(1)) {
      const id = `episode-${loan.id}`;
      db.rows('incumplimientos').push({ ...episode, id, prestamoId: loan.id });
      db.rows('sanciones').push({
        ...sanction,
        id: `sanction-${loan.id}`,
        incumplimientoId: id,
      });
      for (const adjustment of adjustments)
        db.rows('ajustes_incumplimiento').push({
          ...adjustment,
          id: `${adjustment.id}-${loan.id}`,
          incumplimientoId: id,
        });
    }
    // Representa confianza suficiente tras reparación/resolución previa.
    db.rows('usuarios')[0]!.confianza = '80.00';
    db.rows('reservas')[0]!.estado = 'CONFIRMADA';
    db.rows('ejemplares')[1]!.estado = 'RESERVADO';
    db.calls.length = 0;
    return fixture;
  }

  it.each(['create', 'pickup'] as const)(
    'moroso no puede %s sin job y la denegación conserva ajustes/cancelación',
    async (operation) => {
      const { db, reservations } = overdueFixture();
      const promise =
        operation === 'create'
          ? reservations.create(createData())
          : reservations.pickup('reservation', overdueNow);
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
      expect(db.rows('usuarios')[0]!.confianza).toBe('60.00');
      expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
      expect(db.rows('prestamos')).toHaveLength(1);
      expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
      expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
      expect(db.rows('incumplimientos').every((r) => r.origen === 'MORA')).toBe(
        true,
      );
      expect(
        db
          .rows('auditorias_usuario')
          .find((r) => r.accion === 'RESERVAS_CANCELADAS_POR_SANCION'),
      ).toBeDefined();
    },
  );

  it('sincroniza antes de consultar elegibilidad externa, aunque ésta rechace temprano', async () => {
    const { db, synchronizer } = overdueFixture();
    const execute = vi.fn(async () => {
      expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
      return { enabled: false } as never;
    });
    const adapter = new UsersLoanEligibilityAdapter(
      { execute } as unknown as GetUserLoanEligibilityUseCase,
      synchronizer,
    );
    expect(await adapter.getByUserId('user')).toEqual({ enabled: false });
    expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
  });

  it.each(['create', 'pickup', 'expiry'] as const)(
    'carrera lógica: mora aparece entre fases de %s; confirma consecuencias antes de denegar',
    async (operation) => {
      const { db, reservations, synchronizer } = overdueFixture();
      const due = db.rows('prestamos')[0]!.fechaFin;
      db.rows('prestamos')[0]!.fechaFin = overdueInstant(
        new Date(overdueNow.getTime() + overdueDay),
      );
      if (operation === 'expiry')
        db.rows('reservas')[0]!.fechaLimiteRecogida = overdueInstant(
          new Date(overdueNow.getTime() - 1),
        );
      const original = synchronizer.synchronizeUser.bind(synchronizer);
      let crossed = false;
      vi.spyOn(
        LoanOverdueSynchronizer.prototype,
        'synchronizeUser',
      ).mockImplementation(async (userId) => {
        await original(userId);
        if (!crossed) {
          db.rows('prestamos')[0]!.fechaFin = due;
          crossed = true;
        }
      });
      if (operation === 'expiry') {
        expect(await reservations.expire(overdueNow)).toEqual([]);
      } else {
        await expect(
          operation === 'create'
            ? reservations.create(createData())
            : reservations.pickup('reservation', overdueNow),
        ).rejects.toBeInstanceOf(ConflictException);
      }
      expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
      expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
      expect(db.rows('incumplimientos').every((r) => r.origen === 'MORA')).toBe(
        true,
      );
      expect(db.rows('usuarios')[0]!.confianza).toBe('60.00');
    },
  );

  it('vencer cancela primero por restricción; repetir no genera NO_SHOW ni otro descuento', async () => {
    const { db, reservations } = overdueFixture();
    db.rows('reservas')[0]!.fechaLimiteRecogida = overdueInstant(
      new Date(overdueNow.getTime() - 1),
    );
    expect(await reservations.expire(overdueNow)).toEqual([]);
    expect(await reservations.expire(overdueNow)).toEqual([]);
    expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
    expect(db.rows('incumplimientos')).toHaveLength(1);
    expect(db.rows('incumplimientos')[0]!.origen).toBe('MORA');
    expect(db.rows('usuarios')[0]!.confianza).toBe('60.00');
    expect(
      db.calls.some(
        (p) =>
          p.table === 'reservas' &&
          p.operation === 'update' &&
          !Array.isArray(p.data) &&
          p.data?.estado === 'VENCIDA',
      ),
    ).toBe(false);
  });

  it('restricción ya persistida cancela también sin ajustes nuevos', async () => {
    const { db, synchronizer } = overdueFixture();
    await synchronizer.synchronizeUser('user');
    db.rows('reservas')[0]!.estado = 'CONFIRMADA';
    db.rows('ejemplares')[1]!.estado = 'RESERVADO';
    await synchronizer.synchronizeUser('user');
    expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
  });

  it('mora histórica cumplida no cancela reserva legítima ni impide recoger a docente', async () => {
    const { db, synchronizer, reservations } = overdueFixture();
    db.rows('prestamos')[0]!.fechaInicio = overdueInstant(
      new Date(overdueNow.getTime() - 101 * overdueDay),
    );
    db.rows('prestamos')[0]!.fechaFin = overdueInstant(
      new Date(overdueNow.getTime() - 100 * overdueDay),
    );
    await synchronizer.synchronizeUser('user');
    expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
    const result = await reservations.pickup('reservation', overdueNow);
    expect(result.reservation.status).toBe('RECOGIDA');
    expect(db.rows('prestamos')).toHaveLength(2);
    expect(
      db
        .rows('auditorias_usuario')
        .filter((a) => a.accion === 'RESERVAS_CANCELADAS_POR_SANCION'),
    ).toHaveLength(0);
  });

  it.each(['DOCENTE', 'ADMINISTRATIVO'])(
    '%s puede reservar y recoger otro ejemplar con préstamo activo, sin límite de frecuencia del estudiante',
    async (type) => {
      const { db, reservations } = overdueFixture(type);
      db.rows('prestamos')[0]!.fechaFin = overdueInstant(
        new Date(overdueNow.getTime() + overdueDay),
      );
      vi.spyOn(configuration, 'captureLoanConfiguration').mockResolvedValue({
        policy: { effectiveDurationHours: 8 },
        accessories: [],
      } as never);
      // Incluso si un llamador antiguo pide el límite, manda el tipo persistido.
      const created = await reservations.create(createData(true));
      expect(created.status).toBe('CONFIRMADA');
      await reservations.pickup('reservation', overdueNow);
      expect(
        db.rows('prestamos').filter((r) => r.estado === 'ACTIVO'),
      ).toHaveLength(2);
      await expect(
        reservations.create(createData(true)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.rows('prestamos')).toHaveLength(2);
      expect(
        db.rows('ejemplares').find((r) => r.id === 'new-copy')!.estado,
      ).toBe('RESERVADO');
    },
  );

  it.each(['create', 'pickup'] as const)(
    'estudiante no puede %s con otro préstamo aunque el llamador desactive límite',
    async (operation) => {
      const { db, reservations } = overdueFixture('ESTUDIANTE');
      db.rows('prestamos')[0]!.fechaFin = overdueInstant(
        new Date(overdueNow.getTime() + overdueDay),
      );
      await expect(
        operation === 'create'
          ? reservations.create(createData(false))
          : reservations.pickup('reservation', overdueNow),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
      expect(db.rows('ejemplares')[2]!.estado).toBe('DISPONIBLE');
      expect(db.rows('prestamos')).toHaveLength(1);
    },
  );

  it('recogida captura hora tras espera por usuario y no reclama después del deadline', async () => {
    const { db, reservations } = overdueFixture();
    db.rows('prestamos')[0]!.fechaFin = overdueInstant(
      new Date(overdueNow.getTime() + overdueDay),
    );
    const runtime = db.client.runtime();
    const query = runtime.query.bind(runtime);
    let userWrites = 0;
    vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (
        plan.table === 'usuarios' &&
        plan.operation === 'update' &&
        ++userWrites === 2
      )
        vi.setSystemTime(new Date(overdueNow.getTime() + 120_000));
      return query(plan);
    });
    await expect(
      reservations.pickup('reservation', overdueNow),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.rows('prestamos')).toHaveLength(1);
  });

  it('carreras lógicas serializadas pickup/expiry no duplican consecuencia ni crean préstamo de reserva cancelada', async () => {
    const { db, reservations } = overdueFixture();
    db.rows('reservas')[0]!.fechaLimiteRecogida = overdueInstant(
      new Date(overdueNow.getTime() - 1),
    );
    const transaction = db.client.transaction.bind(db.client);
    let queue = Promise.resolve();
    db.client.transaction = (work) => {
      const next = queue.then(() => transaction(work));
      queue = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    };
    const results = await Promise.allSettled([
      reservations.pickup('reservation', overdueNow),
      reservations.expire(overdueNow),
    ]);
    expect(results[0]!.status).toBe('rejected');
    expect(results[1]!.status).toBe('fulfilled');
    expect(db.rows('prestamos')).toHaveLength(1);
    expect(db.rows('incumplimientos')).toHaveLength(1);
    expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
    expect(db.rows('usuarios')[0]!.confianza).toBe('60.00');
    const claims = db.calls.filter(
      (p) => p.table === 'reservas' && p.operation === 'update',
    );
    expect(
      claims.every(
        (p) => !Array.isArray(p.data) && p.data?.estado === 'CANCELADA',
      ),
    ).toBe(true);
  });

  it.each(['create', 'pickup'] as const)(
    '>100 pendientes: %s falla cerrado con progreso confirmado y converge al repetir',
    async (operation) => {
      const { db, synchronizer, reservations } = overdueFixture();
      manyLoans(db);
      await expect(
        operation === 'create'
          ? reservations.create(createData())
          : reservations.pickup('reservation', overdueNow),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(db.rows('incumplimientos')).toHaveLength(100);
      expect(db.rows('ajustes_incumplimiento')).toHaveLength(300);
      expect(db.rows('reservas')).toHaveLength(1);
      expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
      expect(db.rows('prestamos')).toHaveLength(102);
      expect(db.rows('prestamos').every((r) => r.estado === 'ACTIVO')).toBe(
        true,
      );
      expect(db.rows('ejemplares')[2]!.estado).toBe('DISPONIBLE');
      await synchronizer.synchronizeUser('user');
      await synchronizer.synchronizeUser('user');
      expect(db.rows('incumplimientos')).toHaveLength(102);
      expect(db.rows('ajustes_incumplimiento')).toHaveLength(306);
      expect(
        new Set(db.rows('incumplimientos').map((r) => r.prestamoId)).size,
      ).toBe(102);
      expect(db.rows('incumplimientos').every((r) => r.origen === 'MORA')).toBe(
        true,
      );
      const pages = db.calls.filter(
        (c) => c.table === 'prestamos' && c.limit === 25,
      );
      expect(pages.length).toBeGreaterThan(5);
      expect(
        db.calls
          .filter((c) => c.table === 'prestamos' && c.operation === 'select')
          .every((c) => c.limit === 25 || c.limit === 1),
      ).toBe(true);
      db.rows('reservas')[0]!.fechaLimiteRecogida = overdueInstant(
        new Date(overdueNow.getTime() - 1),
      );
      expect(await reservations.expire(overdueNow)).toEqual([]);
      expect(db.rows('incumplimientos')).toHaveLength(102);
      expect(db.rows('sanciones')).toHaveLength(102);
      expect(
        db
          .rows('auditorias_usuario')
          .filter((r) => r.accion === 'RESERVAS_CANCELADAS_POR_SANCION'),
      ).toHaveLength(1);
    },
  );

  it('segunda fase devuelve pendiente y confirma 100 unidades; reintento alcanza las restantes', async () => {
    const { db, prisma, synchronizer } = overdueFixture();
    manyLoans(db);
    const recheck = () =>
      prisma.client.transaction(async (tx) => {
        await synchronizer.lockUser(tx, 'user');
        return synchronizer.recheckLocked(tx, 'user');
      });
    expect(await recheck()).toBeInstanceOf(ServiceUnavailableException);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(300);
    expect(await recheck()).toBeInstanceOf(ConflictException);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(306);
    expect(await recheck()).toBeInstanceOf(ConflictException);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(306);
    expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
  });

  it.each(['create', 'pickup'] as const)(
    '>100 vencen entre fases de %s: se confirma progreso sin reservar ni entregar',
    async (operation) => {
      const { db, reservations, synchronizer } = overdueFixture();
      const due = db.rows('prestamos')[0]!.fechaFin;
      db.rows('prestamos')[0]!.fechaFin = overdueInstant(
        new Date(overdueNow.getTime() + overdueDay),
      );
      const original = synchronizer.synchronizeUser.bind(synchronizer);
      let crossed = false;
      vi.spyOn(
        LoanOverdueSynchronizer.prototype,
        'synchronizeUser',
      ).mockImplementation(async (userId) => {
        await original(userId);
        if (!crossed) {
          db.rows('prestamos')[0]!.fechaFin = due;
          manyLoans(db);
          crossed = true;
        }
      });
      await expect(
        operation === 'create'
          ? reservations.create(createData())
          : reservations.pickup('reservation', overdueNow),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(db.rows('ajustes_incumplimiento')).toHaveLength(300);
      expect(db.rows('reservas')).toHaveLength(1);
      expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
      expect(db.rows('prestamos')).toHaveLength(102);
      expect(db.rows('ejemplares')[2]!.estado).toBe('DISPONIBLE');
    },
  );

  it('un pendiente después de >100 saldados no queda oculto por el prefijo ni consume su presupuesto', async () => {
    const { db, synchronizer } = await settledLoans(false);
    const first = db.rows('prestamos')[0]!;
    db.rows('prestamos').push({
      ...first,
      id: 'zz-pending',
      ejemplarId: 'zz-copy',
    });
    db.rows('ejemplares').push({ ...db.rows('ejemplares')[0]!, id: 'zz-copy' });
    const before = db.rows('ajustes_incumplimiento').length;
    await synchronizer.synchronizeUser('user');
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(before + 3);
    expect(
      db.rows('incumplimientos').filter((r) => r.prestamoId === 'zz-pending'),
    ).toHaveLength(1);
    await synchronizer.synchronizeUser('user');
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(before + 3);
  });

  it.each([
    ['create', false],
    ['pickup', false],
    ['create', true],
    ['pickup', true],
  ] as const)(
    '>100 saldados: %s habilitado con absolución=%s, sin cerrar préstamos ni duplicar ajustes',
    async (operation, absolved) => {
      const { db, reservations, synchronizer } = await settledLoans(absolved);
      const before = db.rows('ajustes_incumplimiento').length;
      const cancellations = db
        .rows('auditorias_usuario')
        .filter((r) => r.accion === 'RESERVAS_CANCELADAS_POR_SANCION').length;
      vi.spyOn(configuration, 'captureLoanConfiguration').mockResolvedValue({
        policy: { effectiveDurationHours: 8 },
        accessories: [],
      } as never);
      if (operation === 'create')
        expect((await reservations.create(createData())).status).toBe(
          'CONFIRMADA',
        );
      else
        expect(
          (await reservations.pickup('reservation', overdueNow)).reservation
            .status,
        ).toBe('RECOGIDA');
      await synchronizer.synchronizeUser('user');
      expect(db.rows('ajustes_incumplimiento')).toHaveLength(before);
      expect(db.rows('usuarios')[0]!.confianza).toBe('80.00');
      expect(db.rows('incumplimientos')).toHaveLength(102);
      expect(
        db
          .rows('auditorias_usuario')
          .filter((r) => r.accion === 'RESERVAS_CANCELADAS_POR_SANCION'),
      ).toHaveLength(cancellations);
      expect(db.rows('prestamos').every((r) => r.estado === 'ACTIVO')).toBe(
        true,
      );
      expect(db.rows('prestamos')).toHaveLength(
        operation === 'create' ? 102 : 103,
      );
    },
  );

  it('denegar simultaneidad del estudiante también confirma ajustes históricos de la segunda fase', async () => {
    const { db, reservations, synchronizer } = overdueFixture('ESTUDIANTE');
    db.rows('prestamos')[0]!.fechaInicio = overdueInstant(
      new Date(overdueNow.getTime() - 101 * overdueDay),
    );
    db.rows('prestamos')[0]!.fechaFin = overdueInstant(
      new Date(overdueNow.getTime() + overdueDay),
    );
    const original = synchronizer.synchronizeUser.bind(synchronizer);
    vi.spyOn(
      LoanOverdueSynchronizer.prototype,
      'synchronizeUser',
    ).mockImplementation(async (userId) => {
      await original(userId);
      db.rows('prestamos')[0]!.fechaFin = overdueInstant(
        new Date(overdueNow.getTime() - 100 * overdueDay),
      );
    });
    await expect(reservations.create(createData(false))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
    expect(db.rows('usuarios')[0]!.confianza).toBe('60.00');
    expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
  });
});
