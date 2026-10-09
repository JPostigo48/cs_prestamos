import type {
  RegistrationRequest,
  RegistrationRequestStatus,
  UserType,
} from '../entities/registration-request.js';

export type CreateRegistrationRequestData = {
  name: string;
  userType: UserType;
  institutionalId: string | null;
  evidence: string[];
};

export type RegistrationRequestFilters = {
  status?: RegistrationRequestStatus;
  institutionalId?: string;
  page: number;
  limit: number;
};

export type RegistrationRequestPage = {
  items: RegistrationRequest[];
  total: number;
  page: number;
  limit: number;
};

export type ApprovedRegistration = {
  request: RegistrationRequest;
  user: import('../entities/user.js').User;
};

export abstract class RegistrationRequestRepository {
  abstract create(
    data: CreateRegistrationRequestData,
  ): Promise<RegistrationRequest>;
  abstract findById(requestId: string): Promise<RegistrationRequest | null>;
  abstract findPendingByInstitutionalId(
    institutionalId: string,
  ): Promise<RegistrationRequest | null>;
  abstract list(filters: RegistrationRequestFilters): Promise<RegistrationRequestPage>;
  abstract approveAndCreateUser(requestId: string): Promise<ApprovedRegistration>;
  abstract updateStatus(
    requestId: string,
    status: RegistrationRequestStatus,
      rejectionReason?: string,
    approvedUserId?: string,
  ): Promise<RegistrationRequest>;
}
