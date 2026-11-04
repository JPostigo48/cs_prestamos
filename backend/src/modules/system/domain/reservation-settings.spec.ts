import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReservationDto } from '../../loans/presentation/dto/create-reservation.dto.js';
import {
  calculatePickupDeadline,
  presentSettings,
  validateSettingsPatch,
  type OpeningDay,
} from './reservation-settings.js';

const weeklySchedule: OpeningDay[] = Array.from({ length: 7 }, (_, i) => ({
  day: i + 1,
  intervals: i === 0 ? [{ opens: '09:00', closes: '17:00' }] : [],
}));
const settings = {
  pickupWaitMinutes: 45,
  weeklySchedule,
  version: 2,
  updatedAt: '2026-11-01T00:00:00Z',
};
const now = new Date('2026-11-01T00:00:00Z');

describe('Reservation operational policy (pure, institution timezone)', () => {
  it('accepts complete schedule, closed days, touching non-overlapping intervals and boundaries', () => {
    expect(() => validateSettingsPatch({ weeklySchedule })).not.toThrow();
    expect(() =>
      validateSettingsPatch({
        weeklySchedule: weeklySchedule.map((d) =>
          d.day === 1
            ? {
                ...d,
                intervals: [
                  { opens: '09:00', closes: '12:00' },
                  { opens: '12:00', closes: '17:00' },
                ],
              }
            : d,
        ),
      }),
    ).not.toThrow();
    for (const pickupWaitMinutes of [1, 240])
      expect(() => validateSettingsPatch({ pickupWaitMinutes })).not.toThrow();
  });
  it.each([0, -1, 241, 1.5, NaN, null, '30'])(
    'rejects invalid minutes %s',
    (minutes) => {
      expect(() =>
        validateSettingsPatch({ pickupWaitMinutes: minutes as number }),
      ).toThrow();
    },
  );
  it.each(
    [
      [],
      weeklySchedule.slice(1),
      [...weeklySchedule.slice(0, 6), weeklySchedule[0]],
      weeklySchedule.map((d) => ({ ...d, day: 0 })),
      weeklySchedule.map((d) => ({
        ...d,
        intervals: [{ opens: '24:00', closes: '25:00' }],
      })),
      weeklySchedule.map((d) => ({
        ...d,
        intervals: [{ opens: '9:00', closes: '17:00' }],
      })),
      weeklySchedule.map((d) => ({
        ...d,
        intervals: [{ opens: '17:00', closes: '09:00' }],
      })),
      weeklySchedule.map((d) => ({
        ...d,
        intervals: [{ opens: '09:00', closes: '09:00' }],
      })),
      weeklySchedule.map((d) => ({
        ...d,
        intervals: [
          { opens: '09:00', closes: '12:00' },
          { opens: '11:00', closes: '17:00' },
        ],
      })),
    ].map((schedule) => [schedule] as const),
  )('rejects invalid weekly schedule %#', (schedule) => {
    expect(() => validateSettingsPatch({ weeklySchedule: schedule })).toThrow();
  });
  it('rejects empty patch but explicitly permits unconfigured schedule', () => {
    expect(() => validateSettingsPatch({})).toThrow();
    expect(() => validateSettingsPatch({ weeklySchedule: null })).not.toThrow();
    expect(
      presentSettings({ ...settings, weeklySchedule: null }),
    ).toMatchObject({
      scheduleStatus: 'UNCONFIGURED',
      warning: expect.any(String),
    });
    expect(
      calculatePickupDeadline(
        new Date('2026-11-02T03:00:00Z'),
        { ...settings, weeklySchedule: null },
        now,
      ).toISOString(),
    ).toBe('2026-11-02T03:45:00.000Z');
  });
  it.each([
    '2026-11-02T16:15:00-05:00',
    '2026-11-02T21:15:00Z',
    '2026-11-03T06:15:00+09:00',
  ])('same instant/closing boundary with offset %s', (input) => {
    expect(
      calculatePickupDeadline(new Date(input), settings, now).toISOString(),
    ).toBe('2026-11-02T22:00:00.000Z');
  });
  it.each([
    '2026-11-02T16:15:00.001-05:00',
    '2026-11-02T17:00:00-05:00',
    '2026-11-02T08:59:59-05:00',
    '2026-11-03T09:00:00-05:00',
    '2026-11-02T03:00:00Z', // UTC Monday is still closed Sunday in Lima.
  ])('rejects closed/outside/incomplete window %s', (input) => {
    expect(() =>
      calculatePickupDeadline(new Date(input), settings, now),
    ).toThrow();
  });
  it('includes opening and rejects past/NaN independent of configured schedule', () => {
    expect(
      calculatePickupDeadline(
        new Date('2026-11-02T09:00:00-05:00'),
        settings,
        now,
      ).toISOString(),
    ).toBe('2026-11-02T14:45:00.000Z');
    for (const date of [new Date(NaN), new Date(now.getTime() - 1)])
      expect(() =>
        calculatePickupDeadline(
          date,
          { ...settings, weeklySchedule: null },
          now,
        ),
      ).toThrow();
  });
  it.each([
    '2026-11-02',
    '2026-11-02T09:00:00',
    '2026-02-30T09:00:00Z',
    '2026-11-02T09:00:00+99:00',
    '2026-11-02T24:00:00Z',
    'invalid',
  ])('DTO rejects ambiguous/invalid date %s', async (requestedAt) => {
    const dto = plainToInstance(CreateReservationDto, {
      copyId: '123e4567-e89b-42d3-a456-000000000001',
      requestedAt,
    });
    expect(
      (await validate(dto)).some((e) => e.property === 'requestedAt'),
    ).toBe(true);
  });
});
