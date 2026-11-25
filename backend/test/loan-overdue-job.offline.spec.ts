import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import {
  LoanOverdueService,
  OVERDUE_BATCH_SIZE,
  OVERDUE_MAX_BATCHES,
} from '../src/modules/loans/infrastructure/loan-overdue.service.js';
import type { LoanOverdueSynchronizer } from '../src/modules/loans/infrastructure/loan-overdue-synchronizer.js';
import {
  overdueFixture,
  overdueNow,
  overdueDay,
  overdueInstant,
} from './helpers/overdue-fixture.js';
import { LoanEpisodeEngine } from '../src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.js';

describe('automatización de mora local y acotada, sin DB', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(overdueNow);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function job() {
    const synchronizer = {
      candidates: vi.fn().mockResolvedValue([]),
      synchronizeLoan: vi.fn().mockResolvedValue(undefined),
    };
    return {
      synchronizer,
      service: new LoanOverdueService(
        synchronizer as unknown as LoanOverdueSynchronizer,
      ),
    };
  }

  it('ejecuta al iniciar y cada 60s; destruir detiene el temporizador', async () => {
    const { service, synchronizer } = job();
    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    expect(synchronizer.candidates).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(synchronizer.candidates).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(synchronizer.candidates).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(synchronizer.candidates).toHaveBeenCalledTimes(2);
  });

  it('no solapa invocaciones ni ticks con una unidad en curso', async () => {
    const { service, synchronizer } = job();
    let release!: () => void;
    synchronizer.candidates.mockResolvedValueOnce([
      { id: 'loan', usuarioId: 'user' },
    ]);
    synchronizer.synchronizeLoan.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const first = service.synchronize();
    await Promise.resolve();
    await service.synchronize();
    expect(synchronizer.candidates).toHaveBeenCalledTimes(1);
    release();
    await first;
    await service.synchronize();
    expect(synchronizer.candidates).toHaveBeenCalledTimes(2);
  });

  it('limita lotes y unidades, conserva cursor entre ciclos y reinicia el recorrido', async () => {
    const { service, synchronizer } = job();
    const total = OVERDUE_BATCH_SIZE * OVERDUE_MAX_BATCHES + 2;
    const rows = Array.from({ length: total }, (_, n) => ({
      id: String(n).padStart(4, '0'),
      usuarioId: 'user',
    }));
    synchronizer.candidates.mockImplementation((_at, limit, cursor) =>
      Promise.resolve(
        rows.filter((r) => !cursor || r.id > cursor).slice(0, limit),
      ),
    );
    await service.synchronize();
    expect(synchronizer.synchronizeLoan).toHaveBeenCalledTimes(100);
    expect(synchronizer.candidates).toHaveBeenCalledTimes(4);
    await service.synchronize();
    expect(synchronizer.synchronizeLoan).toHaveBeenCalledTimes(total);
    expect(synchronizer.candidates.mock.calls[4]![2]).toBe('0099');
    await service.synchronize();
    expect(synchronizer.candidates.mock.calls[5]![2]).toBeNull();
    expect(
      synchronizer.candidates.mock.calls.every(
        (c) => c[1] === OVERDUE_BATCH_SIZE,
      ),
    ).toBe(true);
  });

  it('un error no interrumpe el lote ni revela el error; reintenta en otro recorrido', async () => {
    const { service, synchronizer } = job();
    synchronizer.candidates.mockResolvedValue([
      { id: 'bad', usuarioId: 'user' },
      { id: 'good', usuarioId: 'user' },
    ]);
    synchronizer.synchronizeLoan.mockRejectedValueOnce(
      new Error('SQL PRIVADO'),
    );
    const warning = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    await service.synchronize();
    expect(synchronizer.synchronizeLoan).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warning.mock.calls)).not.toContain('SQL PRIVADO');
    await service.synchronize();
    expect(synchronizer.synchronizeLoan).toHaveBeenCalledTimes(4);
  });

  it('libera la exclusión tras fallo de consulta y detiene lotes tras destruir', async () => {
    const { service, synchronizer } = job();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    synchronizer.candidates.mockRejectedValueOnce(new Error('private'));
    await service.synchronize();
    await service.synchronize();
    expect(synchronizer.candidates).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    await service.synchronize();
    expect(synchronizer.candidates).toHaveBeenCalledTimes(2);
  });

  it('selecciona ACTIVO y fechaFin estrictamente pasada en DB, con cursor y límite antes de materializar', async () => {
    const { db, synchronizer } = overdueFixture();
    db.rows('prestamos').push(
      {
        id: 'closed',
        usuarioId: 'user',
        estado: 'FINALIZADO',
        fechaFin: overdueInstant(new Date(overdueNow.getTime() - 1)),
      },
      {
        id: 'exact',
        usuarioId: 'user',
        estado: 'ACTIVO',
        fechaFin: overdueInstant(overdueNow),
      },
      {
        id: 'future',
        usuarioId: 'user',
        estado: 'ACTIVO',
        fechaFin: overdueInstant(new Date(overdueNow.getTime() + 1)),
      },
    );
    expect(
      (await synchronizer.candidates(overdueNow, 1)).map((r) => r.id),
    ).toEqual(['loan']);
    const plan = db.calls.at(-1)!;
    expect(plan.limit).toBe(1);
    expect(
      plan.predicates.every((p) =>
        p({
          id: 'loan',
          usuarioId: 'user',
          estado: 'ACTIVO',
          fechaFin: overdueInstant(overdueNow),
        }),
      ),
    ).toBe(false);
    expect(await synchronizer.candidates(overdueNow, 25, 'loan')).toEqual([]);
    expect(
      await synchronizer.candidates(overdueNow, 25, null, 'other'),
    ).toEqual([]);
  });

  it('retraso reconstruye todos los tramos, repite sin duplicar, una tx por unidad y locks usuario primero', async () => {
    const { db, synchronizer } = overdueFixture();
    const transaction = vi.spyOn(db.client, 'transaction');
    const service = new LoanOverdueService(synchronizer);
    await service.synchronize();
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
    expect(db.rows('usuarios')[0]!.confianza).toBe('60.00');
    expect(transaction).toHaveBeenCalledTimes(1);
    const writes = db.calls.filter((c) => c.operation === 'update');
    expect(writes.slice(0, 4).map((c) => c.table)).toEqual([
      'usuarios',
      'prestamos',
      'usuarios',
      'prestamos',
    ]);
    expect(db.rows('ajustes_incumplimiento')[0]!.actor).toEqual({
      process: 'loan-overdue-synchronizer',
    });
    expect(db.rows('ajustes_incumplimiento')[0]!.contexto.source).toBe(
      'AUTOMATION',
    );
    await service.synchronize();
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
    expect(db.rows('prestamos')[0]!.estado).toBe('ACTIVO');
    expect(db.rows('ejemplares')[0]!.estado).toBe('PRESTADO');
  });

  it('>100 reales: cursor local alcanza la cola, recorre otra vez sin duplicar y respeta absolución', async () => {
    const { db, synchronizer } = overdueFixture();
    const first = db.rows('prestamos')[0]!;
    const copy = db.rows('ejemplares')[0]!;
    for (let n = 1; n < 102; n++) {
      const id = `extra-${String(n).padStart(4, '0')}`;
      db.rows('prestamos').push({ ...first, id, ejemplarId: `${id}-copy` });
      db.rows('ejemplares').push({ ...copy, id: `${id}-copy` });
    }
    const candidates = vi.spyOn(synchronizer, 'candidates');
    const service = new LoanOverdueService(synchronizer);
    await service.synchronize();
    expect(db.rows('incumplimientos')).toHaveLength(100);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(300);
    await service.synchronize();
    expect(candidates.mock.calls[4]![2]).toBe('extra-0100');
    expect(db.rows('incumplimientos')).toHaveLength(102);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(306);
    for (const sanction of db.rows('sanciones')) sanction.estado = 'ABSUELTA';
    await service.synchronize();
    expect(candidates.mock.calls[5]![2]).toBeNull();
    await service.synchronize();
    expect(db.rows('incumplimientos')).toHaveLength(102);
    expect(db.rows('sanciones')).toHaveLength(102);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(306);
    expect(
      new Set(db.rows('incumplimientos').map((r) => r.prestamoId)).size,
    ).toBe(102);
    expect(db.rows('incumplimientos').every((r) => r.origen === 'MORA')).toBe(
      true,
    );
    expect(db.rows('prestamos').every((r) => r.estado === 'ACTIVO')).toBe(true);
    expect(
      db.rows('ejemplares').filter((r) => r.estado === 'PRESTADO'),
    ).toHaveLength(102);
    expect(
      candidates.mock.calls.every((c) => c[1] === OVERDUE_BATCH_SIZE),
    ).toBe(true);
  });

  it('captura la hora después de esperar ambos bloqueos y no escala cerrado o absuelto', async () => {
    const { db, synchronizer } = overdueFixture();
    const runtime = db.client.runtime();
    const query = runtime.query.bind(runtime);
    const later = new Date(overdueNow.getTime() + overdueDay);
    vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (plan.table === 'prestamos' && plan.operation === 'update')
        vi.setSystemTime(later);
      return query(plan);
    });
    const engine = vi.spyOn(LoanEpisodeEngine.prototype, 'synchronize');
    await synchronizer.synchronizeLoan('user', 'loan');
    expect(engine.mock.calls[0]![2]).toEqual(later);
    db.rows('sanciones')[0]!.estado = 'ABSUELTA';
    const before = db.rows('ajustes_incumplimiento').length;
    await synchronizer.synchronizeLoan('user', 'loan');
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(before);
    db.rows('prestamos')[0]!.estado = 'FINALIZADO';
    await synchronizer.synchronizeLoan('user', 'loan');
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(before);
  });

  it('una absolución de tramo inicial detiene escalamiento posterior; cerrado no inicia episodio', async () => {
    const { db, synchronizer } = overdueFixture();
    db.rows('prestamos')[0]!.fechaFin = overdueInstant(
      new Date(overdueNow.getTime() - 1),
    );
    await synchronizer.synchronizeLoan('user', 'loan');
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(1);
    db.rows('sanciones')[0]!.estado = 'ABSUELTA';
    vi.setSystemTime(new Date(overdueNow.getTime() + 4 * overdueDay));
    await new LoanOverdueService(synchronizer).synchronize();
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(1);
    expect(db.rows('usuarios')[0]!.confianza).toBe('70.00');
    const closed = overdueFixture();
    closed.db.rows('prestamos')[0]!.estado = 'FINALIZADO';
    await closed.synchronizer.synchronizeLoan('user', 'loan');
    expect(closed.db.rows('ajustes_incumplimiento')).toHaveLength(0);
  });

  it('rollback de una unidad parcialmente ajustada no contamina la siguiente unidad del lote', async () => {
    const { db, synchronizer } = overdueFixture();
    db.rows('prestamos').push({ ...db.rows('prestamos')[0]!, id: '000-bad' });
    const runtime = db.client.runtime();
    const query = runtime.query.bind(runtime);
    let badAdjustments = 0;
    vi.spyOn(runtime, 'query').mockImplementation(async (plan) => {
      if (
        plan.table === 'ajustes_incumplimiento' &&
        plan.operation === 'insert' &&
        Array.isArray(plan.data) &&
        plan.data[0]!.contexto.loanId === '000-bad' &&
        ++badAdjustments === 2
      )
        throw new Error('private driver failure');
      return query(plan);
    });
    const warning = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const transaction = vi.spyOn(db.client, 'transaction');
    await new LoanOverdueService(synchronizer).synchronize();
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(db.rows('ajustes_incumplimiento')).toHaveLength(3);
    expect(
      db
        .rows('ajustes_incumplimiento')
        .every((r) => r.contexto.loanId === 'loan'),
    ).toBe(true);
    expect(db.rows('incumplimientos')).toHaveLength(1);
    expect(db.rows('usuarios')[0]!.confianza).toBe('60.00');
  });
});
