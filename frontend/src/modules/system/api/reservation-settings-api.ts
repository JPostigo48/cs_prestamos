import { authenticatedRequest, getSession } from '../../auth/api/auth-api'
import { ApiError } from '../../../shared/api/client'
import { validInstant } from '../../../shared/api/calendar'
import { scheduleError, waitError, type ReservationSettings, type ScheduleDay } from '../reservation-time'

function parseSettings(value: ReservationSettings): ReservationSettings {
  if (!value || waitError(value.pickupWaitMinutes) || value.weeklySchedule === undefined || scheduleError(value.weeklySchedule) ||
    value.timeZone !== 'America/Lima' || value.pickupWindowPolicy !== 'FULL_WINDOW_WITHIN_INTERVAL' ||
    value.scheduleStatus !== (value.weeklySchedule === null ? 'UNCONFIGURED' : 'CONFIGURED') ||
    !Number.isInteger(value.version) || value.version < 1 || !validInstant(value.updatedAt) ||
    (value.weeklySchedule === null ? typeof value.warning !== 'string' : value.warning !== null))
    throw new ApiError('No se pudo confirmar la configuración recibida.', 0)
  return value
}
export async function getReservationSettings(signal?: AbortSignal) {
  return parseSettings(await authenticatedRequest<ReservationSettings>('/system/reservation-settings', { signal }))
}
export async function saveReservationSettings(body: { pickupWaitMinutes: number; weeklySchedule: ScheduleDay[] | null }) {
  if (getSession()?.user.role !== 'ADMINISTRADOR') throw new ApiError('Solo administración puede cambiar la configuración.', 403)
  const error = waitError(body.pickupWaitMinutes) || scheduleError(body.weeklySchedule)
  if (error) throw new ApiError(error, 400)
  return parseSettings(await authenticatedRequest<ReservationSettings>('/system/reservation-settings', { method: 'PATCH', body }))
}
