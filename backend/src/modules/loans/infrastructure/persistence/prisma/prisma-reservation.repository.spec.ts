import { describe, expect, it, vi } from 'vitest';
import { Temporal } from 'temporal-polyfill/full';
import { PrismaReservationRepository } from './prisma-reservation.repository.js';
import { ConflictException } from '@nestjs/common';
import { inMemoryPrisma } from '../../../../../../test/helpers/in-memory-prisma.js';
import * as noShow from '../../integration/reservation-no-show.js';

describe('PrismaReservationRepository', () => {
  it.each([true, false])(
    'rejects inactive users even when single-operation enforcement is %s',
    async (enforceSingleOpenOperation) => {
      const db = inMemoryPrisma({
        usuarios: [{ id: 'user', vinculacionVigente: false }],
        ejemplares: [{ id: 'copy', estado: 'DISPONIBLE' }],
      });
      const repository = new PrismaReservationRepository(db as any);
      await expect(
        repository.create({
          userId: 'user',
          copyId: 'copy',
          enforceSingleOpenOperation,
          requestedAt: new Date(),
          loanDurationHours: 8,
        }),
      ).rejects.toThrow(ConflictException);
      expect(db.rows('ejemplares')[0].estado).toBe('DISPONIBLE');
      expect(db.rows('reservas')).toHaveLength(0);
    },
  );

  it('expires confirmed reservations and releases copies in one transaction', async () => {
    const row = {
      id: 'reservation-1',
      usuarioId: 'user-1',
      ejemplarId: 'copy-1',
      fechaSolicitada: Temporal.Instant.from('2026-10-21T10:00:00.123Z'),
      fechaLimiteRecogida: Temporal.Instant.from('2026-10-21T10:30:00.123Z'),
      duracionPrestamoHoras: 8,
      fechaRecogida: null,
      fechaCancelacion: null,
      estado: 'CONFIRMADA',
      motivoCancelacion: null,
    };
    const register = vi
      .spyOn(noShow, 'registerReservationNoShow')
      .mockResolvedValue(undefined);
    const db = inMemoryPrisma({
      usuarios: [{ id: 'user-1', vinculacionVigente: true }],
      reservas: [{ ...row, fechaSolicitada: null, fechaLimiteRecogida: null }],
      ejemplares: [{ id: 'copy-1', recursoId: 'resource', estado: 'RESERVADO', condicionFisica: 'APTO', habilitado: true }],
      recursos: [{ id: 'resource', categoriaId: 'category', activo: true }],
      categorias_recurso: [{ id: 'category', activo: true }],
    });
    Object.assign(db.rows('reservas')[0], row);
    const groups: (typeof db.calls)[] = [];
    const transaction = db.client.transaction.bind(db.client);
    vi.spyOn(db.client, 'transaction').mockImplementation(async (work) => {
      const start = db.calls.length;
      const result = await transaction(work);
      groups.push(db.calls.slice(start));
      return result;
    });
    const repository = new PrismaReservationRepository(db as any);
    await expect(
      repository.expire(new Date('2026-10-21T10:31:00.000Z')),
    ).resolves.toMatchObject([
      {
        id: 'reservation-1',
        status: 'VENCIDA',
        requestedAt: new Date('2026-10-21T10:00:00.123Z'),
        cancelledAt: new Date('2026-10-21T10:31:00.000Z'),
        pickedUpAt: null,
      },
    ]);
    const expiryWrites = groups.at(-1)!.filter((p) => p.operation === 'update');
    expect(expiryWrites.map((p) => p.table)).toEqual([
      'usuarios',
      'reservas',
      'ejemplares',
      'ejemplares',
    ]);
    expect(db.rows('ejemplares')[0].estado).toBe('DISPONIBLE');
    expect(register).toHaveBeenCalledExactlyOnceWith(
      db,
      db.client.runtime(),
      expect.objectContaining({ id: row.id, estado: 'VENCIDA' }),
      new Date('2026-10-21T10:31:00.000Z'),
    );
    register.mockRestore();
  });
});
