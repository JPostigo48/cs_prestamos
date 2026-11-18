import type { SanctionDetail } from './api/trust-api'

const kinds: Record<string, string> = {
  NO_SHOW: 'Reserva no recogida', LATENESS: 'Devolución fuera de plazo', DAMAGE: 'Daño de recurso',
  LOSS: 'Pérdida de recurso', REWARD: 'Reconocimiento de confianza', ACCESS: 'Condiciones de acceso', TRUST: 'Ajuste de confianza',
}
// Solo la versión histórica, nunca reglas vigentes ni deducciones por fechas.
export function sanctionReason(detail: SanctionDetail): string {
  if (detail.reason?.trim()) return detail.reason.trim()
  const description = detail.rule?.description.trim()
  if (description) {
    try {
      const policy = JSON.parse(description)
      if (policy?.format === 'epcc.official-policy/v1' && kinds[policy.kind]) return kinds[policy.kind]!
    } catch { return description }
  }
  const title = detail.rule?.title.trim()
  return title && !/^R-[A-Z]+[:\s]/.test(title) ? title : 'Actualización de confianza'
}
