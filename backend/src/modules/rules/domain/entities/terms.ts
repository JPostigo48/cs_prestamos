export interface TermsVersion {
  id: string;
  number: number;
  title: string | null;
  content: string | null;
}

export interface TermsAcceptance {
  id: string;
  userId: string;
  termsVersionId: string;
  acceptedAt: Date;
}
