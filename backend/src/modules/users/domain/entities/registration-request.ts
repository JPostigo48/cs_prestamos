export const UserType = {
  ESTUDIANTE: 'ESTUDIANTE',
  DOCENTE: 'DOCENTE',
  ADMINISTRATIVO: 'ADMINISTRATIVO',
} as const;

export type UserType = (typeof UserType)[keyof typeof UserType];

export const RegistrationRequestStatus = {
  PENDIENTE: 'PENDIENTE',
  APROBADA: 'APROBADA',
  RECHAZADA: 'RECHAZADA',
} as const;

export type RegistrationRequestStatus =
  (typeof RegistrationRequestStatus)[keyof typeof RegistrationRequestStatus];

export type AffiliationEvidence = {
  information: string;
};

export type RegistrationRequest = {
  id: string;
  name: string;
  userType: UserType;
  institutionalId: string | null;
  requestedAt: Date;
  status: RegistrationRequestStatus;
  rejectionReason: string | null;
  approvedUserId: string | null;
  evidence: AffiliationEvidence[];
};
