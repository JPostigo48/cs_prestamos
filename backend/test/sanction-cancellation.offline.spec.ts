import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill/full';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';
import { categoryPolicyFixture } from './helpers/category-policy-fixture.js';
import { PrismaSanctionRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.js';
import { PrismaViolationRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-violation.repository.js';
import { RegisterViolationUseCase } from '../src/modules/rules/application/use-cases/register-violation.use-case.js';
import { PrismaRuleRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-rule.repository.js';
import { SuspensionType } from '../src/modules/rules/domain/entities/usage-rule.js';

const at = new Date('2026-11-04T12:00:00.123Z');
const actor = { accountId: 'account', userId: 'operator' };
function setup(restricted = true) {
  const db = inMemoryPrisma({
    ...categoryPolicyFixture('category'),
    usuarios: [{ id: 'user', confianza: '80.00' }],
    sanciones: restricted ? [{ id: 'restriction', usuarioId: 'user', estado: 'ACTIVA', fechaInicio: Temporal.Instant.from(at.toISOString()), fechaFin: null }] : [],
    reservas: [
      {
        id: 'reservation',
        usuarioId: 'user',
        ejemplarId: 'copy',
        estado: 'CONFIRMADA',
        fechaRecogida: null,
      },
      {
        id: 'picked-up',
        usuarioId: 'user',
        ejemplarId: 'active-copy',
        estado: 'RECOGIDA',
        fechaRecogida: 'past',
      },
      {
        id: 'other',
        usuarioId: 'other',
        ejemplarId: 'other-copy',
        estado: 'CONFIRMADA',
        fechaRecogida: null,
      },
    ],
    ejemplares: [
      {
        id: 'copy',
        recursoId: 'resource',
        estado: 'RESERVADO',
        condicionFisica: 'APTO',
        habilitado: true,
      },
      {
        id: 'active-copy',
        recursoId: 'resource',
        estado: 'PRESTADO',
        condicionFisica: 'APTO',
        habilitado: true,
      },
    ],
    recursos: [{ id: 'resource', categoriaId: 'category', activo: true }],
    categorias_recurso: [{ id: 'category', activo: true }],
    prestamos: [{ id: 'loan', ejemplarId: 'active-copy', estado: 'ACTIVO' }],
  });
  if (restricted) db.rows('sanciones')[0]!.fechaInicio = Temporal.Instant.from(at.toISOString());
  const prisma = db as unknown as PrismaService;
  const repository = new PrismaSanctionRepository(prisma);
  const cancel = () =>
    db.client.transaction((tx) =>
      repository.cancelReservations(
        tx as never,
        'user',
        'Incumplimiento acreditado',
        at,
      ),
    );
  return { db, prisma, cancel, repository };
}

describe('cancelación compartida por sanciones/incumplimientos', () => {
  it('cancela solo confirmadas no recogidas, audita motivo y libera apto sin crear NO_SHOW', async () => {
    const { db, cancel } = setup();
    expect(await cancel()).toEqual(['reservation']);
    expect(db.rows('reservas')[0]).toMatchObject({
      estado: 'CANCELADA',
      motivoCancelacion: 'Sanción/incumplimiento: Incumplimiento acreditado',
    });
    expect(db.rows('reservas')[1]!.estado).toBe('RECOGIDA');
    expect(db.rows('reservas')[2]!.estado).toBe('CONFIRMADA');
    expect(db.rows('ejemplares').map((r) => r.estado)).toEqual([
      'DISPONIBLE',
      'PRESTADO',
    ]);
    expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
    expect(db.rows('incumplimientos')).toHaveLength(0);
    expect(JSON.parse(db.rows('auditorias_usuario')[0]!.datosNuevos)).toEqual({
      reservationIds: ['reservation'],
      noShow: false,
    });
    expect(await cancel()).toEqual([]);
    expect(db.rows('auditorias_usuario')).toHaveLength(1);
  });

  it.each([
    'DANADO',
    'INCOMPLETO',
    'DANADO_E_INCOMPLETO',
    'PERDIDO',
    'ROBADO',
    null,
  ])(
    'no libera condición %s ni repara/habilita al cancelar',
    async (condition) => {
      const { db, cancel } = setup();
      db.rows('ejemplares')[0]!.condicionFisica = condition;
      await cancel();
      expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
      expect(db.rows('ejemplares')[0]).toMatchObject({
        estado: 'NO_DISPONIBLE',
        condicionFisica: condition,
        habilitado: true,
      });
    },
  );

  it.each([
    'disabled',
    'resource-inactive',
    'category-inactive',
    'active-loan',
    'other-reservation',
    'already-picked-up',
    'copy-prestado',
  ])('preserva copia y compromisos cuando %s', async (reason) => {
    const { db, cancel } = setup();
    if (reason === 'disabled') db.rows('ejemplares')[0]!.habilitado = false;
    if (reason === 'resource-inactive') db.rows('recursos')[0]!.activo = false;
    if (reason === 'category-inactive')
      db.rows('categorias_recurso')[0]!.activo = false;
    if (reason === 'active-loan')
      db.rows('prestamos').push({
        id: 'other-loan',
        ejemplarId: 'copy',
        estado: 'ACTIVO',
      });
    if (reason === 'other-reservation')
      db.rows('reservas').push({
        id: 'commitment',
        usuarioId: 'other',
        ejemplarId: 'copy',
        estado: 'CONFIRMADA',
        fechaRecogida: null,
      });
    if (reason === 'already-picked-up')
      db.rows('reservas')[0]!.fechaRecogida = Temporal.Instant.from(
        at.toISOString(),
      );
    if (reason === 'copy-prestado')
      db.rows('ejemplares')[0]!.estado = 'PRESTADO';
    await cancel();
    expect(db.rows('ejemplares')[0]!.estado).toBe(
      reason === 'copy-prestado' ? 'PRESTADO' : reason === 'already-picked-up' ? 'RESERVADO' : 'NO_DISPONIBLE',
    );
    expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
    if (reason === 'already-picked-up')
      expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
  });

  it('un descuento legado sin suspensión ni restricción de confianza conserva reservas', async () => {
    const { db, prisma } = setup(false);
    await new PrismaViolationRepository(prisma).createWithPenalty({
      userId: 'user',
      ruleId: 'legacy',
      ruleVersionId: 'legacy-version',
      occurredAt: at,
      configuredPenalty: 2,
      suspensionType: SuspensionType.NONE,
      suspensionDays: null,
    });
    expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
    expect(db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
    expect(db.rows('usuarios')[0]!.confianza).toBe('78.00');
    expect(db.rows('incumplimientos')).toHaveLength(1);
    expect(db.rows('sanciones')[0]!.estado).toBe('FINALIZADA');
  });

  it('NO_SHOW interno 80 a 78 sin suspensión conserva las demás reservas', async () => {
    const { db, prisma } = setup(false);
    await db.client.transaction((tx) =>
      new PrismaViolationRepository(prisma).createReservationPenalty(
        tx as never,
        {
          userId: 'user',
          ruleId: 'no-show',
          ruleVersionId: 'no-show-version',
          occurredAt: at,
          configuredPenalty: 2,
          suspensionType: SuspensionType.NONE,
          suspensionDays: null,
          reservationId: 'expired',
        },
        at,
      ),
    );
    expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
    expect(db.rows('incumplimientos')).toHaveLength(1);
    expect(db.rows('incumplimientos')[0]!.reservaId).toBe('expired');
  });

  it.each(['DAMAGE', 'LOSS'])(
    'rechaza política oficial %s en ambos registros manuales sin contexto',
    async (kind) => {
      const { db, prisma, repository } = setup();
      const rule = db
        .rows('versiones_regla')
        .find((v) => JSON.parse(v.descripcion).kind === kind)!;
      await expect(
        new RegisterViolationUseCase(
          new PrismaViolationRepository(prisma),
          new PrismaRuleRepository(prisma),
        ).execute({ userId: 'user', ruleId: rule.reglaId, occurredAt: at }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        repository.suspend({
          userId: 'user',
          ruleId: rule.reglaId,
          reason: 'Registro sin contexto',
          requestId: 'request',
          actor,
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(db.rows('usuarios')[0]!.confianza).toBe('80.00');
      expect(db.rows('incumplimientos')).toHaveLength(0);
      expect(db.rows('reservas')[0]!.estado).toBe('CONFIRMADA');
    },
  );
});
