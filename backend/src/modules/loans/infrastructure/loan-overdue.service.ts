import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { LoanOverdueSynchronizer } from './loan-overdue-synchronizer.js';
import { LoanJobMonitor } from './loan-job-monitor.js';
import { SchemaCapabilityUnavailableException } from '../../../shared/infrastructure/prisma/schema-capabilities.js';

export const OVERDUE_BATCH_SIZE = 25;
export const OVERDUE_MAX_BATCHES = 4;

@Injectable()
export class LoanOverdueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoanOverdueService.name);
  private readonly monitor = new LoanJobMonitor(this.logger);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private stopped = false;
  private cursor: string | null = null;
  private traversalFailed = false;

  constructor(private readonly synchronizer: LoanOverdueSynchronizer) {}

  onModuleInit(): void {
    this.stopped = false;
    this.timer = setInterval(() => void this.synchronize(), 60_000);
    this.timer.unref();
    void this.synchronize();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async synchronize(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      // Before candidates: their legacy-only query cannot diagnose episode support.
      await this.synchronizer.assertAvailable();
      let completed = false;
      const at = new Date();
      for (
        let batch = 0;
        batch < OVERDUE_MAX_BATCHES && !this.stopped;
        batch++
      ) {
        const rows = await this.synchronizer.candidates(
          at,
          OVERDUE_BATCH_SIZE,
          this.cursor,
        );
        for (const row of rows) {
          if (this.stopped) return;
          try {
            await this.synchronizer.synchronizeLoan(row.usuarioId, row.id);
          } catch (error) {
            if (error instanceof SchemaCapabilityUnavailableException) throw error;
            this.traversalFailed = true;
            this.monitor.failed(error);
          }
          this.cursor = row.id;
        }
        if (rows.length < OVERDUE_BATCH_SIZE) {
          this.cursor = null;
          completed = true;
          break;
        }
      }
      if (completed && !this.traversalFailed) this.monitor.ready();
      // The next traversal, not an empty cursor tail, can prove recovery.
      if (completed) this.traversalFailed = false;
    } catch (error) {
      if (this.cursor !== null) this.traversalFailed = true;
      this.monitor.failed(error);
    } finally {
      this.running = false;
    }
  }
}
