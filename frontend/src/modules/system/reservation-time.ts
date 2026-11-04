import { validInstant } from '../../shared/api/calendar'

export interface ScheduleInterval { opens: string; closes: string }
export interface ScheduleDay { day: number; intervals: ScheduleInterval[] }
export interface ReservationSettings {
  pickupWaitMinutes: number
  weeklySchedule: ScheduleDay[] | null
  version: number
  updatedAt: string
  timeZone: 'America/Lima'
  scheduleStatus: 'CONFIGURED' | 'UNCONFIGURED'
  pickupWindowPolicy: 'FULL_WINDOW_WITHIN_INTERVAL'
  warning: string | null
}
export const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
export const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
export function scheduleError(schedule: ScheduleDay[] | null): string {
  if (schedule === null) return ''
  if (!Array.isArray(schedule) || schedule.length !== 7 || new Set(schedule.map(d => d.day)).size !== 7)
    return 'Incluye los siete días una sola vez.'
  for (const d of schedule) {
    if (!Number.isInteger(d.day) || d.day < 1 || d.day > 7 || !Array.isArray(d.intervals) || d.intervals.length > 12)
      return 'Cada día admite hasta 12 franjas.'
    let previous = -1
    for (const interval of d.intervals) {
      if (!interval || !validTime(interval.opens) || !validTime(interval.closes) || interval.opens >= interval.closes || minutes(interval.opens) < previous)
        return 'Revisa las franjas: apertura anterior al cierre, ordenadas y sin solaparse.'
      previous = minutes(interval.closes)
    }
  }
  return ''
}
export function waitError(value: number): string {
  return Number.isInteger(value) && value >= 1 && value <= 240 ? '' : 'La espera debe ser un entero entre 1 y 240 minutos.'
}
// Lima no cambia de offset. Nunca se interpreta una cadena sin zona en el dispositivo.
export function limaParts(now: number): { date: string; time: string } {
  const iso = new Date(now - 5 * 60 * 60 * 1000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}
export function futurePreset(now: number, delayMinutes: number) {
  return limaParts(Math.ceil((now + delayMinutes * 60000) / 60000) * 60000)
}
export function limaInstant(date: string, time: string): string | null {
  const value = `${date}T${time}:00-05:00`
  return validTime(time) && validInstant(value) ? value : null
}
export function reservationTimeError(date: string, time: string, settings: ReservationSettings, now: number): string {
  const instant = limaInstant(date, time)
  if (!instant) return 'Completa una fecha y hora válidas.'
  if (Date.parse(instant) <= now) return 'Elige una hora futura.'
  if (settings.weeklySchedule === null) return ''
  const weekday = new Date(`${date}T12:00:00-05:00`).getUTCDay() || 7
  const intervals = settings.weeklySchedule.find(d => d.day === weekday)?.intervals ?? []
  if (!intervals.length) return 'Ese día no hay atención.'
  const start = minutes(time), end = start + settings.pickupWaitMinutes
  return intervals.some(i => start >= minutes(i.opens) && start < minutes(i.closes) && end <= minutes(i.closes))
    ? '' : 'La recogida y su espera deben caber en una misma franja de atención.'
}
