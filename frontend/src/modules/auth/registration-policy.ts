export const normalizeInstitutionalEmail = (email: string) => email.trim().toLowerCase()
// Same exact-domain rule as InstitutionalEmailPolicy; both boundaries have parity tests.
export const isInstitutionalEmail = (email: string) => /^[^\s@]+@unsa\.edu\.pe$/.test(normalizeInstitutionalEmail(email))
export interface RegistrationFields {
  name: string; email: string; password: string; userType: string
  institutionalId: string; phone: string; evidence: string[]; termsVersionId: string | null
}
export function registrationErrors(input: RegistrationFields): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const [key, min, max, label] of [
    ['name', 2, 180, 'Nombre'], ['institutionalId', 1, 80, 'Identificador institucional'], ['phone', 1, 20, 'Teléfono'],
  ] as const) {
    const value = typeof input[key] === 'string' ? input[key].trim() : ''
    if (value.length < min || value.length > max) errors[key] = `${label}: ingresa entre ${min} y ${max} caracteres.`
  }
  if (typeof input.email !== 'string' || input.email.trim().length > 254 || !isInstitutionalEmail(input.email))
    errors.email = 'Ingresa tu correo institucional del dominio exacto @unsa.edu.pe.'
  if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128 || !/\S/u.test(input.password))
    errors.password = 'La contraseña debe tener entre 8 y 128 caracteres y no contener solo espacios.'
  if (!['ESTUDIANTE', 'DOCENTE', 'ADMINISTRATIVO'].includes(input.userType)) errors.userType = 'Selecciona un tipo institucional.'
  if (!Array.isArray(input.evidence) || input.evidence.length !== 1 || !input.evidence[0]?.trim()) errors.evidence = 'Adjunta exactamente una evidencia válida.'
  if (!input.termsVersionId) errors.termsVersionId = 'Consulta y acepta los términos vigentes.'
  return errors
}
