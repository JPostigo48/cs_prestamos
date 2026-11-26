import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ReservationRepository } from '../domain/repositories/reservation.repository.js';
import { LoanJobMonitor } from './loan-job-monitor.js';

@Injectable()
export class ReservationExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationExpiryService.name);
  private readonly monitor: LoanJobMonitor;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly reservations: ReservationRepository) {
    this.monitor = LoanJobMonitor.forOwner(reservations, this.logger);
  }

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
      // Only the repository knows whether a full, clean traversal completed.
    } catch (error) {
      this.monitor.failed(error);
    } finally {
      this.running = false;
    }
  }
}
