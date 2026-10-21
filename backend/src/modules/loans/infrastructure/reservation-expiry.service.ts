import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ReservationRepository } from '../domain/repositories/reservation.repository.js';

@Injectable()
export class ReservationExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationExpiryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly reservations: ReservationRepository) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.expire(), 60_000);
    this.timer.unref();
    void this.expire();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async expire(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.reservations.expire(new Date());
    } catch (error) {
      this.logger.error('No se pudieron vencer las reservas pendientes.', error);
    } finally {
      this.running = false;
    }
  }
}
