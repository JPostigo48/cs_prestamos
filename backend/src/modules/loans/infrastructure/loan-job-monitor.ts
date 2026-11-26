import type { Logger } from '@nestjs/common';
import { loanFailureDiagnostic } from './loan-schema.js';

/** Bounded operational summaries, never database messages or per-user payloads. */
export class LoanJobMonitor {
  private static readonly owners = new WeakMap<object, LoanJobMonitor>();

  /** Share reporting between a paginated repository and its scheduler. */
  static forOwner(owner: object, logger: Pick<Logger, 'warn' | 'log'>): LoanJobMonitor {
    let monitor = this.owners.get(owner);
    if (!monitor) {
      monitor = new LoanJobMonitor(logger);
      this.owners.set(owner, monitor);
    }
    return monitor;
  }

  private paused = false;
  private readonly lastReports = new Map<string, number>();
  private readonly reminderMs = 15 * 60_000;

  constructor(private readonly logger: Pick<Logger, 'warn' | 'log'>) {}

  failed(error: unknown): void {
    const now = Date.now();
    const diagnostic = loanFailureDiagnostic(error);
    const lastReport = this.lastReports.get(diagnostic);
    if (lastReport === undefined || now - lastReport >= this.reminderMs) {
      this.logger.warn(`Job pausado; se reintentará automáticamente. Diagnóstico: ${diagnostic}.`);
      this.lastReports.set(diagnostic, now);
    }
    this.paused = true;
  }

  ready(): void {
    if (this.paused) this.logger.log('Job reanudado tras verificar capacidades y completar el ciclo.');
    this.paused = false;
    this.lastReports.clear();
  }
}
