import { describe, expect, it, vi } from 'vitest';
import { PrismaReservationRepository } from './prisma-reservation.repository.js';

describe('PrismaReservationRepository', () => {
  it('expires confirmed reservations and releases copies in one transaction', async () => {
    const row = {
      id: 'reservation-1',
      usuarioId: 'user-1',
      ejemplarId: 'copy-1',
      fechaSolicitada: new Date('2026-10-21T10:00:00.000Z'),
      fechaLimiteRecogida: new Date('2026-10-21T10:30:00.000Z'),
      duracionPrestamoHoras: 8,
      fechaRecogida: null,
      fechaCancelacion: new Date('2026-10-21T10:31:00.000Z'),
      estado: 'VENCIDA',
      motivoCancelacion: 'Ventana de recogida vencida',
    };
    const query = vi.fn()
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ id: 'copy-1' }]);
    const chain = (value: string): any => ({
      where: () => chain(value),
      returning: () => chain(value),
      build: () => value,
    });
    const tx = { query };
    const transaction = vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    const prisma = {
      client: { transaction },
      sql: { public: {
        reservas: { update: () => chain('expire-reservations') },
        ejemplares: { update: () => chain('release-copy') },
      } },
    };
    const repository = new PrismaReservationRepository(prisma as any);
    await expect(repository.expire(new Date('2026-10-21T10:31:00.000Z')))
      .resolves.toMatchObject([{ id: 'reservation-1', status: 'VENCIDA' }]);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(1, 'expire-reservations');
    expect(query).toHaveBeenNthCalledWith(2, 'release-copy');
  });
});
