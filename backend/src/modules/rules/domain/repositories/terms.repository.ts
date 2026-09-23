import type { TermsAcceptance, TermsVersion } from '../entities/terms.js';

export interface CreateTermsVersionData {
  number: number;
  title?: string;
  content?: string;
}

export interface AcceptTermsVersionData {
  userId: string;
  termsVersionId: string;
  acceptedAt: Date;
}

export abstract class TermsRepository {
  abstract createVersion(data: CreateTermsVersionData): Promise<TermsVersion>;
  abstract findVersionById(versionId: string): Promise<TermsVersion | null>;
  abstract accept(data: AcceptTermsVersionData): Promise<TermsAcceptance>;
  abstract findAcceptancesByUserId(userId: string): Promise<TermsAcceptance[]>;
}
