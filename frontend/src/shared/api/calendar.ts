// Date.parse normaliza días inexistentes (p.ej. 30 de febrero); comprobar calendario primero.
export function validInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value)
  if (!match) return false
  const [, y, m, d, h, min, s] = match
  const year = Number(y), month = Number(m), day = Number(d)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const zone = match[7]!
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]! && Number(h) <= 23 && Number(min) <= 59 && Number(s) <= 59 && !/^[+-]14:(?!00)/.test(zone) && Number.isFinite(Date.parse(value))
}
export function validPeriod(startsAt: unknown, endsAt: unknown): boolean {
  return validInstant(startsAt) && (endsAt === null || (validInstant(endsAt) && Date.parse(endsAt) > Date.parse(startsAt)))
}
