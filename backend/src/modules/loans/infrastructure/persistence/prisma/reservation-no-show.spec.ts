import { describe, expect, it, vi } from 'vitest';
import { Temporal } from 'temporal-polyfill/full';
import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaReservationRepository } from './prisma-reservation.repository.js';
import { inMemoryPrisma } from '../../../../../../test/helpers/in-memory-prisma.js';
import { categoryPolicyFixture } from '../../../../../../test/helpers/category-policy-fixture.js';
import { ReservationExpiryService } from '../../reservation-expiry.service.js';
import { ReservationStatus } from '../../../domain/entities/reservation.js';

const deadline = new Date('2026-11-04T10:30:00.123Z');
const after = new Date(deadline.getTime() + 1);
function setup(trust = 80) {
  const fixture = categoryPolicyFixture('category');
  const policy = fixture.versiones_regla.find(
    (r) => JSON.parse(r.descripcion).key === 'R-RES:LEVE',
  )!;
  // Dato persistido deliberadamente distinto al catálogo: no copiar 2 al runtime.
  policy.penalizacionPorcentual = '4.25';
  const db = inMemoryPrisma({
    ...fixture,
    usuarios: [
      { id: 'user', confianza: trust.toFixed(2), vinculacionVigente: true },
      { id: 'other', confianza: '95.00' },
    ],
    ejemplares: [{ id: 'copy', estado: 'RESERVADO' }],
    reservas: [
      {
        id: 'reservation',
        usuarioId: 'user',
        ejemplarId: 'copy',
        fechaSolicitada: new Date('2026-11-04T10:00:00.123Z'),
        fechaLimiteRecogida: deadline,
        duracionPrestamoHoras: 8,
        fechaRecogida: null,
        fechaCancelacion: null,
        motivoCancelacion: null,
        estado: 'CONFIRMADA',
        configurationSnapshot: {
          reservationNoShow: {
            termsVersionId: fixture.versiones_terminos[0].id,
            ruleVersionId: policy.id,
          },
        },
      },
    ],
  });
  db.rows('versiones_terminos')[0].createdAt = Temporal.Instant.from(
    '2026-11-01T00:00:00Z',
  );
  db.rows('reservas')[0].fechaSolicitada = Temporal.Instant.from(
    '2026-11-04T10:00:00.123Z',
  );
  db.rows('reservas')[0].createdAt = Temporal.Instant.from(
    '2026-11-04T09:00:00Z',
  );
  db.rows('reservas')[0].fechaLimiteRecogida = Temporal.Instant.from(
    deadline.toISOString(),
  );
  return { db, policy, repository: new PrismaReservationRepository(db as any) };
}

describe('vencimiento + NO_SHOW LEVE, repositorios reales con doble transaccional offline', () => {
  it.each([-1, 0])('no vence antes ni en el límite (%s ms)', async (offset) => {
    const { db, repository } = setup();
    expect(
      await repository.expire(new Date(deadline.getTime() + offset)),
    ).toEqual([]);
    expect(db.rows('reservas')[0].estado).toBe('CONFIRMADA');
    expect(db.rows('incumplimientos')).toHaveLength(0);
    expect(db.rows('usuarios')[0].confianza).toBe('80.00');
  });

  it('justo después registra una LEVE versionada, confianza, ejemplar, auditoría e historial', async () => {
    const { db, policy, repository } = setup();
    expect(await repository.expire(after)).toMatchObject([
      { id: 'reservation', status: 'VENCIDA', pickupDeadline: deadline },
    ]);
    expect(db.rows('incumplimientos')).toMatchObject([
      {
        reservaId: 'reservation',
        usuarioId: 'user',
        versionReglaId: policy.id,
        penalizacionAplicada: '4.25',
      },
    ]);
    expect(db.rows('sanciones')).toMatchObject([
      {
        estado: 'FINALIZADA',
        confianzaAnterior: '80.00',
        confianzaPosterior: '75.75',
        versionReglaId: policy.id,
      },
    ]);
    expect(db.rows('usuarios').map((r) => r.confianza)).toEqual([
      '75.75',
      '95.00',
    ]);
    expect(db.rows('ejemplares')[0].estado).toBe('DISPONIBLE');
    expect(db.rows('prestamos')).toHaveLength(0);
    const audit = db.rows('auditorias_usuario');
    expect(audit).toHaveLength(1);
    expect(JSON.parse(audit[0].datosAnteriores)).toEqual({ confianza: 80 });
    expect(JSON.parse(audit[0].datosNuevos)).toMatchObject({
      confianza: 75.75,
      reservationId: 'reservation',
      sanctionId: db.rows('sanciones')[0].id,
      ruleVersionId: policy.id,
    });
    expect(
      (await repository.findMany({ userId: 'user', page: 1, limit: 20 })).items,
    ).toHaveLength(1);
    expect(
      (
        await repository.findMany({
          userId: 'user',
          status: ReservationStatus.CONFIRMED,
          page: 1,
          limit: 20,
        })
      ).total,
    ).toBe(0);
    const userLock = db.calls.findIndex(
      (p) => p.table === 'usuarios' && p.operation === 'update',
    );
    const claim = db.calls.findIndex(
      (p) => p.table === 'reservas' && p.operation === 'update',
    );
    expect(userLock).toBeLessThan(claim);
  });

  it('reintentos, reloj que retrocede y worker/listados no vuelven a descontar', async () => {
    const { db, repository } = setup();
    await repository.expire(after);
    await repository.expire(deadline);
    await repository.expire(after);
    await new ReservationExpiryService(repository).expire();
    expect(db.rows('incumplimientos')).toHaveLength(1);
    expect(db.rows('sanciones')).toHaveLength(1);
    expect(db.rows('auditorias_usuario')).toHaveLength(1);
    expect(db.rows('usuarios')[0].confianza).toBe('75.75');
  });

  it('dos workers estimulados que seleccionaron la misma reserva solo reclaman una vez', async () => {
    const { db, repository } = setup();
    const transaction = db.client.transaction.bind(db.client);
    // Serializa las transacciones como el bloqueo de usuario en PostgreSQL.
    // Este doble no demuestra concurrencia real del servidor SQL.
    let queue = Promise.resolve();
    db.client.transaction = (work) => {
      const next = queue.then(() => transaction(work));
      queue = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    };
    const results = await Promise.all([
      repository.expire(after),
      repository.expire(after),
    ]);
    expect(results.flat()).toHaveLength(1);
    expect(db.rows('sanciones')).toHaveLength(1);
    expect(db.rows('usuarios')[0].confianza).toBe('75.75');
  });

  it.each(['CANCELADA', 'RECOGIDA', 'VENCIDA'])(
    'no sanciona estados %s ni retroactivamente',
    async (status) => {
      const { db, repository } = setup();
      db.rows('reservas')[0].estado = status;
      expect(await repository.expire(after)).toEqual([]);
      expect(db.rows('incumplimientos')).toHaveLength(0);
    },
  );

  it.each(['incumplimientos', 'sanciones', 'auditorias_usuario'])(
    'fallo de %s revierte todo y permite reintentar',
    async (table) => {
      const { db, repository } = setup();
      const runtime = db.client.runtime();
      const query = runtime.query.bind(runtime);
      const spy = vi
        .spyOn(runtime, 'query')
        .mockImplementation(async (plan) => {
          if (plan.table === table && plan.operation === 'insert')
            throw new Error('simulated persistence failure');
          return query(plan);
        });
      await expect(repository.expire(after)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(db.rows('reservas')[0].estado).toBe('CONFIRMADA');
      expect(db.rows('ejemplares')[0].estado).toBe('RESERVADO');
      expect(db.rows('usuarios')[0].confianza).toBe('80.00');
      for (const name of ['incumplimientos', 'sanciones', 'auditorias_usuario'])
        expect(db.rows(name)).toHaveLength(0);
      spy.mockRestore();
      await repository.expire(after);
      expect(db.rows('sanciones')).toHaveLength(1);
    },
  );

  it.each([
    'kind',
    'categoryId',
    'severity',
    'suspension',
    'version',
    'missing',
  ])('no usa una política incorrecta (%s), rollback y 503', async (invalid) => {
    const { db, repository } = setup();
    const version = db
      .rows('versiones_regla')
      .find((r) => JSON.parse(r.descripcion).key === 'R-RES:LEVE')!;
    const metadata = JSON.parse(version.descripcion);
    if (invalid === 'kind') metadata.kind = 'DAMAGE';
    if (invalid === 'categoryId') metadata.categoryId = 'another-category';
    if (invalid === 'severity') metadata.severity = 'GRAVE';
    if (invalid === 'suspension') version.tipoSuspension = 'TEMPORAL';
    if (invalid === 'version')
      db.rows(
        'reservas',
      )[0].configurationSnapshot.reservationNoShow.ruleVersionId =
        'other-version';
    if (invalid === 'missing')
      db.rows('versiones_regla').splice(
        db.rows('versiones_regla').indexOf(version),
        1,
      );
    version.descripcion = JSON.stringify(metadata);
    await expect(repository.expire(after)).rejects.toMatchObject({
      status: 503,
    });
    expect(db.rows('reservas')[0].estado).toBe('CONFIRMADA');
    expect(db.rows('usuarios')[0].confianza).toBe('80.00');
    expect(db.rows('sanciones')).toHaveLength(0);
  });

  it('usa la publicación histórica aunque haya otra actual con una penalización distinta', async () => {
    const { db, policy, repository } = setup();
    delete db.rows('reservas')[0].configurationSnapshot.reservationNoShow;
    const newerId = '123e4567-e89b-42d3-a456-426614174088';
    db.rows('versiones_regla').push({
      ...db.rows('versiones_regla').find((r) => r.id === policy.id),
      id: newerId,
      penalizacionPorcentual: '9.00',
    });
    db.rows('versiones_terminos').push({
      id: 'later',
      numero: 2,
      titulo: 'posterior',
      createdAt: Temporal.Instant.from('2026-11-04T09:30:00Z'),
      contenido: `<!-- epcc.policy-versions/v1: ${JSON.stringify([newerId])} -->`,
    });
    await repository.expire(after);
    expect(db.rows('sanciones')[0].versionReglaId).toBe(policy.id);
    expect(db.rows('usuarios')[0].confianza).toBe('75.75');
  });

  it.each([0, 1.5])('no baja de cero con confianza %s', async (trust) => {
    const { db, repository } = setup(trust);
    await repository.expire(after);
    expect(db.rows('usuarios')[0].confianza).toBe('0.00');
    expect(db.rows('incumplimientos')[0].penalizacionAplicada).toBe(
      trust.toFixed(2),
    );
    expect(db.rows('sanciones')).toHaveLength(1);
  });

  it('otra reserva del mismo usuario vuelve a usar LEVE sin escalamiento', async () => {
    const { db, policy, repository } = setup();
    await repository.expire(after);
    const second = {
      ...db.rows('reservas')[0],
      id: 'second',
      estado: 'CONFIRMADA',
    };
    db.rows('reservas').push(second);
    db.rows('ejemplares')[0].estado = 'RESERVADO';
    await repository.expire(after);
    expect(db.rows('incumplimientos')).toHaveLength(2);
    expect(db.rows('sanciones').map((r) => r.versionReglaId)).toEqual([
      policy.id,
      policy.id,
    ]);
    expect(db.rows('usuarios')[0].confianza).toBe('71.50');
  });

  it('esquema pendiente devuelve 503 controlado sin efectos', async () => {
    const { db, repository } = setup();
    vi.spyOn(db.client.runtime(), 'query').mockRejectedValueOnce(
      Object.assign(new Error('missing column'), { code: '42703' }),
    );
    await expect(repository.expire(after)).rejects.toMatchObject({
      status: 503,
    });
    expect(db.rows('reservas')[0].estado).toBe('CONFIRMADA');
    expect(db.rows('usuarios')[0].confianza).toBe('80.00');
  });

  it('conserva un antecedente absuelto sin regenerarlo', async () => {
    const { db, repository } = setup();
    await repository.expire(after);
    db.rows('sanciones')[0].estado = 'ABSUELTA';
    // Simula un antecedente consolidado con estado de reserva aún pendiente.
    db.rows('reservas')[0].estado = 'CONFIRMADA';
    db.rows('ejemplares')[0].estado = 'RESERVADO';
    await repository.expire(after);
    expect(db.rows('sanciones')).toHaveLength(1);
    expect(db.rows('sanciones')[0].estado).toBe('ABSUELTA');
    expect(db.rows('usuarios')[0].confianza).toBe('75.75');
  });

  it('no libera un ejemplar con otro préstamo activo', async () => {
    const { db, repository } = setup();
    await db.client
      .runtime()
      .query(
        (db.sql.public as any).prestamos
          .insert([{ id: 'loan', ejemplarId: 'copy', estado: 'ACTIVO' }])
          .build(),
      );
    await expect(repository.expire(after)).rejects.toMatchObject({
      status: 503,
    });
    expect(db.rows('ejemplares')[0].estado).toBe('RESERVADO');
    expect(db.rows('reservas')[0].estado).toBe('CONFIRMADA');
  });
});
