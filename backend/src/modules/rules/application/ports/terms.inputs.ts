export interface CreateTermsVersionInput {
  number: number;
  title?: string;
  content?: string;
}

export interface AcceptTermsVersionInput {
  userId: string;
  termsVersionId: string;
  acceptedAt: Date;
}

export interface ListUserTermsAcceptancesInput {
  userId: string;
}
