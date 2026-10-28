import type { TermsAcceptance, TermsVersion } from '../entities/terms.js';
import type { PublicTerms } from '../entities/public-terms.js';

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
  abstract readPublicVersion(versionId?: string): Promise<PublicTerms | null>;
  abstract createVersion(data: CreateTermsVersionData): Promise<TermsVersion>;
  abstract findVersionById(versionId: string): Promise<TermsVersion | null>;
  abstract accept(data: AcceptTermsVersionData): Promise<TermsAcceptance>;
  abstract findAcceptancesByUserId(userId: string): Promise<TermsAcceptance[]>;
  abstract hasAcceptedCurrentVersion(userId: string): Promise<boolean>;
}
