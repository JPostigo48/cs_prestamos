import { apiRequest } from '../../../shared/api/client'
import type { AuthSession } from '../../auth/api/auth-api'

export interface UserProfile {
  id: string
  name: string
  userType: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO'
  institutionalId: string | null
  hasCurrentAffiliation: boolean
  trustPercentage: number
}
export interface TrustProfile {
  userId: string
  percentage: number
  level: 'CRITICO' | 'EN_OBSERVACION' | 'CONFIABLE' | 'EXCELENTE'
  currentlyPenalized: boolean
}
export interface LoanEligibility {
  userId: string
  enabled: boolean
  reasons?: string[]
}
export interface Sanction {
  id: string
  status: 'PROGRAMADA' | 'ACTIVA' | 'FINALIZADA' | 'ABSUELTA'
  startsAt: string
  endsAt: string | null
  previousTrust: number
  resultingTrust: number
  ruleId: string | null
  violationId: string | null
}
export interface Loan {
  id: string
  copyId: string
  startsAt: string
  endsAt: string
  status: 'PLANIFICADO' | 'ACTIVO' | 'FINALIZADO'
  return: { returnedAt: string } | null
}
export interface Category {
  id: string
  nombre: string
  resourceCount: number
  tiempoMaximoPrestamoDias: number
}
export interface Resource {
  id: string
  categoriaId: string
  nombre: string
  descripcion: string | null
  availableCopies: number
  totalCopies: number
}
export interface CopyDetail {
  id: string
  codigoInventario: string
  recurso: { id: string; nombre: string; categoriaId: string }
}
export interface DashboardData {
  user: UserProfile
  trust: TrustProfile
  eligibility: LoanEligibility
  sanctions: Sanction[]
  loans: Loan[]
  categories: Category[]
  resources: Resource[]
  copies: Record<string, CopyDetail>
}

interface ResourcePage { data: Resource[]; total: number; page: number; limit: number }

async function loadResources(signal: AbortSignal): Promise<Resource[]> {
  const resources: Resource[] = []
  for (let page = 1; ; page++) {
    const result = await apiRequest<ResourcePage>('/inventory/resources?page=' + page + '&limit=100', { signal })
    resources.push(...result.data)
    if (resources.length >= result.total || result.data.length === 0) return resources
  }
}

export async function loadDashboard(session: AuthSession, signal: AbortSignal): Promise<DashboardData> {
  const userId = encodeURIComponent(session.user.id)
  const token = session.accessToken
  const authenticated = <T>(path: string) => apiRequest<T>(path, { token, signal })
  const [user, trust, eligibility, sanctions, loans, categories, resources] = await Promise.all([
    authenticated<UserProfile>('/users/' + userId),
    authenticated<TrustProfile>('/users/' + userId + '/trust'),
    authenticated<LoanEligibility>('/users/' + userId + '/loan-eligibility'),
    authenticated<Sanction[]>('/users/' + userId + '/sanctions'),
    authenticated<Loan[]>('/loans/user/' + userId + '/history'),
    apiRequest<Category[]>('/inventory/categories', { signal }),
    loadResources(signal),
  ])
  const copyIds = [...new Set(loans.map(loan => loan.copyId))]
  const copyEntries = await Promise.all(copyIds.map(async id => {
    try {
      const copy = await apiRequest<CopyDetail>('/inventory/copies/' + encodeURIComponent(id), { signal })
      return [id, copy] as const
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return null
    }
  }))
  return {
    user, trust, eligibility, sanctions, loans, categories, resources,
    copies: Object.fromEntries(copyEntries.filter(entry => entry !== null)),
  }
}

export function submitAppeal(session: AuthSession, sanctionId: string, reason: string) {
  return apiRequest<{ id: string; status: string }>(
    '/sanctions/' + encodeURIComponent(sanctionId) + '/appeals',
    { method: 'POST', token: session.accessToken, body: { reason } },
  )
}
