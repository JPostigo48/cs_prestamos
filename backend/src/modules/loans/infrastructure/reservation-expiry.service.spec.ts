import { describe, expect, it, vi } from 'vitest';
import { ReservationExpiryService } from './reservation-expiry.service.js';

describe('Reservation expiry', () => {
  it('executes at startup and periodically without overlapping runs', async () => {
    vi.useFakeTimers();
    const expire = vi.fn().mockResolvedValue([]);
    const service = new ReservationExpiryService({ expire } as any);
    try {
      service.onModuleInit();
      await vi.waitFor(() => expect(expire).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(60_000);
      expect(expire).toHaveBeenCalledTimes(2);
    } finally {
      service.onModuleDestroy();
      vi.useRealTimers();
    }
  });

  it('does not start another expiration while one is pending', async () => {
    let complete!: () => void;
    const expire = vi.fn().mockReturnValue(new Promise<void>((resolve) => { complete = resolve; }));
    const service = new ReservationExpiryService({ expire } as any);
    const first = service.expire();
    await service.expire();
    expect(expire).toHaveBeenCalledTimes(1);
    complete();
    await first;
    await service.expire();
    expect(expire).toHaveBeenCalledTimes(2);
  });
});
