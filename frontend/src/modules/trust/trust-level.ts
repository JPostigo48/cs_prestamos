export type TrustTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

export interface TrustLevelDisplay {
  label: string
  tone: TrustTone
  color: string
}

const LEVELS: Record<string, TrustLevelDisplay> = {
  EXCELENTE: { label: 'Excelente', tone: 'success', color: '#15803d' },
  CONFIABLE: { label: 'Confiable', tone: 'info', color: '#1d4ed8' },
  EN_OBSERVACION: { label: 'En observación', tone: 'warning', color: '#9a3412' },
  CRITICO: { label: 'Crítico', tone: 'danger', color: '#b91c1c' },
}

const FALLBACK: TrustLevelDisplay = { label: 'Confianza no disponible', tone: 'neutral', color: '#475569' }

export function trustLevel(level: string): TrustLevelDisplay {
  return LEVELS[level] ?? FALLBACK
}
