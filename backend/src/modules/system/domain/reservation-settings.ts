import { BadRequestException } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';

export const INSTITUTION_TIME_ZONE = 'America/Lima';
export interface OpeningInterval {
  opens: string;
  closes: string;
}
export interface OpeningDay {
  day: number;
  intervals: OpeningInterval[];
}
export interface ReservationSettings {
  pickupWaitMinutes: number;
  weeklySchedule: OpeningDay[] | null;
  version: number;
  updatedAt: string;
}
export interface ReservationSettingsPatch {
  pickupWaitMinutes?: number;
  weeklySchedule?: OpeningDay[] | null;
}

export function validateSettingsPatch(patch: ReservationSettingsPatch): void {
  if (
    !patch ||
    (patch.pickupWaitMinutes === undefined &&
      patch.weeklySchedule === undefined)
  )
    throw new BadRequestException(
      'Indique al menos un campo de configuración.',
    );
  if (
    patch.pickupWaitMinutes !== undefined &&
    (!Number.isInteger(patch.pickupWaitMinutes) ||
      patch.pickupWaitMinutes < 1 ||
      patch.pickupWaitMinutes > 240)
  )
    throw new BadRequestException(
      'La espera debe ser un entero entre 1 y 240 minutos.',
    );
  const schedule = patch.weeklySchedule;
  if (schedule === undefined || schedule === null) return;
  if (!Array.isArray(schedule) || schedule.length !== 7)
    throw new BadRequestException(
      'El horario debe incluir los siete días (1=lunes, 7=domingo).',
    );
  const days = new Set<number>();
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  for (const entry of schedule) {
    if (
      !entry ||
      !Number.isInteger(entry.day) ||
      entry.day < 1 ||
      entry.day > 7 ||
      days.has(entry.day) ||
      !Array.isArray(entry.intervals) ||
      entry.intervals.length > 12
    )
      throw new BadRequestException(
        'Días inválidos, repetidos o demasiadas franjas.',
      );
    days.add(entry.day);
    let previousClose = '';
    for (const interval of entry.intervals) {
      if (
        !interval ||
        !time.test(interval.opens) ||
        !time.test(interval.closes) ||
        interval.opens >= interval.closes ||
        interval.opens < previousClose
      )
        throw new BadRequestException(
          'Franjas HH:mm ordenadas, sin solapamientos ni cruce de medianoche.',
        );
      previousClose = interval.closes;
    }
  }
}

export function assertFuturePickup(requestedAt: Date, now = new Date()): void {
  if (!(requestedAt instanceof Date) || !Number.isFinite(requestedAt.getTime()))
    throw new BadRequestException('La fecha de recogida es inválida.');
  if (requestedAt.getTime() < now.getTime())
    throw new BadRequestException(
      'La hora de recogida no puede estar en el pasado.',
    );
}

/** Inicio incluido, cierre excluido para iniciar; el plazo puede terminar al cierre. */
export function calculatePickupDeadline(
  requestedAt: Date,
  settings: ReservationSettings,
  now = new Date(),
): Date {
  assertFuturePickup(requestedAt, now);
  const deadline = new Date(
    requestedAt.getTime() + settings.pickupWaitMinutes * 60_000,
  );
  if (settings.weeklySchedule === null) return deadline;
  const start = Temporal.Instant.from(
    requestedAt.toISOString(),
  ).toZonedDateTimeISO(INSTITUTION_TIME_ZONE);
  const end = Temporal.Instant.from(deadline.toISOString()).toZonedDateTimeISO(
    INSTITUTION_TIME_ZONE,
  );
  const fits = settings.weeklySchedule
    .find((day) => day.day === start.dayOfWeek)
    ?.intervals.some((interval) => {
      const opens = start
        .toPlainDate()
        .toPlainDateTime(interval.opens)
        .toZonedDateTime(INSTITUTION_TIME_ZONE);
      const closes = start
        .toPlainDate()
        .toPlainDateTime(interval.closes)
        .toZonedDateTime(INSTITUTION_TIME_ZONE);
      return (
        Temporal.ZonedDateTime.compare(start, opens) >= 0 &&
        Temporal.ZonedDateTime.compare(start, closes) < 0 &&
        Temporal.ZonedDateTime.compare(end, closes) <= 0
      );
    });
  if (!fits)
    throw new BadRequestException(
      'La ventana completa de recogida debe caber en una franja de atención (America/Lima).',
    );
  return deadline;
}

export function presentSettings(settings: ReservationSettings) {
  return {
    ...settings,
    timeZone: INSTITUTION_TIME_ZONE,
    scheduleStatus:
      settings.weeklySchedule === null
        ? ('UNCONFIGURED' as const)
        : ('CONFIGURED' as const),
    pickupWindowPolicy: 'FULL_WINDOW_WITHIN_INTERVAL' as const,
    warning:
      settings.weeklySchedule === null
        ? 'Horario de atención no configurado: no se valida contra franjas hasta que Administración lo configure.'
        : null,
  };
}
