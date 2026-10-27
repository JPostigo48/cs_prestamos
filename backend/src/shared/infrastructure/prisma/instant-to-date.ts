import { Temporal } from 'temporal-polyfill/full';

/** Convert a decoded timestamptz to the Date required by the domain. */
export function instantToDate(value: unknown): Date {
  if (!(value instanceof Temporal.Instant)) {
    throw new TypeError('Expected a Temporal.Instant from the persistence client');
  }
  return new Date(value.epochMilliseconds);
}

export function nullableInstantToDate(value: unknown): Date | null {
  return value === null ? null : instantToDate(value);
}
