import type { RegistrationRequest } from './api/users-admin-api'
import { registrationImageSource } from '../auth/registration-image'

// Solo mensajes locales: nunca mostramos detalles internos o credenciales del servidor.
const safeReasons: Record<string, string> = {
  'Falta un correo institucional válido.': 'Falta un correo institucional válido.',
  'Faltan credenciales válidas del registro integral.': 'Faltan los datos originales de acceso. Se necesita una solicitud completa.',
  'Falta la aceptación válida de una versión de términos existente.': 'Falta una aceptación de términos válida.',
  'Falta una imagen PNG o JPEG válida de hasta 60 KiB.': 'Falta una imagen PNG o JPEG válida de hasta 60 KiB.',
  MISSING_CREDENTIALS: 'Faltan los datos originales de acceso. Se necesita una solicitud completa.',
  MISSING_EMAIL: 'Falta el correo de la solicitud original.',
  MISSING_PASSWORD: 'Falta la contraseña protegida de la solicitud original.',
  MISSING_TERMS_ACCEPTANCE: 'Falta una aceptación de términos válida.',
  MISSING_EVIDENCE: 'Falta una imagen válida de vinculación institucional.',
  INVALID_EVIDENCE: 'La evidencia requiere corrección antes de aprobar.',
}

export function registrationApprovalBlockers(request: RegistrationRequest): string[] {
  const blockers = request.approvalBlockers
  const reasons = !Array.isArray(blockers) || blockers.some((item) => typeof item !== 'string' || !item.trim())
    ? ['No se pudo verificar si la solicitud está completa. Actualiza la bandeja antes de aprobar.']
    : blockers.map((item) => Object.hasOwn(safeReasons, item) ? safeReasons[item]! : 'La solicitud está incompleta o requiere revisión. No puede aprobarse con los datos actuales.')
  if (!Array.isArray(request.evidence) || !request.evidence.some((item) => registrationImageSource(item?.information)))
    reasons.push(safeReasons.MISSING_EVIDENCE!)
  return [...new Set(reasons)]
}
