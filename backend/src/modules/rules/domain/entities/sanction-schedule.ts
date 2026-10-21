import { SuspensionType } from './usage-rule.js';

export type SanctionSchedule = {
  status: 'PROGRAMADA' | 'ACTIVA' | 'FINALIZADA';
  startsAt: Date;
  endsAt: Date | null;
};

export function scheduleSanction(
  type: SuspensionType,
  days: number | null,
  registeredAt: Date,
  pendingEndsAt: readonly Date[],
): SanctionSchedule {
  if (type === SuspensionType.NONE) {
    if (days !== null && days !== 0) throw new RangeError('La política sin suspensión no admite días.');
    return { status: 'FINALIZADA', startsAt: registeredAt, endsAt: registeredAt };
  }
  if (type === SuspensionType.INDEFINITE) {
    if (days !== null) throw new RangeError('El bloqueo indefinido no admite días.');
    return { status: 'ACTIVA', startsAt: registeredAt, endsAt: null };
  }
  if (type !== SuspensionType.TEMPORARY || !Number.isSafeInteger(days) || days! <= 0) {
    throw new RangeError('La suspensión temporal requiere días positivos.');
  }

  const start = pendingEndsAt.reduce((latest, date) => Math.max(latest, date.getTime()), registeredAt.getTime());
  const end = start + days! * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(end) || Number.isNaN(new Date(end).getTime())) {
    throw new RangeError('La duración excede el rango de fechas permitido.');
  }
  return {
    status: start > registeredAt.getTime() ? 'PROGRAMADA' : 'ACTIVA',
    startsAt: new Date(start),
    endsAt: new Date(end),
  };
}
