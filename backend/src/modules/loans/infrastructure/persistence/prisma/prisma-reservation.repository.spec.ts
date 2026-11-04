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
      fechaCancelacion: Temporal.Instant.from('2026-10-21T10:31:00.123Z'),
      estado: 'VENCIDA',
      motivoCancelacion: 'Ventana de recogida vencida',
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'user-1' }])
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'copy-1' }]);
    const register = vi.spyOn(noShow, 'registerReservationNoShow').mockResolvedValue(undefined);
    const chain = (value: string): any => ({
      where: () => chain(value),
      returning: () => chain(value),
      limit: () => chain(value),
      orderBy: () => chain(value),
      build: () => value,
    });
    const tx = { query };
    const transaction = vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    const prisma = {
      client: { transaction, runtime: () => ({ query: vi.fn().mockResolvedValue([row]) }) },
      sql: {
        public: {
          reservas: { update: () => chain('expire-reservations'), select: () => chain('select-reservations') },
          ejemplares: { update: () => chain('release-copy') },
          usuarios: { update: () => chain('lock-user') },
          prestamos: { select: () => chain('active-loans') },
        },
      },
    };
    const repository = new PrismaReservationRepository(prisma as any);
    await expect(
      repository.expire(new Date('2026-10-21T10:31:00.000Z')),
    ).resolves.toMatchObject([
      {
        id: 'reservation-1',
        status: 'VENCIDA',
        requestedAt: new Date('2026-10-21T10:00:00.123Z'),
        cancelledAt: new Date('2026-10-21T10:31:00.123Z'),
        pickedUpAt: null,
      },
    ]);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(1, 'lock-user');
    expect(query).toHaveBeenNthCalledWith(2, 'expire-reservations');
    expect(query).toHaveBeenNthCalledWith(5, 'release-copy');
    expect(register).toHaveBeenCalledExactlyOnceWith(prisma, tx, row, new Date('2026-10-21T10:31:00.000Z'));
    register.mockRestore();
  });
});
