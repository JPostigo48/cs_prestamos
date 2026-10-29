import type { UserType } from '../../../users/domain/entities/registration-request.js';

export interface FullRegistrationInput {
  name: string;
  email: string;
  password: string;
  userType: UserType;
  institutionalId?: string;
  evidence: string[];
  termsVersionId: string;
}

export abstract class RegistrationPort {
  abstract submit(
    input: Omit<FullRegistrationInput, 'password'> & {
      passwordHash: string;
      acceptedAt: Date;
    },
  ): Promise<{ id: string; status: string }>;
}
