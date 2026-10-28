import type {
  PolicyCriteria,
  OfficialPolicy,
} from '../official-policy.catalog.js';
import type { TermsVersion } from './terms.js';

export interface PublicPolicy {
  id: string;
  ruleId: string;
  number: number;
  title: string;
  key: string;
  kind: OfficialPolicy['kind'];
  category: string | null;
  categoryId: string | null;
  severity: string | null;
  trustEffect: OfficialPolicy['trustEffect'];
  penaltyPoints: number | null;
  suspensionType: string | null;
  suspensionDays: number | null;
  consequence: string;
  criteria: PolicyCriteria;
}

export interface PublicTerms extends TermsVersion {
  publishedAt: string | null;
  policiesStatus: 'COMPLETE' | 'INCOMPLETE' | 'UNAVAILABLE';
  policies: PublicPolicy[];
}
