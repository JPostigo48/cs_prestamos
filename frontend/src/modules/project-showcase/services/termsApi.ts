import { apiRequest } from '../../../shared/api/client'

export interface PublicPolicy {
  id: string
  ruleId: string
  number: number
  title: string
  key: string
  kind: 'LATENESS' | 'DAMAGE' | 'LOSS' | 'NO_SHOW' | 'REWARD' | 'ACCESS' | 'TRUST'
  category: string | null
  categoryId: string | null
  severity: string | null
  trustEffect: 'DISCOUNT' | 'SET_ZERO' | 'NONE'
  penaltyPoints: number | null
  suspensionType: 'NINGUNA' | 'TEMPORAL' | 'INDEFINIDA' | null
  suspensionDays: number | null
  consequence: string
  criteria: {
    condition: string
    delayHours?: { exclusiveMin: number; inclusiveMax: number | null }
    noShow?: { inclusiveMin: number; inclusiveMax: number | null; rollingDays: number; pickupMinutes: number }
    reward?: { referencePoints: number; fraction: number; maximumTrust: number }
    access?: { allowedLevels: string[]; durationHours: number; campusOnly: boolean }
    trust?: { initial: number; minimum: number; maximum: number; decimals: number; levels: { name: string; inclusiveMin: number; exclusiveMax: number | null }[] }
  }
}
export interface PublicTerms {
  id: string
  number: number
  title: string | null
  content: string | null
  publishedAt: string | null
  policiesStatus: 'COMPLETE' | 'INCOMPLETE' | 'UNAVAILABLE'
  policies: PublicPolicy[]
}

export const readCurrentTerms = (signal: AbortSignal) => apiRequest<PublicTerms>('/terms/current', { signal })
