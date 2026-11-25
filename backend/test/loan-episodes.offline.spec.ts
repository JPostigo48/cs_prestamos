import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill/full';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';
import { categoryPolicyFixture } from './helpers/category-policy-fixture.js';
import {
  LoanEpisodeEngine,
  type SynchronizeLoanEpisodes,
} from '../src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.js';
import { HistoricalLoanPolicyReader } from '../src/modules/rules/infrastructure/persistence/prisma/historical-loan-policy.reader.js';
import { PrismaAppealRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-appeal.repository.js';
import { AppealStatus } from '../src/modules/rules/domain/entities/appeal.js';
import type { ResolveAppealData } from '../src/modules/rules/domain/repositories/appeal.repository.js';
import { instantToDate } from '../src/shared/infrastructure/prisma/instant-to-date.js';
import { PrismaSanctionRepository } from '../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.js';

const due = new Date('2026-11-04T12:00:00.123Z');
const hour = 3_600_000,
  day = 24 * hour;
const instant = (date: Date) => Temporal.Instant.from(date.toISOString());
const plus = (ms: number) => new Date(due.getTime() + ms);
const actor = { accountId: 'operator-account', userId: 'operator' };
const command: SynchronizeLoanEpisodes = {
  userId: 'user',
  loanId: 'loan',
  actor: { process: 'lateness' },
  source: 'AUTOMATION',
};

function setup(category = 'ELECTRONICOS', balance = 80) {
  const fixture = categoryPolicyFixture('category');
  for (const version of fixture.versiones_regla) {
    const metadata = JSON.parse(version.descripcion);
    if (metadata.category !== null)
      metadata.categoryId = `category-${metadata.category}`;
    version.descripcion = JSON.stringify(metadata);
  }
  const reference = {
    termsVersionId: fixture.versiones_terminos[0]!.id,
    categoryId: `category-${category}`,
  };
  const db = inMemoryPrisma({
    ...fixture,
    apelaciones: [],
    usuarios: [{ id: 'user', confianza: balance.toFixed(2) }],
    prestamos: [
      {
        id: 'loan',
        usuarioId: 'user',
        ejemplarId: 'copy',
        reservaId: 'reservation',
        estado: 'ACTIVO',
        configurationSnapshot: {
          loanPolicy: reference,
          policy: { categoryId: reference.categoryId },
        },
      },
    ],
    reservas: [
      {
        id: 'reservation',
        usuarioId: 'user',
        ejemplarId: 'copy',
        estado: 'RECOGIDA',
        fechaRecogida: new Date(),
      },
    ],
    inspecciones_devolucion: [
      {
        id: 'inspection',
        prestamoId: 'loan',
        parts: [{ accessoryId: 'part', received: true }],
      },
    ],
    evidencias_prestamo: [
      { id: 'evidence', prestamoId: 'loan', tipo: 'PERDIDA' },
    ],
    ejemplares: [
      {
        id: 'copy',
        estado: 'PRESTADO',
        condicionFisica: 'APTO',
        habilitado: true,
      },
    ],
  });
  db.rows('prestamos')[0]!.fechaInicio = instant(plus(-8 * hour));
  db.rows('prestamos')[0]!.fechaFin = instant(due);
  db.rows('reservas')[0]!.createdAt = instant(plus(-10 * hour));
  db.rows('versiones_terminos')[0]!.createdAt = instant(plus(-100 * day));
  const prisma = db as unknown as PrismaService;
  const engine = new LoanEpisodeEngine(prisma);
  const run = (at: Date, extra: Partial<SynchronizeLoanEpisodes> = {}) =>
    db.client.transaction((tx) =>
      engine.synchronize(tx as never, { ...command, ...extra }, at),
    );
  return { db, prisma, engine, reference, run };
}

describe('motor histórico de episodios, offline sin clientes ni DB', () => {
  it.each([
    ['ELECTRONICOS', [1, 3], [10, 20, 30], [7, 15, 30]],
    ['LIBROS', [24, 72], [10, 15, 20], [7, 14, 30]],
    ['DEPORTES', [3, 12], [10, 15, 20], [7, 14, 30]],
  ] as const)(
    'fronteras exactas y +1ms, escala nominal/duración de %s',
    async (category, thresholds, penalties, days) => {
      for (const [elapsed, count] of [
        [-1, 0],
        [0, 0],
        [1, 1],
        [thresholds[0] * hour, 1],
        [thresholds[0] * hour + 1, 2],
        [thresholds[1] * hour, 2],
        [thresholds[1] * hour + 1, 3],
      ]) {
        const { db, run } = setup(category);
        await run(plus(elapsed));
        expect(db.rows('ajustes_incumplimiento')).toHaveLength(count);
        expect(db.rows('incumplimientos')).toHaveLength(count ? 1 : 0);
        expect(db.rows('sanciones')).toHaveLength(count ? 1 : 0);
        expect(Number(db.rows('usuarios')[0]!.confianza)).toBe(
          80 - (count ? penalties[count - 1]! : 0),
        );
        if (!count) continue;
        const adjustments = db.rows('ajustes_incumplimiento');
        expect(
          adjustments.map((a) => a.incrementoDias).reduce((a, b) => a + b, 0),
        ).toBe(days[count - 1]);
        expect(instantToDate(db.rows('sanciones')[0]!.fechaInicio)).toEqual(
          plus(1),
        );
        expect(instantToDate(db.rows('sanciones')[0]!.fechaFin)).toEqual(
          plus(1 + days[count - 1]! * day),
        );
        expect(
          adjustments.map(
            (a) => instantToDate(a.fechaEfectiva).getTime() - due.getTime(),
          ),
        ).toEqual(
          [1, thresholds[0] * hour + 1, thresholds[1] * hour + 1].slice(
            0,
            count,
          ),
        );
      }
    },
  );

  it('conserva saldos/versiones iniciales, deduplica y no cobra puntos antes truncados', async () => {
    const { db, run } = setup('ELECTRONICOS', 5);
    await run(plus(1));
    const firstViolation = { ...db.rows('incumplimientos')[0] },
      firstSanction = { ...db.rows('sanciones')[0] };
    // Una restitución independiente repuso saldo; no se recuperan los 5 truncados.
    db.rows('usuarios')[0]!.confianza = '80.00';
    await run(plus(hour + 1));
    expect(db.rows('usuarios')[0]!.confianza).toBe('70.00');
    expect(db.rows('incumplimientos')[0]).toEqual(firstViolation);
    expect(db.rows('sanciones')[0]).toMatchObject({
      confianzaAnterior: firstSanction.confianzaAnterior,
      confianzaPosterior: firstSanction.confianzaPosterior,
      versionReglaId: firstSanction.versionReglaId,
    });
    await run(plus(3 * hour + 1));
    const before = db.rows('ajustes_incumplimiento').map((a) => ({ ...a }));
    await run(plus(100 * day));
    await run(plus(0));
    expect(db.rows('ajustes_incumplimiento')).toEqual(before);
    expect(
      db.rows('ajustes_incumplimiento').map((a) => a.descuentoEfectivo),
    ).toEqual(['5.00', '10.00', '10.00']);
    expect(
      db.calls
        .filter((c) => c.table === 'ajustes_incumplimiento')
        .every((c) => c.operation !== 'update' && c.operation !== 'delete'),
    ).toBe(true);
  });

  it('usa importes, umbrales y duración publicados, no el catálogo baseline ni punteros vigentes', async () => {
    const { db, engine, run } = setup();
    const versions = db
      .rows('versiones_regla')
      .filter(
        (r) =>
          JSON.parse(r.descripcion).kind === 'LATENESS' &&
          JSON.parse(r.descripcion).category === 'ELECTRONICOS',
      );
    versions[0]!.penalizacionPorcentual = '11.25';
    versions[0]!.diasSuspension = 8;
    for (const [index, version] of versions.entries()) {
      const metadata = JSON.parse(version.descripcion);
      if (index === 0) metadata.criteria.delayHours.inclusiveMax = 2;
      if (index === 1) metadata.criteria.delayHours.exclusiveMin = 2;
      version.descripcion = JSON.stringify(metadata);
      version.estado = 'INACTIVA';
    }
    for (const row of db.rows('reglas_uso'))
      row.versionVigenteId = 'unrelated-current';
    await run(plus(hour + 1));
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(1);
    expect(db.rows('usuarios')[0]!.confianza).toBe('68.75');
    const policy = await engine.readPolicy(
      db.client.runtime() as never,
      'loan',
    );
    expect(policy).toMatchObject({
      damageOptions: expect.any(Array),
      lateness: expect.any(Array),
      loss: { trustEffect: 'SET_ZERO' },
      reward: { criteria: { reward: { fraction: 0.1 } } },
    });
    expect(policy.lateness[0]!.penaltyPoints).toBe(11.25);
  });

  it('un solo cargo daño+faltantes por mayor gravedad, acumulado con mora independiente', async () => {
    const { db, run } = setup();
    db.rows('inspecciones_devolucion')[0]!.parts[0].received = false;
    const extra: Partial<SynchronizeLoanEpisodes> = {
      source: 'CLOSURE',
      actor,
      damage: {
        damageSeverity: 'LEVE',
        missingSeverity: 'MODERADA',
        inspectionId: 'inspection',
        reason: 'Accesorio esencial no recibido',
      },
    };
    await run(plus(3 * hour + 1), extra);
    await run(plus(3 * hour + 1), extra);
    expect(db.rows('incumplimientos').map((r) => r.origen)).toEqual([
      'MORA',
      'DANO',
    ]);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(4);
    expect(db.rows('usuarios')[0]!.confianza).toBe('20.00');
    const sanctions = db.rows('sanciones');
    expect(instantToDate(sanctions[1]!.fechaInicio)).toEqual(
      instantToDate(sanctions[0]!.fechaFin),
    );
    expect(instantToDate(sanctions[1]!.fechaFin)).toEqual(plus(1 + 60 * day));
  });

  it.each(['DANO', 'PERDIDA'])(
    '%s establece cero, sin nominal100, bloqueo inmediato y deduplicado',
    async (origin) => {
      const { db, prisma, run } = setup('ELECTRONICOS', 42);
      const extra: Partial<SynchronizeLoanEpisodes> = {
        source: 'CLOSURE',
        actor,
        ...(origin === 'DANO'
          ? {
              damage: {
                damageSeverity: 'GRAVE',
                missingSeverity: null,
                inspectionId: 'inspection',
                reason: 'Daño crítico acreditado',
              } as const,
            }
          : {
              loss: {
                condition: 'ROBADO',
                reason: 'Robo confirmado',
                evidenceIds: ['evidence'],
              } as const,
            }),
      };
      await run(due, extra);
      expect(db.rows('usuarios')[0]!.confianza).toBe('0.00');
      expect(db.rows('ajustes_incumplimiento')[0]).toMatchObject({
        efecto: 'SET_ZERO',
        nominalObjetivo: null,
        incrementoNominal: null,
        descuentoEfectivo: '42.00',
      });
      expect(db.rows('sanciones')[0]).toMatchObject({
        estado: 'ACTIVA',
        fechaFin: null,
      });
      const detail = await new PrismaSanctionRepository(prisma).findDetail(db.rows('sanciones')[0]!.id);
      expect(detail!.current).toMatchObject({
        nominalPenaltyTotal: null, effectivePenaltyTotal: 42, suspensionDays: null,
        rule: { suspensionType: 'INDEFINIDA' },
        adjustments: [{ effect: 'SET_ZERO', nominalTarget: null, nominalIncrement: null, effectiveDiscount: 42 }],
      });
      db.rows('usuarios')[0]!.confianza = '15.00';
      await run(due, extra);
      expect(db.rows('usuarios')[0]!.confianza).toBe('15.00');
      expect(db.rows('devoluciones')).toHaveLength(0);
      expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
    },
  );

  it('conserva mora hasta el instante efectivo de pérdida, sin inventar devolución ni daño', async () => {
    const { db, run } = setup();
    await run(plus(10 * hour), {
      source: 'CLOSURE',
      actor,
      effectiveAt: plus(hour),
      loss: {
        condition: 'PERDIDO',
        reason: 'Pérdida confirmada',
        evidenceIds: ['evidence'],
      },
    });
    expect(db.rows('incumplimientos').map((r) => r.origen)).toEqual([
      'MORA',
      'PERDIDA',
    ]);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(2);
    // La incidencia por sí misma congela mora, incluso antes de conectar el cierre.
    await run(plus(100 * day));
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(2);
    db.rows('prestamos')[0]!.estado = 'CERRADO_POR_INCIDENCIA';
    expect(await run(plus(100 * day))).toMatchObject({
      stopped: 'LOAN_CLOSED',
      adjustmentIds: [],
    });
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(2);
  });

  it('una absolución impide nuevos escalamientos de ese episodio', async () => {
    const { db, run } = setup();
    await run(plus(1));
    db.rows('sanciones')[0]!.estado = 'ABSUELTA';
    await run(plus(3 * hour + 1));
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(1);
    expect(db.rows('usuarios')[0]!.confianza).toBe('70.00');
  });

  it('el motor cancela confirmadas pendientes y conserva el préstamo activo', async () => {
    const { db, run } = setup();
    db.rows('reservas').push({
      id: 'pending',
      usuarioId: 'user',
      ejemplarId: 'pending-copy',
      estado: 'CONFIRMADA',
      fechaRecogida: null,
    });
    db.rows('ejemplares').push({
      id: 'pending-copy',
      recursoId: 'resource',
      estado: 'RESERVADO',
      condicionFisica: 'APTO',
      habilitado: true,
    });
    // Esta prueba acredita la cancelación; sin catálogo activo la copia no se libera.
    const result = await run(plus(1));
    expect(result.cancelledReservationIds).toEqual(['pending']);
    expect(db.rows('reservas')[1]!.estado).toBe('CANCELADA');
    expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
    expect(db.rows('incumplimientos')).toHaveLength(1);
    expect(db.rows('incumplimientos')[0]!.origen).toBe('MORA');
  });

  it.each([
    'inspection',
    'missing-parts',
    'unclassified-missing',
    'evidence',
    'automation-context',
    'future-time',
    'duplicate-incident',
  ])('rechaza contexto no acreditado: %s', async (invalid) => {
    const { db, run } = setup();
    const extra: Partial<SynchronizeLoanEpisodes> = {
      source: 'CLOSURE',
      actor,
      damage: {
        damageSeverity: 'LEVE',
        missingSeverity: null,
        inspectionId: 'inspection',
        reason: 'Daño acreditado',
      },
    };
    if (invalid === 'inspection')
      extra.damage!.inspectionId = 'other-inspection';
    if (invalid === 'missing-parts') {
      extra.damage!.missingSeverity = 'MODERADA';
      db.rows('inspecciones_devolucion')[0]!.parts = [];
    }
    if (invalid === 'unclassified-missing')
      db.rows('inspecciones_devolucion')[0]!.parts[0].received = false;
    if (invalid === 'evidence') {
      delete extra.damage;
      extra.loss = {
        condition: 'PERDIDO',
        reason: 'Pérdida',
        evidenceIds: ['other-loan-evidence'],
      };
    }
    if (invalid === 'automation-context') extra.source = 'AUTOMATION';
    if (invalid === 'future-time') extra.effectiveAt = plus(day);
    if (invalid === 'duplicate-incident')
      extra.loss = {
        condition: 'PERDIDO',
        reason: 'Mismo incidente',
        evidenceIds: ['evidence'],
      };
    await expect(run(plus(1), extra)).rejects.toMatchObject({ status: 409 });
    expect(db.rows('incumplimientos')).toHaveLength(0);
    expect(db.rows('usuarios')[0]!.confianza).toBe('80.00');
  });

  it('bloquea usuario antes de préstamo y revierte toda la operación al fallar ajuste/auditoría', async () => {
    const { db, run } = setup();
    db.failAudit();
    await expect(run(plus(3 * hour + 1))).rejects.toThrow('audit unavailable');
    expect(db.rows('usuarios')[0]!.confianza).toBe('80.00');
    expect(db.rows('incumplimientos')).toHaveLength(0);
    expect(db.rows('sanciones')).toHaveLength(0);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(0);
    expect(db.calls[0]!.text).toContain('SHARE ROW EXCLUSIVE MODE NOWAIT');
    expect(db.calls.filter((p) => p.operation !== 'lock').slice(0, 2).map((p) => [p.table, p.operation])).toEqual([
      ['usuarios', 'update'],
      ['prestamos', 'update'],
    ]);
  });

  it.each([
    'missing-publication',
    'missing-version',
    'bad-range',
    'mismatched-reference',
    'zero-nominal',
  ])(
    'rechaza histórico no acreditado (%s) sin escrituras de dominio',
    async (invalid) => {
      const { db, run } = setup();
      if (invalid === 'missing-publication')
        db.rows('versiones_terminos').splice(0);
      if (invalid === 'missing-version')
        db.rows('versiones_regla').splice(0, 1);
      if (invalid === 'bad-range') {
        const row = db.rows('versiones_regla')[0]!;
        const metadata = JSON.parse(row.descripcion);
        metadata.criteria.delayHours.exclusiveMin = 5;
        row.descripcion = JSON.stringify(metadata);
      }
      if (invalid === 'mismatched-reference')
        db.rows('prestamos')[0]!.configurationSnapshot.reservationNoShow = {
          termsVersionId: 'other',
        };
      if (invalid === 'zero-nominal')
        db
          .rows('versiones_regla')
          .find(
            (v) => JSON.parse(v.descripcion).kind === 'LOSS',
          )!.penalizacionPorcentual = '100.00';
      await expect(run(plus(1))).rejects.toMatchObject({ status: 409 });
      expect(db.rows('incumplimientos')).toHaveLength(0);
      expect(db.rows('usuarios')[0]!.confianza).toBe('80.00');
    },
  );

  it('acepta referencia reservationNoShow transferida y fallback solo al confirmar reserva con categoría acreditada', async () => {
    const { db, prisma, reference } = setup();
    const reader = new HistoricalLoanPolicyReader(prisma),
      tx = db.client.runtime() as never;
    const snapshot = {
      reservationNoShow: { termsVersionId: reference.termsVersionId },
      policy: { categoryId: reference.categoryId },
    };
    expect(
      (await reader.read(tx, { snapshot, reservationId: 'reservation' }))
        .termsVersionId,
    ).toBe(reference.termsVersionId);
    db.rows('reservas')[0]!.configurationSnapshot = snapshot;
    expect(
      (
        await reader.read(tx, {
          snapshot: { schemaVersion: 1 },
          reservationId: 'reservation',
        })
      ).termsVersionId,
    ).toBe(reference.termsVersionId);
    delete db.rows('reservas')[0]!.configurationSnapshot;
    db.rows('versiones_terminos').push({
      id: 'new-publication',
      numero: 2,
      createdAt: instant(plus(day)),
      contenido: 'no manifest',
    });
    expect(
      (
        await reader.read(tx, {
          snapshot: { policy: snapshot.policy },
          reservationId: 'reservation',
        })
      ).termsVersionId,
    ).toBe(reference.termsVersionId);
    await expect(
      reader.read(tx, { snapshot: {}, reservationId: 'reservation' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      reader.read(tx, {
        snapshot: { policy: snapshot.policy },
        reservationId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('H3: detalle distingue inicial, objetivo y efectivo truncado tras escalas; legado sin ajustes', async () => {
    const { db, prisma, run } = setup('ELECTRONICOS', 5);
    await run(plus(1));
    const initial = { ...db.rows('sanciones')[0]! };
    db.rows('usuarios')[0]!.confianza = '80.00';
    await run(plus(3 * hour + 1));
    const repository = new PrismaSanctionRepository(prisma);
    const detail = (await repository.findDetail(initial.id))!;
    expect(detail.previousTrust).toBe(5);
    expect(detail.resultingTrust).toBe(0);
    expect(detail.ruleVersionId).toBe(initial.versionReglaId);
    expect(detail.rule!.penaltyPercentage).toBe(10);
    expect(detail.current).toMatchObject({
      severity: 'GRAVE', nominalPenaltyTotal: 30, effectivePenaltyTotal: 25,
      suspensionDays: 30, rule: { penaltyPercentage: 30, suspensionDays: 30 },
    });
    expect(detail.current!.rule.id).not.toBe(detail.ruleVersionId);
    expect(detail.current!.adjustments.map(a => a.effectiveDiscount)).toEqual([5, 10, 10]);
    expect(detail.current!.adjustments.map(a => a.nominalIncrement)).toEqual([10, 10, 10]);
    expect(detail.current!.adjustments.map(a => a.severity)).toEqual(['LEVE', 'MODERADA', 'GRAVE']);
    expect(db.rows('sanciones')[0]).toMatchObject({
      confianzaAnterior: initial.confianzaAnterior, confianzaPosterior: initial.confianzaPosterior,
      versionReglaId: initial.versionReglaId,
    });
    db.rows('sanciones')[0]!.estado = 'ABSUELTA';
    expect((await repository.findDetail(initial.id))!.current).toEqual(detail.current);
    db.rows('ajustes_incumplimiento').splice(0);
    const legacy = (await repository.findDetail(initial.id))!;
    expect(legacy.current).toBeNull();
    expect(legacy.ruleVersionId).toBe(initial.versionReglaId);
    expect(legacy.previousTrust).toBe(5);
  });

  it('apelación restituye suma efectiva de ajustes una vez, conserva iniciales y no repara ejemplar', async () => {
    const { db, prisma, run } = setup('ELECTRONICOS', 5);
    await run(plus(1));
    db.rows('usuarios')[0]!.confianza = '80.00';
    await run(plus(3 * hour + 1));
    const sanction = db.rows('sanciones')[0]!,
      initial = { ...sanction };
    db.rows('ejemplares')[0]!.condicionFisica = 'DANADO';
    db.rows('apelaciones').push({
      id: 'appeal',
      usuarioId: 'user',
      incumplimientoId: sanction.incumplimientoId,
      sancionId: sanction.id,
      estado: 'PENDIENTE',
      motivo: 'Error acreditado',
      fecha: instant(plus(4 * hour)),
      fechaResolucion: null,
      resolucion: null,
      resueltaPorCuentaId: null,
    });
    const repository = new PrismaAppealRepository(prisma);
    const resolution: ResolveAppealData = {
      appealId: 'appeal',
      status: AppealStatus.ACCEPTED,
      resolution: 'Error demostrado',
      resolvedAt: plus(5 * hour),
      resolvedByAccountId: 'admin',
    };
    await repository.resolve(resolution);
    expect(db.rows('usuarios')[0]!.confianza).toBe('85.00');
    expect(db.rows('sanciones')[0]).toMatchObject({
      estado: 'ABSUELTA',
      confianzaAnterior: initial.confianzaAnterior,
      confianzaPosterior: initial.confianzaPosterior,
    });
    expect(db.rows('ejemplares')[0]!.condicionFisica).toBe('DANADO');
    await expect(repository.resolve(resolution)).rejects.toMatchObject({
      status: 409,
    });
    expect(db.rows('usuarios')[0]!.confianza).toBe('85.00');
    await run(plus(50 * day));
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
  });
});
