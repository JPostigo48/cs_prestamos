import 'reflect-metadata';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Temporal } from 'temporal-polyfill/full';
import { Test } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';
import { categoryPolicyFixture } from './helpers/category-policy-fixture.js';
import { PrismaLoanRepository } from '../src/modules/loans/infrastructure/persistence/prisma/prisma-loan.repository.js';
import { ReturnLoanUseCase } from '../src/modules/loans/application/use-cases/return-loan.use-case.js';
import { GetLoanUseCase } from '../src/modules/loans/application/use-cases/get-loan.use-case.js';
import { LoansController } from '../src/modules/loans/presentation/controllers/loans.controller.js';
import {
  ReturnLoanDto,
  CloseIncidentDto,
} from '../src/modules/loans/presentation/dto/return-loan.dto.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';
import type {
  CloseLoanData,
  ReturnCommand,
} from '../src/modules/loans/domain/entities/loan-closure.js';
import { LoanEpisodeEngine } from '../src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.js';

const uuid = (n: number) =>
  `123e4567-e89b-42d3-a456-${String(n).padStart(12, '0')}`;
const loanId = uuid(1),
  userId = uuid(2),
  copyId = uuid(3),
  categoryId = uuid(4),
  resourceId = uuid(5);
const actor = { accountId: uuid(6), userId: uuid(7) };
const part1 = uuid(8),
  part2 = uuid(9),
  evidence1 = uuid(10),
  evidence2 = uuid(11);
const now = new Date('2026-11-20T12:00:00.000Z');
const instant = (d: Date) => Temporal.Instant.from(d.toISOString());
const body = (n = 100): ReturnCommand => ({
  requestId: uuid(n),
  inspection: {
    parts: [
      { accessoryId: part1, received: true },
      { accessoryId: part2, received: true },
    ],
    condition: 'SANO',
    evidenceIds: [],
  },
});
const command = (n = 100): CloseLoanData => ({ ...body(n), loanId, actor });
const loss = (n = 101): CloseLoanData => ({
  loanId,
  actor,
  requestId: uuid(n),
  kind: 'PERDIDA',
  confirmed: true,
  description: 'Pérdida confirmada',
  evidenceIds: [evidence1],
});

function setup(category = 'ELECTRONICOS', trust = 80) {
  const fixture = categoryPolicyFixture(categoryId);
  for (const row of fixture.versiones_regla) {
    const metadata = JSON.parse(row.descripcion);
    if (metadata.category !== null)
      metadata.categoryId =
        metadata.category === category ? categoryId : uuid(900);
    row.descripcion = JSON.stringify(metadata);
  }
  const termsVersionId = fixture.versiones_terminos[0]!.id;
  const snapshot = {
    schemaVersion: 1,
    copyId,
    resourceId,
    loanPolicy: { categoryId, termsVersionId },
    policy: {
      categoryId,
      resourceId,
      source: 'CATEGORY',
      effectiveDurationHours: 8,
      durationHours: null,
    },
    accessories: [
      { id: part1, nombre: 'Cable histórico' },
      { id: part2, nombre: 'Estuche histórico' },
    ],
  };
  const db = inMemoryPrisma({
    ...fixture,
    usuarios: [
      { id: userId, confianza: trust.toFixed(2), vinculacionVigente: false },
    ],
    prestamos: [
      {
        id: loanId,
        usuarioId: userId,
        ejemplarId: copyId,
        reservaId: null,
        estado: 'ACTIVO',
        configurationSnapshot: snapshot,
      },
    ],
    ejemplares: [
      {
        id: copyId,
        recursoId: resourceId,
        estado: 'PRESTADO',
        habilitado: true,
        condicionFisica: 'APTO',
      },
    ],
    recursos: [{ id: resourceId, categoriaId: categoryId, activo: true }],
    categorias_recurso: [{ id: categoryId, activo: true }],
    evidencias_prestamo: [
      { id: evidence1, prestamoId: loanId, tipo: 'PERDIDA' },
      { id: evidence2, prestamoId: loanId, tipo: 'DANO' },
    ],
    reservas: [],
  });
  db.rows('prestamos')[0]!.fechaInicio = instant(
    new Date(now.getTime() - 3600000),
  );
  db.rows('prestamos')[0]!.fechaFin = instant(
    new Date(now.getTime() + 3600000),
  );
  const prisma = db as unknown as PrismaService;
  return {
    db,
    prisma,
    loans: new PrismaLoanRepository(prisma),
    snapshot,
    termsVersionId,
  };
}

/** Contención explícita, NO cola de transacciones ni aislamiento PostgreSQL.
 * La segunda transacción solo alcanza LOCK y falla antes de cualquier escritura.
 */
function holdInventoryBarrier(db: ReturnType<typeof inMemoryPrisma>) {
  let release!: () => void;
  let acquired!: () => void;
  let rejected!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    acquired = resolve;
  });
  const contended = new Promise<void>((resolve) => {
    rejected = resolve;
  });
  const transaction = db.client.transaction.bind(db.client);
  let held = false;
  let first = true;
  let failures = 0;
  vi.spyOn(db.client, 'transaction').mockImplementation(async (work) => {
    if (held) {
      return work({
        query: async (plan) => {
          expect(plan.operation).toBe('lock');
          expect(plan.text).toContain('SHARE ROW EXCLUSIVE MODE NOWAIT');
          db.calls.push(plan);
          failures++;
          rejected();
          throw new Error('query failed', { cause: { code: '55P03' } });
        },
      });
    }
    held = true;
    try {
      return await transaction((tx) =>
        work({
          query: async (plan) => {
            const rows = await tx.query(plan);
            if (first && plan.operation === 'lock') {
              first = false;
              acquired();
              await gate;
            }
            return rows;
          },
        }),
      );
    } finally {
      held = false;
    }
  });
  return {
    started,
    contended,
    release: () => release(),
    failures: () => failures,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('cierre integral offline: doble transaccional, NO aislamiento PostgreSQL', () => {
  it.each([
    ['ELECTRONICOS', 80, 3, 3, 83],
    ['LIBROS', 80, 1, 1, 81],
    ['DEPORTES', 80, 1, 1, 81],
    ['ELECTRONICOS', 99.5, 3, 0.5, 100],
    ['ELECTRONICOS', 100, 3, 0, 100],
  ])(
    'recompensa histórica %s saldo %s: calculada %s efectiva %s',
    async (category, trust, calculated, effective, resulting) => {
      const { db, loans } = setup(category as string, trust as number);
      const result = await loans.closeLoan(command());
      expect(result.reward).toMatchObject({
        eligible: true,
        calculatedPoints: calculated,
        effectivePoints: effective,
        previousTrust: trust,
        resultingTrust: resulting,
      });
      expect(db.rows('usuarios')[0]!.confianza).toBe(
        Number(resulting).toFixed(2),
      );
      expect(db.rows('cierres_prestamo')[0]!.recompensa).toEqual(result.reward);
      expect(result.copy).toMatchObject({
        estado: 'DISPONIBLE',
        condicionFisica: 'APTO',
      });
      expect(result.consequences).toEqual([]);
    },
  );

  it('usa aritmética de dos decimales y publicación, no tabla de categorías runtime', async () => {
    const { db, loans } = setup();
    const reward = db.rows('versiones_regla').find((v) => {
      const m = JSON.parse(v.descripcion);
      return m.kind === 'REWARD' && m.category === 'ELECTRONICOS';
    })!;
    const metadata = JSON.parse(reward.descripcion);
    metadata.criteria.reward.referencePoints = 12.35;
    reward.descripcion = JSON.stringify(metadata);
    expect((await loans.closeLoan(command())).reward).toMatchObject({
      calculatedPoints: 1.24,
      effectivePoints: 1.24,
      resultingTrust: 81.24,
    });
  });

  it('captura hora única después de bloqueos usuario/préstamo, ignora checklist antecedente como inspección final', async () => {
    const { db, loans } = setup();
    const runtime = db.client.runtime(),
      query = runtime.query.bind(runtime);
    const afterLocks = new Date(now.getTime() + 1234);
    vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      const rows = await query(plan);
      if (
        plan.table === 'prestamos' &&
        plan.operation === 'update' &&
        plan.data &&
        'id' in plan.data
      )
        vi.setSystemTime(afterLocks);
      return rows;
    });
    await loans.saveReturnChecklist({
      loanId,
      actorId: actor.userId,
      checkedAt: now,
      parts: [
        { accessoryId: part1, received: false },
        { accessoryId: part2, received: false },
      ],
    });
    const antecedent = JSON.stringify(db.rows('inspecciones_devolucion'));
    const result = await loans.closeLoan(command());
    expect(result.return!.returnedAt.toISOString()).toBe(
      afterLocks.toISOString(),
    );
    expect(result.closure!.effectiveAt).toBe(afterLocks.toISOString());
    expect(JSON.stringify(db.rows('inspecciones_devolucion'))).toBe(antecedent);
    expect(result.closure!.inspection!.parts.every((p) => p.received)).toBe(
      true,
    );
    const locks = db.calls
      .filter((c) => c.operation === 'update' && c.data && 'id' in c.data)
      .map((c) => c.table);
    expect(locks.slice(0, 2)).toEqual(['usuarios', 'prestamos']);
  });

  it.each(['SANO', 'DESGASTE_NORMAL'] as const)(
    '%s con comentario no es daño y no requiere elegibilidad',
    async (condition) => {
      const { db, loans } = setup();
      db.rows('sanciones').push({
        id: uuid(80),
        usuarioId: userId,
        estado: 'ACTIVA',
        fechaInicio: instant(now),
        fechaFin: null,
      });
      const data = body();
      data.inspection.condition = condition;
      data.observation = 'Comentario NO daño';
      const result = await loans.closeLoan({ ...data, loanId, actor });
      expect(result.copy!.estado).toBe('DISPONIBLE');
      expect(result.reward!.eligible).toBe(true);
      expect(db.rows('incumplimientos')).toHaveLength(0);
    },
  );

  it.each(['habilitado', 'recurso', 'categoria'])(
    'retiene devolución apta si %s está inactivo',
    async (which) => {
      const { db, loans } = setup();
      if (which === 'habilitado') db.rows('ejemplares')[0]!.habilitado = false;
      else
        db.rows(
          which === 'recurso' ? 'recursos' : 'categorias_recurso',
        )[0]!.activo = false;
      expect((await loans.closeLoan(command())).copy).toMatchObject({
        estado: 'NO_DISPONIBLE',
        condicionFisica: 'APTO',
      });
    },
  );

  it.each(['ACTIVO', 'PLANIFICADO'])(
    'no libera devolución apta con otro préstamo %s, aunque no tenga reserva',
    async (estado) => {
      const { db, loans } = setup();
      db.rows('prestamos').push({
        ...db.rows('prestamos')[0],
        id: uuid(70),
        estado,
      });
      const result = await loans.closeLoan(command());
      expect(result.copy).toMatchObject({
        estado: 'NO_DISPONIBLE',
        condicionFisica: 'APTO',
      });
      expect(db.rows('ejemplares')[0]!.estado).toBe('NO_DISPONIBLE');
      expect(db.rows('prestamos')[1]!.estado).toBe(estado);
    },
  );

  it.each([
    ['DANADO', true, 'DANADO'],
    ['SANO', false, 'INCOMPLETO'],
    ['DANADO', false, 'DANADO_E_INCOMPLETO'],
  ] as const)(
    'daño/faltantes único: %s completo=%s',
    async (condition, received, physical) => {
      const { db, loans } = setup();
      await loans.saveReturnChecklist({
        loanId,
        actorId: actor.userId,
        checkedAt: now,
        parts: body().inspection.parts,
      });
      const data = body();
      data.inspection = {
        ...data.inspection,
        condition,
        damageSeverity: 'MODERADA',
        description: 'Incidente final',
        evidenceIds: [evidence2],
        parts: data.inspection.parts.map((p) => ({ ...p, received })),
      };
      const result = await loans.closeLoan({ ...data, loanId, actor });
      expect(result.copy).toMatchObject({
        estado: 'NO_DISPONIBLE',
        condicionFisica: physical,
      });
      expect(db.rows('incumplimientos')).toHaveLength(1);
      expect(result.consequences).toHaveLength(1);
      expect(result.consequences![0]).toMatchObject({
        kind: 'DAMAGE',
        severity: 'MODERADA',
      });
      expect(result.reward).toMatchObject({
        eligible: false,
        effectivePoints: 0,
      });
      expect(
        db
          .rows('inspecciones_devolucion')[0]!
          .parts.every((p: { received: boolean }) => p.received),
      ).toBe(true);
    },
  );

  it('mora hasta cierre, conserva consecuencia y no recompensa; cancela reservas en misma transacción', async () => {
    const { db, loans } = setup();
    db.rows('prestamos')[0]!.fechaInicio = instant(
      new Date(now.getTime() - 48 * 3600000),
    );
    db.rows('prestamos')[0]!.fechaFin = instant(
      new Date(now.getTime() - 4 * 3600000),
    );
    db.rows('reservas').push({
      id: uuid(50),
      usuarioId: userId,
      ejemplarId: uuid(51),
      estado: 'CONFIRMADA',
      fechaRecogida: null,
    });
    db.rows('ejemplares').push({
      id: uuid(51),
      recursoId: resourceId,
      estado: 'RESERVADO',
      habilitado: true,
      condicionFisica: 'APTO',
    });
    // Segunda plantilla de la MISMA categoría: reproduce la antigua inversión
    // K -> R2 durante cancelación, antes de bloquear el ejemplar del cierre.
    db.rows('recursos').push({
      id: uuid(54),
      categoriaId: categoryId,
      activo: true,
    });
    db.rows('ejemplares').push({
      id: uuid(53),
      recursoId: uuid(54),
      estado: 'RESERVADO',
      habilitado: true,
      condicionFisica: 'APTO',
    });
    db.rows('reservas').push({
      id: uuid(52),
      usuarioId: userId,
      ejemplarId: uuid(53),
      estado: 'CONFIRMADA',
      fechaRecogida: null,
    });
    const result = await loans.closeLoan(command());
    expect(result.reward).toMatchObject({
      eligible: false,
      reason: 'MORA',
      calculatedPoints: 0,
      effectivePoints: 0,
    });
    expect(result.consequences).toHaveLength(1);
    expect(result.consequences![0]).toMatchObject({
      kind: 'LATENESS',
      severity: 'GRAVE',
      configuredPenaltyPoints: 30,
      effectivePenaltyTotal: 30,
      suspensionDays: 30,
    });
    expect(result.cancelledReservationIds).toEqual([uuid(50), uuid(52)]);
    expect(db.rows('reservas')[0]!.estado).toBe('CANCELADA');
    expect(db.rows('reservas')[1]!.estado).toBe('CANCELADA');
    const firstWrite = db.calls.findIndex((p) => p.operation === 'update');
    expect(
      db.calls
        .slice(0, firstWrite)
        .some(
          (p) =>
            p.text?.includes(
              'public.categorias_recurso, public.recursos, public.ejemplares',
            ) && p.text.includes('SHARE ROW EXCLUSIVE MODE NOWAIT'),
        ),
    ).toBe(true);
    expect(db.calls.some((p) => p.table === 'aceptaciones_terminos')).toBe(
      false,
    );
  });

  it('vencimiento exacto no es mora', async () => {
    const { db, loans } = setup();
    db.rows('prestamos')[0]!.fechaFin = instant(now);
    expect((await loans.closeLoan(command())).reward!.eligible).toBe(true);
  });

  it('permite parts vacío solo cuando snapshot acredita cero componentes', async () => {
    const { db, loans } = setup();
    db.rows('prestamos')[0]!.configurationSnapshot.accessories = [];
    const data = body();
    data.inspection.parts = [];
    expect(
      (await loans.closeLoan({ ...data, loanId, actor })).closure!.inspection!
        .parts,
    ).toEqual([]);
  });

  it('503 sin snapshot acreditable de componentes, no inventa lista vacía', async () => {
    const { db, loans } = setup();
    delete db.rows('prestamos')[0]!.configurationSnapshot.accessories;
    await expect(loans.readReturnPolicy(loanId)).rejects.toMatchObject({
      status: 503,
    });
    await expect(loans.closeLoan(command())).rejects.toMatchObject({
      status: 503,
    });
    expect(db.rows('cierres_prestamo')).toHaveLength(0);
  });

  it('motor rechaza gravedad distinta de la inspección FINAL persistida sin usar antecedente', async () => {
    const { db, prisma } = setup();
    await expect(
      db.client.transaction(async (tx) => {
        const transaction = tx as unknown as ReturnType<
          PrismaService['client']['runtime']
        >;
        await transaction.query(
          prisma.sql.public.cierres_prestamo
            .insert([
              {
                id: uuid(200),
                prestamoId: loanId,
                requestId: uuid(201),
                requestHash: '0'.repeat(64),
                actor,
                contexto: {},
                resultado: {},
                fechaEfectiva: instant(now),
                inspeccion: {
                  id: uuid(200),
                  parts: body().inspection.parts,
                  condition: 'DANADO',
                  damageSeverity: 'LEVE',
                  description: 'Final',
                },
              },
            ])
            .build(),
        );
        return new LoanEpisodeEngine(prisma).synchronize(
          tx as never,
          {
            userId,
            loanId,
            actor,
            source: 'CLOSURE',
            damage: {
              inspectionId: uuid(200),
              damageSeverity: 'GRAVE',
              missingSeverity: null,
              reason: 'Final',
            },
          },
          now,
        );
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.rows('cierres_prestamo')).toHaveLength(0);
    expect(db.rows('sanciones')).toHaveLength(0);
  });

  it('retry canónico mismo actor recupera original, jamás toca copia reservada después, GET concilia aun tras publicación rota', async () => {
    const { db, loans } = setup();
    const data = body();
    data.inspection.evidenceIds = [evidence2, uuid(12)];
    db.rows('evidencias_prestamo').push({
      id: uuid(12),
      prestamoId: loanId,
      tipo: 'DEVOLUCION',
    });
    const result = await loans.closeLoan({ ...data, loanId, actor });
    db.rows('ejemplares')[0]!.estado = 'RESERVADO';
    db.rows('usuarios')[0]!.confianza = '50.00';
    db.rows('versiones_terminos').splice(0);
    const before = db.calls.length;
    data.inspection.parts.reverse();
    data.inspection.evidenceIds.reverse();
    expect(await loans.closeLoan({ ...data, loanId, actor })).toEqual(result);
    expect(await loans.findById(loanId)).toEqual(result);
    expect(
      db.calls.slice(before).filter((c) => c.table === 'ejemplares'),
    ).toEqual([]);
    expect(db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
    expect(db.rows('usuarios')[0]!.confianza).toBe('50.00');
    expect(db.rows('cierres_prestamo')).toHaveLength(1);
  });

  it('normaliza mayúsculas de clave UUID antes de la unicidad e idempotencia', async () => {
    const { db, loans } = setup();
    const data = command();
    const result = await loans.closeLoan({
      ...data,
      requestId: data.requestId.toUpperCase(),
    });
    expect(await loans.closeLoan(data)).toEqual(result);
    expect(db.rows('cierres_prestamo')).toHaveLength(1);
    expect(result.closure!.requestId).toBe(data.requestId);
  });

  it.each(['same', 'actorAccount', 'actorUser', 'body', 'loan'])(
    'contención explícita y commit concurrente: %s recupera original o 409 sin tocar copia',
    async (change) => {
      const { db, loans } = setup();
      const barrier = holdInventoryBarrier(db);
      const first = loans.closeLoan(command());
      await barrier.started;
      const data = command();
      if (change === 'actorAccount')
        data.actor = { ...actor, accountId: uuid(60) };
      if (change === 'actorUser') data.actor = { ...actor, userId: uuid(60) };
      if (change === 'body' && 'inspection' in data) data.observation = 'Otro';
      if (change === 'loan') data.loanId = uuid(60);
      const second = loans.closeLoan(data).then(
        (result) => ({ result }),
        (error: unknown) => ({ error }),
      );
      await barrier.contended;
      barrier.release();
      const original = await first;
      // Otro escritor reutiliza la copia después del commit del primer cierre.
      db.rows('ejemplares')[0]!.estado = 'RESERVADO';
      db.rows('usuarios')[0]!.confianza = '50.00';
      const before = db.calls.length;
      const outcome = await second;
      expect(barrier.failures()).toBe(1);
      if (change === 'same') expect(outcome).toEqual({ result: original });
      else expect(outcome).toMatchObject({ error: { status: 409 } });
      expect(
        db.calls.slice(before).every((p) => p.operation === 'select'),
      ).toBe(true);
      expect(db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
      expect(db.rows('usuarios')[0]!.confianza).toBe('50.00');
      for (const table of [
        'cierres_prestamo',
        'devoluciones',
        'auditorias_usuario',
      ])
        expect(db.rows(table)).toHaveLength(1);
    },
  );

  it.each(['inventario', 'publicacion'])(
    'agota cinco transacciones por contención de %s: 503 sin efectos parciales',
    async (phase) => {
      const { db, loans } = setup();
      const tx = vi.spyOn(db.client, 'transaction');
      const runtime = db.client.runtime();
      const query = runtime.query.bind(runtime);
      let failures = 0;
      vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
        if (
          plan.text?.includes(
            phase === 'inventario'
              ? 'public.categorias_recurso'
              : 'public.reglas_uso',
          )
        ) {
          failures++;
          throw Object.assign(new Error('lock unavailable'), { code: '55P03' });
        }
        return query(plan);
      });
      await expect(loans.closeLoan(command())).rejects.toMatchObject({
        status: 503,
      });
      expect(failures).toBe(5);
      expect(tx).toHaveBeenCalledTimes(5);
      expect(
        db.calls.every((p) => ['select', 'lock'].includes(p.operation)),
      ).toBe(true);
      expect(db.rows('usuarios')[0]!.confianza).toBe('80.00');
      expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
      expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
      for (const table of [
        'cierres_prestamo',
        'devoluciones',
        'auditorias_usuario',
        'ajustes_incumplimiento',
      ])
        expect(db.rows(table)).toHaveLength(0);
    },
  );

  it('reintenta en transacciones nuevas y cierra si se libera la barrera sin cierre previo', async () => {
    const { db, loans } = setup();
    const transaction = vi.spyOn(db.client, 'transaction');
    const runtime = db.client.runtime();
    const query = runtime.query.bind(runtime);
    let failures = 0;
    vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (plan.operation === 'lock' && failures < 2) {
        failures++;
        throw Object.assign(new Error('busy'), { code: '55P03' });
      }
      return query(plan);
    });
    const result = await loans.closeLoan(command());
    expect(result.status).toBe('FINALIZADO');
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(db.rows('cierres_prestamo')).toHaveLength(1);
    expect(db.rows('devoluciones')).toHaveLength(1);
    expect(db.rows('usuarios')[0]!.confianza).toBe('83.00');
  });

  it.each(['same', 'actor', 'hash'])(
    'concilia commit visible tras última contención y valida %s antes de 503',
    async (change) => {
      const committed = setup();
      const original = await committed.loans.closeLoan(command());
      const closure = committed.db.rows('cierres_prestamo')[0]!;
      const { db, loans } = setup();
      const data = command();
      if (change === 'actor') data.actor = { ...actor, accountId: uuid(60) };
      if (change === 'hash' && 'inspection' in data) data.observation = 'Otro';
      let attempts = 0;
      // Simula exclusivamente la visibilidad del commit tras rollback del LOCK.
      // No ejecuta escrituras de dos transacciones simultáneas en el doble.
      vi.spyOn(db.client, 'transaction').mockImplementation(async (work) => {
        attempts++;
        try {
          return await work({
            query: async (plan) => {
              expect(plan.operation).toBe('lock');
              throw Object.assign(new Error('busy'), { code: '55P03' });
            },
          });
        } finally {
          if (attempts === 5) {
            db.rows('cierres_prestamo').push(closure);
            db.rows('ejemplares')[0]!.estado = 'RESERVADO';
          }
        }
      });
      if (change === 'same')
        expect(await loans.closeLoan(data)).toEqual(original);
      else
        await expect(loans.closeLoan(data)).rejects.toMatchObject({
          status: 409,
        });
      expect(attempts).toBe(5);
      expect(db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
      expect(db.calls.every((p) => p.operation === 'select')).toBe(true);
    },
  );

  it('revalida resultado confirmado entre lectura externa y adquisición de barrera sin escrituras', async () => {
    const committed = setup();
    const original = await committed.loans.closeLoan(command());
    const { db, loans } = setup();
    const transaction = db.client.transaction.bind(db.client);
    vi.spyOn(db.client, 'transaction').mockImplementationOnce(async (work) => {
      db.rows('cierres_prestamo').push(
        committed.db.rows('cierres_prestamo')[0]!,
      );
      db.rows('ejemplares')[0]!.estado = 'RESERVADO';
      return transaction(work);
    });
    expect(await loans.closeLoan(command())).toEqual(original);
    expect(
      db.calls.every((p) => ['select', 'lock'].includes(p.operation)),
    ).toBe(true);
    expect(db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
  });

  it.each(['40P01', '40001', '08006', 'unknown', 'conflict'])(
    'no reintenta ni disfraza error genuino de barrera %s',
    async (code) => {
      const { db, loans } = setup();
      const transaction = vi.spyOn(db.client, 'transaction');
      const runtime = db.client.runtime();
      const query = runtime.query.bind(runtime);
      const error =
        code === 'conflict'
          ? new ConflictException('Otro conflicto')
          : Object.assign(new Error('genuine failure'), { code });
      vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
        if (plan.operation === 'lock') throw error;
        return query(plan);
      });
      await expect(loans.closeLoan(command())).rejects.toBe(error);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(db.rows('cierres_prestamo')).toHaveLength(0);
    },
  );

  it('no reintenta un 55P03 fuera de barrera ni conflicto semántico; rollback completo', async () => {
    const { db, loans } = setup();
    const transaction = vi.spyOn(db.client, 'transaction');
    const runtime = db.client.runtime();
    const query = runtime.query.bind(runtime);
    const error = Object.assign(new Error('row lock failed'), {
      code: '55P03',
    });
    vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (plan.table === 'auditorias_usuario' && plan.operation === 'insert')
        throw error;
      return query(plan);
    });
    await expect(loans.closeLoan(command())).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(db.rows('cierres_prestamo')).toHaveLength(0);
    expect(db.rows('devoluciones')).toHaveLength(0);
    expect(db.rows('usuarios')[0]!.confianza).toBe('80.00');
    expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
    db.rows('prestamos')[0]!.estado = 'FINALIZADO';
    await expect(loans.closeLoan(command())).rejects.toMatchObject({
      status: 409,
    });
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it.each(['actorAccount', 'actorUser', 'body', 'otherKey', 'otherLoan'])(
    '409 por idempotencia incompatible: %s',
    async (change) => {
      const { db, loans } = setup();
      await loans.closeLoan(command());
      let data = command();
      if (change === 'actorAccount')
        data.actor = { ...actor, accountId: uuid(60) };
      if (change === 'actorUser') data.actor = { ...actor, userId: uuid(60) };
      if (change === 'body' && 'inspection' in data)
        data.observation = 'Otro cuerpo';
      if (change === 'otherKey') data.requestId = uuid(60);
      if (change === 'otherLoan') {
        db.rows('prestamos').push({
          ...db.rows('prestamos')[0],
          id: uuid(60),
          estado: 'ACTIVO',
        });
        data = { ...data, loanId: uuid(60) };
      }
      await expect(loans.closeLoan(data)).rejects.toMatchObject({
        status: 409,
      });
      expect(db.rows('devoluciones')).toHaveLength(1);
    },
  );

  it.each(['PERDIDA', 'ROBO'] as const)(
    '%s no inventa devolución/recompensa y fija cero/indefinida',
    async (kind) => {
      const { db, loans } = setup();
      const data = { ...loss(), kind };
      const result = await loans.closeLoan(data);
      expect(result.status).toBe('CERRADO_POR_INCIDENCIA');
      expect(result.return).toBeNull();
      expect(result.reward).toBeNull();
      expect(result.copy).toMatchObject({
        estado: 'NO_DISPONIBLE',
        condicionFisica: kind === 'PERDIDA' ? 'PERDIDO' : 'ROBADO',
      });
      expect(result.consequences![0]).toMatchObject({
        kind: 'LOSS',
        configuredPenaltyPoints: null,
        suspensionType: 'INDEFINIDA',
        endsAt: null,
      });
      expect(db.rows('usuarios')[0]!.confianza).toBe('0.00');
      expect(db.rows('devoluciones')).toHaveLength(0);
      expect(await loans.closeLoan(data)).toEqual(result);
      await expect(loans.closeLoan(command())).rejects.toMatchObject({
        status: 409,
      });
    },
  );

  it('pérdida acumula mora solo hasta cierre; sincronización futura no cobra ni inventa recompensa', async () => {
    const { db, loans, prisma } = setup();
    db.rows('prestamos')[0]!.fechaFin = instant(new Date(now.getTime() - 1));
    const result = await loans.closeLoan(loss());
    expect(result.consequences!.map((c) => c.kind).sort()).toEqual([
      'LATENESS',
      'LOSS',
    ]);
    const count = db.rows('ajustes_incumplimiento').length;
    const later = new Date(now.getTime() + 10 * 86400000);
    const synchronized = await db.client.transaction((tx) =>
      new LoanEpisodeEngine(prisma).synchronize(
        tx as never,
        { loanId, userId, actor: { process: 'test' }, source: 'AUTOMATION' },
        later,
      ),
    );
    expect(synchronized.stopped).toBe('LOAN_CLOSED');
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(count);
    expect((await loans.findById(loanId))!.reward).toBeNull();
  });

  it.each([true, false])(
    'pérdida vs devolución: un solo cierre, orden pérdida primero=%s (cola del doble, no PostgreSQL)',
    async (lossFirst) => {
      const { db, loans } = setup();
      const transaction = db.client.transaction.bind(db.client);
      let queue: Promise<unknown> = Promise.resolve();
      db.client.transaction = (work) => {
        const result = queue.then(() => transaction(work));
        queue = result.catch(() => {});
        return result;
      };
      const data = lossFirst ? [loss(), command()] : [command(), loss()];
      const results = await Promise.allSettled(
        data.map((d) => loans.closeLoan(d)),
      );
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
      expect(db.rows('cierres_prestamo')).toHaveLength(1);
      expect(db.rows('devoluciones')).toHaveLength(lossFirst ? 0 : 1);
    },
  );

  it.each([
    'auditorias_usuario',
    'devoluciones',
    'ejemplares',
    'cierres_prestamo',
  ])('rollback total al fallar %s después de aplicar motor', async (table) => {
    const { db, loans } = setup();
    db.rows('prestamos')[0]!.fechaFin = instant(new Date(now.getTime() - 1));
    const runtime = db.client.runtime(),
      query = runtime.query.bind(runtime);
    vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (
        plan.table === table &&
        (table === 'cierres_prestamo' || table === 'ejemplares'
          ? plan.operation === 'update' && plan.data && !('id' in plan.data)
          : plan.operation === 'insert')
      )
        throw new Error('injected failure');
      return query(plan);
    });
    await expect(loans.closeLoan(command())).rejects.toThrow(
      'injected failure',
    );
    for (const name of [
      'devoluciones',
      'cierres_prestamo',
      'incumplimientos',
      'ajustes_incumplimiento',
      'sanciones',
      'auditorias_usuario',
    ])
      expect(db.rows(name), name).toHaveLength(0);
    expect(db.rows('usuarios')[0]!.confianza).toBe('80.00');
    expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
    expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
  });

  it('GET policy solo lee históricos incluso versiones retiradas/punteros actuales cambiados', async () => {
    const { db, loans, termsVersionId } = setup();
    for (const row of db.rows('versiones_regla')) row.estado = 'INACTIVA';
    for (const row of db.rows('reglas_uso')) row.versionVigenteId = 'other';
    const policy = await loans.readReturnPolicy(loanId);
    expect(policy).toMatchObject({
      loanId,
      termsVersionId,
      categoryId,
      policySource: 'LOAN_SNAPSHOT',
      serverNow: now.toISOString(),
      lateness: {
        automatic: true,
        currentSeverity: null,
        targetSeverity: null,
      },
    });
    expect(policy.accessories[0]!.nombre).toBe('Cable histórico');
    expect(policy.damageOptions.every((p) => p.versionId === p.id)).toBe(true);
    expect(db.calls.every((c) => c.operation === 'select')).toBe(true);
  });

  it('GET responde 503 ante fallo de persistencia, sin escrituras', async () => {
    const { db, loans } = setup();
    vi.spyOn(db.client.runtime(), 'query').mockRejectedValue(
      new Error('offline unavailable'),
    );
    await expect(loans.readReturnPolicy(loanId)).rejects.toMatchObject({
      status: 503,
    });
    expect(db.rows('cierres_prestamo')).toHaveLength(0);
  });

  it('GET muestra mora actual/objetivo sin aplicar el objetivo', async () => {
    const { db, loans, prisma } = setup();
    const due = new Date(now.getTime() - 1);
    db.rows('prestamos')[0]!.fechaFin = instant(due);
    await db.client.transaction((tx) =>
      new LoanEpisodeEngine(prisma).synchronize(
        tx as never,
        { userId, loanId, actor: { process: 'test' }, source: 'AUTOMATION' },
        now,
      ),
    );
    vi.setSystemTime(new Date(now.getTime() + 4 * 3600000));
    const before = db.rows('ajustes_incumplimiento').length;
    expect((await loans.readReturnPolicy(loanId)).lateness).toMatchObject({
      currentSeverity: 'LEVE',
      targetSeverity: 'GRAVE',
      appliedPenaltyPoints: 10,
      targetPenaltyPoints: 30,
    });
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(before);
  });

  it('503 si no se acredita publicación/componentes; ningún cierre retroactivo de legado', async () => {
    const { db, loans } = setup();
    db.rows('versiones_terminos').splice(0);
    await expect(loans.readReturnPolicy(loanId)).rejects.toMatchObject({
      status: 503,
    });
    await expect(loans.closeLoan(command())).rejects.toMatchObject({
      status: 503,
    });
    db.rows('prestamos')[0]!.estado = 'FINALIZADO';
    expect((await loans.findById(loanId))!.closure).toBeNull();
    await expect(loans.closeLoan(command())).rejects.toMatchObject({
      status: 409,
    });
    expect(db.rows('cierres_prestamo')).toHaveLength(0);
  });
});

describe('HTTP cierre: DTO whitelist y guards reales de roles, sin entorno ni DB', () => {
  let app: INestApplication;
  let context: ReturnType<typeof setup>;
  beforeEach(async () => {
    context = setup();
    const tokens = Array.from(
      { length: 12 },
      (_, i) => `closure-dependency-${i}`,
    );
    Reflect.defineMetadata('design:paramtypes', tokens, LoansController);
    for (const [name, types] of [
      ['registerReturn', [String, ReturnLoanDto, Object]],
      ['closeIncident', [String, CloseIncidentDto, Object]],
      ['returnPolicy', [String]],
      ['getById', [String, Object]],
    ] as const)
      Reflect.defineMetadata(
        'design:paramtypes',
        types,
        LoansController.prototype,
        name,
      );
    const values = tokens.map(() => ({}));
    values[0] = new ReturnLoanUseCase(context.loans);
    values[1] = new GetLoanUseCase(context.loans);
    const module = await Test.createTestingModule({
      controllers: [LoansController],
      providers: tokens.map((provide, i) => ({ provide, useValue: values[i] })),
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          const role = req.headers['x-test-role'];
          if (!role) throw new UnauthorizedException();
          req.user = {
            ...actor,
            accountId: req.headers['x-test-account'] ?? actor.accountId,
            userId: actor.userId,
            role,
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });
  const url = (suffix = 'return') => `/loans/${loanId}/${suffix}`;
  const send = (value: object, suffix = 'return', role = AccessRole.OPERATOR) =>
    request(app.getHttpServer())
      .post(url(suffix))
      .set('x-test-role', role)
      .send(value);

  it('GET policy 401/403/404/503; operador/admin pueden leer sin escrituras', async () => {
    await request(app.getHttpServer()).get(url('return-policy')).expect(401);
    await request(app.getHttpServer())
      .get(url('return-policy'))
      .set('x-test-role', AccessRole.USER)
      .expect(403);
    for (const role of [AccessRole.OPERATOR, AccessRole.ADMINISTRATOR])
      await request(app.getHttpServer())
        .get(url('return-policy'))
        .set('x-test-role', role)
        .expect(200);
    expect(context.db.calls.every((c) => c.operation === 'select')).toBe(true);
    await request(app.getHttpServer())
      .get(`/loans/${uuid(999)}/return-policy`)
      .set('x-test-role', AccessRole.OPERATOR)
      .expect(404);
    context.db.rows('versiones_terminos').splice(0);
    await request(app.getHttpServer())
      .get(url('return-policy'))
      .set('x-test-role', AccessRole.OPERATOR)
      .expect(503);
  });

  it.each([
    'returnedAt',
    'ruleVersionId',
    'penaltyPoints',
    'categoryId',
    'actor',
    'actorAccountId',
  ])('rechaza campo cliente %s', async (field) => {
    await send({ ...body(), [field]: uuid(999) }).expect(400);
    expect(context.db.rows('cierres_prestamo')).toHaveLength(0);
  });

  it.each([
    {},
    { requestId: uuid(100) },
    { ...body(), requestId: 'bad' },
    { ...body(), inspection: null },
    { ...body(), inspection: {} },
    { ...body(), inspection: { ...body().inspection, parts: [] } },
    {
      ...body(),
      inspection: {
        ...body().inspection,
        parts: [body().inspection.parts[0], body().inspection.parts[0]],
      },
    },
    {
      ...body(),
      inspection: {
        ...body().inspection,
        parts: [{ accessoryId: part1, received: 'true' }],
      },
    },
    { ...body(), inspection: { ...body().inspection, damageSeverity: 'LEVE' } },
    { ...body(), inspection: { ...body().inspection, condition: 'DANADO' } },
    {
      ...body(),
      inspection: {
        ...body().inspection,
        condition: 'DANADO',
        damageSeverity: 'LEVE',
        description: '  ',
      },
    },
    { ...body(), inspection: { ...body().inspection, evidenceIds: undefined } },
    {
      ...body(),
      inspection: { ...body().inspection, evidenceIds: [evidence2, evidence2] },
    },
    {
      ...body(),
      inspection: { ...body().inspection, evidenceIds: [uuid(999)] },
    },
    {
      ...body(),
      inspection: { ...body().inspection, evidenceIds: [evidence1] },
    },
    { ...body(), observation: 'x'.repeat(1001) },
    {
      ...body(),
      inspection: { ...body().inspection, description: 'x'.repeat(1001) },
    },
    { ...body(), inspection: { ...body().inspection, actor: actor } },
    { ...body(), inspection: { ...body().inspection, parts: 'bad' } },
    { ...body(), inspection: { ...body().inspection, parts: [null, null] } },
  ])('400 inspección inválida caso %#, sin escrituras', async (value) => {
    await send(value).expect(400);
    expect(context.db.rows('cierres_prestamo')).toHaveLength(0);
  });

  it('201 original y reintento; GET concilia; cuerpo/actor/clave diferente 409', async () => {
    const first = await send(body()).expect(201);
    expect((await send(body()).expect(201)).body).toEqual(first.body);
    const fetched = await request(app.getHttpServer())
      .get(`/loans/${loanId}`)
      .set('x-test-role', AccessRole.OPERATOR)
      .expect(200);
    expect(fetched.body).toEqual(first.body);
    await send({ ...body(), observation: 'different' }).expect(409);
    await request(app.getHttpServer())
      .post(url())
      .set('x-test-role', AccessRole.OPERATOR)
      .set('x-test-account', uuid(999))
      .send(body())
      .expect(409);
    await send(body(999)).expect(409);
    expect(first.body.closure.actorAccountId).toBe(actor.accountId);
  });

  it('H1: cierre legado serializado pasa el consumidor real y GET/replay sin repetir efectos', async () => {
    const original = context.db.rows('prestamos')[0]!;
    const complete = structuredClone(original.configurationSnapshot);
    delete original.configurationSnapshot.accessories;
    const partial = structuredClone(original.configurationSnapshot);
    original.reservaId = uuid(80);
    context.db.rows('reservas').push({ id: uuid(80), configurationSnapshot: complete });
    const policy = await request(app.getHttpServer()).get(url('return-policy'))
      .set('x-test-role', AccessRole.OPERATOR).expect(200);
    expect(policy.body.accessories).toEqual(complete.accessories);
    const first = await send(body()).expect(201);
    const trust = context.db.rows('usuarios')[0]!.confianza;
    const effects = ['cierres_prestamo', 'devoluciones', 'ajustes_incumplimiento', 'auditorias_usuario']
      .map(table => context.db.rows(table).length);
    const fetched = await request(app.getHttpServer()).get(`/loans/${loanId}`)
      .set('x-test-role', AccessRole.OPERATOR).expect(200);
    const replay = await send(body()).expect(201);
    expect(fetched.body).toEqual(first.body);
    expect(replay.body).toEqual(first.body);
    expect(first.body.configurationSnapshot).toEqual(complete);
    expect(original.configurationSnapshot).toEqual(partial);
    expect(context.db.rows('usuarios')[0]!.confianza).toBe(trust);
    expect(['cierres_prestamo', 'devoluciones', 'ajustes_incumplimiento', 'auditorias_usuario']
      .map(table => context.db.rows(table).length)).toEqual(effects);
    // Usa los validadores frontend sin duplicar su contrato ni fabricar la respuesta.
    const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { readFileSync } from 'node:fs';
      import { load } from '../frontend/tests/helpers/modules.mjs';
      const { validLoan } = await load('modules/loans/api/loan-contracts');
      const { validReturnPolicy } = await load('modules/loans/api/closure-contracts');
      const data = JSON.parse(readFileSync(0, 'utf8'));
      if (!data.loans.every(validLoan) || !validReturnPolicy(data.policy, data.loans[0].id)) process.exit(1);
    `], { cwd: process.cwd(), input: JSON.stringify({ loans: [first.body, fetched.body, replay.body], policy: policy.body }), encoding: 'utf8' });
    expect(probe.stderr).toBe('');
    expect(probe.status).toBe(0);
  });

  it('dos HTTP concurrentes con contención NOWAIT explícita devuelven el mismo 201 tras commit', async () => {
    const barrier = holdInventoryBarrier(context.db);
    const first = send(body())
      .expect(201)
      .then((response) => response);
    await barrier.started;
    const second = send(body())
      .expect(201)
      .then((response) => response);
    await barrier.contended;
    barrier.release();
    const original = await first;
    context.db.rows('ejemplares')[0]!.estado = 'RESERVADO';
    expect((await second).body).toEqual(original.body);
    expect(barrier.failures()).toBe(1);
    expect(context.db.rows('ejemplares')[0]!.estado).toBe('RESERVADO');
    expect(context.db.rows('cierres_prestamo')).toHaveLength(1);
  });

  it('rechaza evidencia existente perteneciente a otro préstamo', async () => {
    context.db.rows('evidencias_prestamo')[1]!.prestamoId = uuid(999);
    const value = body();
    value.inspection.evidenceIds = [evidence2];
    await send(value).expect(400);
    expect(context.db.rows('cierres_prestamo')).toHaveLength(0);
  });

  it.each([
    {
      requestId: uuid(100),
      kind: 'PERDIDA',
      confirmed: false,
      description: 'Pérdida',
      evidenceIds: [],
    },
    {
      requestId: uuid(100),
      kind: 'PERDIDA',
      confirmed: true,
      description: '',
      evidenceIds: [],
    },
    {
      requestId: uuid(100),
      kind: 'PERDIDA',
      confirmed: true,
      description: 'x'.repeat(1001),
      evidenceIds: [],
    },
    {
      requestId: uuid(100),
      kind: 'PERDIDA',
      confirmed: true,
      description: 'Pérdida',
    },
    {
      requestId: uuid(100),
      kind: 'PERDIDA',
      confirmed: true,
      description: 'Pérdida',
      evidenceIds: [],
      returnedAt: now.toISOString(),
    },
    {
      requestId: uuid(100),
      kind: 'PERDIDA',
      confirmed: true,
      description: 'Pérdida',
      evidenceIds: [],
      damageSeverity: 'GRAVE',
    },
  ])('400 incidencia inválida caso %#', async (value) => {
    await send(value, 'close-incident').expect(400);
  });

  it('incidencia 201 incluso evidencia vacía explícita; roles no autorizados 403', async () => {
    const value = {
      requestId: uuid(100),
      kind: 'ROBO',
      confirmed: true,
      description: 'Robo confirmado',
      evidenceIds: [],
    };
    await send(value, 'close-incident', AccessRole.USER).expect(403);
    await send(body(), 'return', AccessRole.USER).expect(403);
    const first = await send(
      value,
      'close-incident',
      AccessRole.ADMINISTRATOR,
    ).expect(201);
    expect(first.body.status).toBe('CERRADO_POR_INCIDENCIA');
    expect(
      (
        await send(value, 'close-incident', AccessRole.ADMINISTRATOR).expect(
          201,
        )
      ).body,
    ).toEqual(first.body);
  });
});
