import type {
  RegistrationRequest,
  RegistrationRequestStatus,
  UserType,
} from '../entities/registration-request.js';

export type CreateRegistrationRequestData = {
  userType: UserType;
  institutionalId: string | null;
  evidence: string[];
};

export abstract class RegistrationRequestRepository {
  abstract create(
    data: CreateRegistrationRequestData,
  ): Promise<RegistrationRequest>;
  abstract findById(requestId: string): Promise<RegistrationRequest | null>;
  abstract updateStatus(
    requestId: string,
    status: RegistrationRequestStatus,
    approvedUserId?: string,
  ): Promise<RegistrationRequest>;
}
