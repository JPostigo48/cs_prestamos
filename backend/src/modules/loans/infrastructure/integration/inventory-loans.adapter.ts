import { Injectable } from '@nestjs/common';
import {
  LoanInventoryPort,
  type CopyLoanAvailability,
  type ReleaseCopyInput,
} from '../../application/ports/loan-inventory.port.js';
import { InventoryService } from '../../../inventory/application/use-cases/inventory.service.js';

@Injectable()
export class InventoryLoansAdapter implements LoanInventoryPort {
  constructor(private readonly inventory: InventoryService) {}

  async getAvailability(copyId: string): Promise<CopyLoanAvailability> {
    return this.inventory.getLoanAvailability(copyId);
  }

  async markAsLoaned(copyId: string): Promise<void> {
    await this.inventory.markCopyAsLoaned(copyId);
  }

  async releaseAfterReturn(input: ReleaseCopyInput): Promise<void> {
    await this.inventory.releaseCopyAfterReturn(input.copyId, input.observation);
  }
}
