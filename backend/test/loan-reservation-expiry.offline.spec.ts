import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import { PrismaReservationRepository } from '../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.js';
import { ReservationExpiryService } from '../src/modules/loans/infrastructure/reservation-expiry.service.js';
import { LoanOverdueSynchronizer } from '../src/modules/loans/infrastructure/loan-overdue-synchronizer.js';
import { SchemaCapabilityUnavailableException } from '../src/shared/infrastructure/prisma/schema-capabilities.js';
import * as noShow from '../src/modules/loans/infrastructure/integration/reservation-no-show.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';

const now = new Date('2026-11-26T12:00:00Z');
const privateMessage = 'SQL PRIVADO, titular y URL privada';

describe('H3: monitor de vencimiento de reservas entre páginas, sin DB', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.spyOn(LoanOverdueSynchronizer.prototype, 'synchronizeUser').mockResolvedValue(undefined);
    vi.spyOn(LoanOverdueSynchronizer.prototype, 'recheckLocked').mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function fixture(total: number) {
    const db = inMemoryPrisma({
      usuarios: [{ id: 'user', vinculacionVigente: true }],
      reservas: Array.from({ length: total }, (_, n) => ({
        id: String(n).padStart(4, '0'), usuarioId: 'user', ejemplarId: `copy-${n}`,
        estado: 'CONFIRMADA', duracionPrestamoHoras: 8,
        fechaSolicitada: null, fechaLimiteRecogida: null,
        fechaRecogida: null, fechaCancelacion: null,
      })),
      ejemplares: Array.from({ length: total }, (_, n) => ({
        id: `copy-${n}`, recursoId: 'resource', estado: 'RESERVADO',
        condicionFisica: 'APTO', habilitado: true,
      })),
      recursos: [{ id: 'resource', categoriaId: 'category', activo: true }],
      categorias_recurso: [{ id: 'category', activo: true }],
    });
    for (const row of db.rows('reservas')) {
      row.fechaSolicitada = Temporal.Instant.from('2026-11-26T10:00:00Z');
      row.fechaLimiteRecogida = Temporal.Instant.from('2026-11-26T10:30:00Z');
    }
    const repository = new PrismaReservationRepository(db as any);
    const service = new ReservationExpiryService(repository);
    const register = vi.spyOn(noShow, 'registerReservationNoShow').mockResolvedValue(undefined);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    return { db, repository, service, register, warn, log };
  }

  it.each([100, 101])('%i candidatos: persiste varios ticks, recordatorio a 15min y recuperación real única', async total => {
    const { db, service, register, warn, log } = fixture(total);
    register.mockRejectedValue(new Error(privateMessage));
    for (let tick = 0; tick < 8; tick++) {
      await service.expire();
      await vi.advanceTimersByTimeAsync(60_000);
    }
    expect(register).toHaveBeenCalledTimes(total * 8); // 4 recorridos, dos intentos por unidad.
    expect(db.rows('reservas').every(r => r.estado === 'CONFIRMADA')).toBe(true);
    expect(db.rows('ejemplares').every(r => r.estado === 'RESERVADO')).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();

    vi.setSystemTime(new Date(now.getTime() + 15 * 60_000));
    await service.expire(); // Nuevo recorrido fallido, primera página.
    expect(warn).toHaveBeenCalledTimes(2);
    register.mockResolvedValue(undefined);
    await service.expire(); // Cola limpia (vacía para 100) NO acredita recuperación.
    expect(warn).toHaveBeenCalledTimes(2);
    expect(log).not.toHaveBeenCalled();
    await service.expire(); // Página completa limpia: todavía no terminó el recorrido.
    expect(log).not.toHaveBeenCalled();
    await service.expire();
    expect(log).toHaveBeenCalledTimes(1);
    expect(db.rows('reservas').every(r => r.estado === 'VENCIDA')).toBe(true);
    expect(db.rows('ejemplares').every(r => r.estado === 'DISPONIBLE')).toBe(true);
    await service.expire();
    await service.expire();
    expect(log).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(privateMessage);
    const pages = db.calls.filter(p => p.table === 'reservas' && p.operation === 'select' && p.order);
    expect(pages).toHaveLength(14);
    expect(pages.every(p => p.limit === 100)).toBe(true);
    expect(pages.every(p => p.order?.[0]?.key === 'id' && p.order[0].direction === 'asc')).toBe(true);
  });

  it.each([100, 101])('%i candidatos: un fallo inicial no se oculta por éxitos posteriores', async total => {
    const { db, service, register, warn, log } = fixture(total);
    let broken = true;
    register.mockImplementation(async (_prisma, _tx, row) => {
      if (broken && row.id === '0000') throw new Error(privateMessage);
    });
    await service.expire();
    await service.expire();
    expect(db.rows('reservas').filter(r => r.estado === 'VENCIDA')).toHaveLength(total - 1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    await service.expire(); // Reintenta realmente la unidad fallida.
    expect(log).not.toHaveBeenCalled();
    broken = false;
    await service.expire();
    expect(log).toHaveBeenCalledTimes(1);
    expect(db.rows('reservas').every(r => r.estado === 'VENCIDA')).toBe(true);
  });

  it('coordina fallos globales y unitarios distintos sin duplicar avisos ni recuperar en una página', async () => {
    const { db, repository, service, register, warn, log } = fixture(100);
    register.mockRejectedValue(new Error(privateMessage));
    await repository.expire(now); // También comparte estado con invocaciones fuera del timer.
    const capability = vi.spyOn(db.schemaCapabilities, 'assert');
    capability.mockRejectedValueOnce(new SchemaCapabilityUnavailableException('reservations.expire', 'SCHEMA_INCOMPLETE'));
    await service.expire();
    await service.expire(); // Cola vacía del recorrido fallido.
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]![0]).toContain('OPERATION_FAILURE');
    expect(warn.mock.calls[1]![0]).toContain('SCHEMA_INCOMPLETE');
    expect(log).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(now.getTime() + 15 * 60_000));
    capability.mockRejectedValueOnce(Object.assign(new Error(privateMessage), { code: '42501' }));
    await service.expire();
    expect(warn).toHaveBeenCalledTimes(3); // Interior y exterior notifican al MISMO monitor.
    register.mockResolvedValue(undefined);
    await service.expire();
    expect(log).not.toHaveBeenCalled();
    await service.expire();
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(privateMessage);
  });

  it('un fallo de consulta entre páginas contamina el recorrido hasta su final', async () => {
    const { db, service, warn, log } = fixture(100);
    await service.expire();
    const runtime = db.client.runtime();
    vi.spyOn(runtime, 'query').mockRejectedValueOnce(new Error(privateMessage));
    await service.expire();
    await service.expire(); // Cola vacía, pero hubo fallo global en este recorrido.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    await service.expire(); // Recorrido completo vacío posterior, ahora sí limpio.
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('notifica cada categoría terminal dentro y entre páginas sin spam ni recuperación prematura', async () => {
    const { service, register, warn, log } = fixture(101);
    const codes: Record<string, string> = { '0000': '42501', '0001': 'ECONNRESET', '0100': '42601' };
    register.mockImplementation(async (_prisma, _tx, row) => {
      const code = codes[row.id];
      if (code) throw Object.assign(new Error(privateMessage), { cause: { sqlState: code } });
    });
    await service.expire();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(log).not.toHaveBeenCalled();
    await service.expire();
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls.map(call => call[0])).toEqual([
      expect.stringContaining('PERMISSION_DENIED'),
      expect.stringContaining('CONNECTION_UNAVAILABLE'),
      expect.stringContaining('SQL_FAILURE'),
    ]);
    expect(log).not.toHaveBeenCalled();
    await service.expire(); // Repetir las tres categorías no genera más avisos.
    expect(warn).toHaveBeenCalledTimes(3);
    expect(log).not.toHaveBeenCalled();
    register.mockResolvedValue(undefined);
    await service.expire();
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(privateMessage);
  });

  it('un primer intento fallido seguido de éxito no es un fallo terminal', async () => {
    const { service, register, warn, log } = fixture(1);
    register.mockRejectedValueOnce(Object.assign(new Error(privateMessage), { code: '42501' }));
    await service.expire();
    expect(register).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('repositorios independientes no comparten la pausa', async () => {
    const first = fixture(1);
    first.register.mockRejectedValue(new Error(privateMessage));
    await first.service.expire();
    expect(first.warn).toHaveBeenCalledTimes(1);
    const second = fixture(0);
    await second.service.expire();
    expect(first.log).not.toHaveBeenCalled();
    first.register.mockResolvedValue(undefined);
    await first.service.expire();
    expect(first.log).toHaveBeenCalledTimes(1);
  });
});
