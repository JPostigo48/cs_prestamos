export interface CopyLoanAvailability {
  copyId: string;
  available: boolean;
  maximumLoanDays: number;
}

export interface ReleaseCopyInput {
  copyId: string;
  observation?: string;
}

export abstract class LoanInventoryPort {
  abstract getAvailability(copyId: string): Promise<CopyLoanAvailability>;
  abstract markAsLoaned(copyId: string): Promise<void>;
  abstract releaseAfterReturn(input: ReleaseCopyInput): Promise<void>;
}
