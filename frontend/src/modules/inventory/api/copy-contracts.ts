export const physicalConditions = ['APTO', 'DANADO', 'INCOMPLETO', 'DANADO_E_INCOMPLETO', 'PERDIDO', 'ROBADO'] as const
export interface CopyVerification { fitForLoan: true; componentsComplete: true; reason: string; evidenceIds: string[] }
export function validCopyVerification(v: unknown): v is CopyVerification {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return x.fitForLoan === true && x.componentsComplete === true && typeof x.reason === 'string' && !!x.reason.trim() && x.reason.length <= 1000 &&
    Array.isArray(x.evidenceIds) && x.evidenceIds.every(id => typeof id === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) && new Set(x.evidenceIds.map(id => id.toLowerCase())).size === x.evidenceIds.length
}
export function validCopy(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return typeof x.id === 'string' && typeof x.recursoId === 'string' && typeof x.codigoInventario === 'string' && ['DISPONIBLE', 'NO_DISPONIBLE', 'PRESTADO', 'RESERVADO'].includes(String(x.estado)) &&
    (x.condicionFisica === null || physicalConditions.includes(x.condicionFisica as typeof physicalConditions[number])) && typeof x.habilitado === 'boolean'
}
