export enum AppealStatus {
  PENDING = 'PENDIENTE',
  ACCEPTED = 'ACEPTADA',
  REJECTED = 'RECHAZADA',
}

export interface Appeal {
  id: string;
  violationId: string;
  userId: string;
  reason: string;
  submittedAt: Date;
  status: AppealStatus;
  resolution: string | null;
  resolvedAt: Date | null;
  resolvedByAccountId: string | null;
}
