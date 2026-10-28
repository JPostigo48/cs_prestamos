import type { PublicPolicy } from './termsApi'

export const policyFamilies: { kind: PublicPolicy['kind']; label: string }[] = [
  { kind: 'LATENESS', label: 'Devoluciones tardías' },
  { kind: 'DAMAGE', label: 'Daños y piezas faltantes' },
  { kind: 'LOSS', label: 'Pérdida o robo' },
  { kind: 'NO_SHOW', label: 'Reservas e inasistencias' },
  { kind: 'TRUST', label: 'Confianza y niveles' },
  { kind: 'REWARD', label: 'Recompensas' },
  { kind: 'ACCESS', label: 'Acceso y duración por categoría' },
]
export const policyLabel = (value: string | null) => value === null ? 'No aplica' : value.replaceAll('_', ' ').toLocaleLowerCase('es')

export function confidenceLabel(policy: PublicPolicy): string {
  if (policy.trustEffect === 'SET_ZERO') return 'Establecer confianza en cero'
  if (policy.trustEffect === 'NONE') return 'No aplica descuento'
  return policy.penaltyPoints === null ? 'Descuento desconocido' : `−${policy.penaltyPoints} puntos porcentuales`
}
export function suspensionLabel(policy: PublicPolicy): string {
  if (policy.suspensionType === 'INDEFINIDA') return 'Bloqueo indefinido'
  if (policy.suspensionType === 'NINGUNA') return 'Sin suspensión'
  if (policy.suspensionType === 'TEMPORAL') return policy.suspensionDays === null ? 'Duración desconocida' : `${policy.suspensionDays} días`
  return 'Suspensión desconocida'
}
export function criteriaDetails(policy: PublicPolicy): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = []
  const add = (label: string, value: string) => result.push({ label, value })
  const { delayHours, noShow, reward, access, trust } = policy.criteria
  if (delayHours) add('Retraso', `Más de ${delayHours.exclusiveMin} horas${delayHours.inclusiveMax === null ? ', sin límite superior' : ` y hasta ${delayHours.inclusiveMax} horas (inclusive)`}`)
  if (noShow) {
    add('Inasistencias', `${noShow.inclusiveMin}${noShow.inclusiveMax === null ? ' y siguientes' : ` a ${noShow.inclusiveMax}`} en ${noShow.rollingDays} días móviles`)
    add('Ventana de recogida', `${noShow.pickupMinutes} minutos desde la hora pactada, inclusive`)
  }
  if (reward) {
    add('Referencia', `${reward.referencePoints} puntos`)
    add('Recompensa', `${reward.fraction * 100} % de la referencia: +${Number((reward.referencePoints * reward.fraction).toFixed(2))} puntos; máximo ${reward.maximumTrust}`)
  }
  if (access) {
    add('Niveles admitidos', access.allowedLevels.map(policyLabel).join(', ') || 'Ninguno')
    add('Duración máxima desde recogida', `${access.durationHours} horas`)
    add('Solo dentro del campus', access.campusOnly ? 'Sí' : 'No')
  }
  if (trust) {
    add('Confianza inicial', `${trust.initial} %`)
    add('Límites', `${trust.minimum} a ${trust.maximum}; ${trust.decimals} decimales`)
    for (const level of trust.levels) add(policyLabel(level.name), `${level.inclusiveMin} ≤ confianza ${level.exclusiveMax === null ? `≤ ${trust.maximum}` : `< ${level.exclusiveMax}`}`)
  }
  return result
}

// Texto procedente de la versión publicada: sin HTML ejecutable ni políticas locales.
export function termsSections(content: string | null): { title: string; body: string }[] {
  if (!content?.trim()) return []
  const clean = content.replace(/<!--\s*epcc\.policy-versions\/v1:[\s\S]*?-->/g, '').trim()
  return clean.split(/^##\s+/m).filter(Boolean).map((part, index) => {
    const newline = part.indexOf('\n')
    return { title: index === 0 ? 'Introducción y vigencia' : (newline < 0 ? part : part.slice(0, newline)), body: index === 0 ? part : (newline < 0 ? '' : part.slice(newline + 1).trim()) }
  })
}
export function publicationLabel(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Fecha desconocida'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(value))
}
