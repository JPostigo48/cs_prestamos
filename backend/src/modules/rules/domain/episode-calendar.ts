import { effectiveSanctionStatus } from './entities/sanction-schedule.js';

export interface CalendarEntry {
  id: string;
  status: 'ACTIVA' | 'PROGRAMADA' | 'FINALIZADA' | 'ABSUELTA';
  startsAt: Date;
  endsAt: Date | null;
  /** Fecha del hecho, distinta del inicio eventualmente encolado. */
  effectiveAt?: Date;
}
const DAY = 86_400_000;
const ordered = (rows: readonly CalendarEntry[]) =>
  [...rows].sort(
    (a, b) =>
      a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id),
  );
function date(ms: number) {
  const value = new Date(ms);
  if (!Number.isFinite(value.getTime()))
    throw new RangeError('Calendario fuera de rango.');
  return value;
}

/** Amplía el tramo no cumplido; si terminó solo encola la diferencia. */
export function extendEpisodeCalendar(
  calendar: readonly CalendarEntry[],
  id: string,
  additionalDays: number | null,
  at: Date,
  observedAt: Date = at,
): CalendarEntry[] {
  if (
    !Number.isFinite(at.getTime()) ||
    !Number.isFinite(observedAt.getTime()) ||
    observedAt < at ||
    (additionalDays !== null &&
      (!Number.isSafeInteger(additionalDays) || additionalDays < 0))
  )
    throw new RangeError('Extensión inválida.');
  const rows = ordered(calendar).map((r) => ({ ...r }));
  const current = rows.find((r) => r.id === id);
  if (current?.status === 'ABSUELTA') return rows;
  if (additionalDays === null) {
    if (current)
      Object.assign(current, { status: 'ACTIVA', startsAt: at, endsAt: null });
    else rows.push({ id, status: 'ACTIVA', startsAt: at, endsAt: null });
    return rows;
  }
  if (additionalDays === 0) {
    if (!current)
      rows.push({ id, status: 'FINALIZADA', startsAt: at, endsAt: at });
    return rows;
  }
  const delta = additionalDays * DAY;
  if (current?.endsAt && current.endsAt > at) {
    const previousEnd = current.endsAt.getTime();
    current.endsAt = date(previousEnd + delta);
    current.status = effectiveSanctionStatus(
      { ...current, status: 'ACTIVA' },
      observedAt,
    );
    let cursor = current.endsAt.getTime();
    for (const next of rows) {
      if (
        next.id !== id &&
        next.endsAt &&
        next.status !== 'ABSUELTA' &&
        next.startsAt.getTime() >= previousEnd
      ) {
        if (next.startsAt.getTime() < cursor) {
          const duration = next.endsAt.getTime() - next.startsAt.getTime();
          next.startsAt = date(cursor);
          next.endsAt = date(cursor + duration);
          next.status = effectiveSanctionStatus(
            { ...next, status: 'ACTIVA' },
            observedAt,
          );
        }
        cursor = next.endsAt.getTime();
      }
    }
  } else {
    const start = rows
      .filter(
        (r) =>
          r.id !== id &&
          r.endsAt &&
          r.status !== 'ABSUELTA' &&
          // No encolar un hecho antiguo detrás de otros que todavía no habían
          // ocurrido. Las programadas por hechos previos sí son antecedentes.
          (r.effectiveAt
            ? r.effectiveAt <= at
            : current
              ? true
              : r.startsAt <= at),
      )
      .reduce((end, r) => Math.max(end, r.endsAt!.getTime()), at.getTime());
    const entry: CalendarEntry = {
      id,
      startsAt: date(start),
      endsAt: date(start + delta),
      status: effectiveSanctionStatus(
        {
          status: 'ACTIVA',
          startsAt: date(start),
          endsAt: date(start + delta),
        },
        observedAt,
      ),
      ...(current?.effectiveAt ? { effectiveAt: current.effectiveAt } : {}),
    };
    if (current) Object.assign(current, entry);
    else rows.push(entry);
    let cursor = start + delta;
    for (const next of ordered(rows)) {
      if (
        next.id === id ||
        !next.endsAt ||
        next.status === 'ABSUELTA' ||
        next.startsAt.getTime() < start
      )
        continue;
      if (next.startsAt.getTime() < cursor) {
        const duration = next.endsAt.getTime() - next.startsAt.getTime();
        next.startsAt = date(cursor);
        next.endsAt = date(cursor + duration);
        next.status = effectiveSanctionStatus(
          { ...next, status: 'ACTIVA' },
          observedAt,
        );
      }
      cursor = next.endsAt.getTime();
      // ordered devuelve las mismas referencias, conservando los cambios.
    }
  }
  return rows;
}

/** Quita solo tiempo restante; no devuelve tiempo ya cumplido ni pausa indefinidas. */
export function absolveEpisodeCalendar(
  calendar: readonly CalendarEntry[],
  id: string,
  at: Date,
): CalendarEntry[] {
  const rows = ordered(calendar).map((r) => ({ ...r }));
  const removed = rows.find((r) => r.id === id);
  if (!removed || removed.status === 'ABSUELTA') return rows;
  const oldEnd = removed.endsAt;
  removed.status = 'ABSUELTA';
  if (!oldEnd || oldEnd <= at) return rows;
  let cursor = Math.max(
    at.getTime(),
    Math.min(removed.startsAt.getTime(), oldEnd.getTime()),
  );
  for (const next of rows) {
    if (
      next.id === id ||
      !next.endsAt ||
      !['ACTIVA', 'PROGRAMADA'].includes(next.status) ||
      next.startsAt < oldEnd
    )
      continue;
    const duration = next.endsAt.getTime() - next.startsAt.getTime();
    next.startsAt = date(cursor);
    next.endsAt = date(cursor + duration);
    next.status = effectiveSanctionStatus(next, at);
    cursor = next.endsAt.getTime();
  }
  return rows;
}
