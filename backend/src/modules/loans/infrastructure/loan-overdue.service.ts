import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { LoanOverdueSynchronizer } from './loan-overdue-synchronizer.js';

export const OVERDUE_BATCH_SIZE = 25;
export const OVERDUE_MAX_BATCHES = 4;

@Injectable()
export class LoanOverdueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoanOverdueService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private stopped = false;
  private cursor: string | null = null;

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
          } catch {
            this.logger.warn(
              'No se pudo reevaluar un préstamo; se reintentará en el siguiente recorrido.',
            );
          }
          this.cursor = row.id;
        }
        if (rows.length < OVERDUE_BATCH_SIZE) {
          this.cursor = null;
          break;
        }
      }
    } catch {
      this.logger.error(
        'No se pudo consultar la mora pendiente; se reintentará en el siguiente ciclo.',
      );
    } finally {
      this.running = false;
    }
  }
}
