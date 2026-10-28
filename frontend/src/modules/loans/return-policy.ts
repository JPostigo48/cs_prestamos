export interface ReturnInput { returnedAt: string; observation?: string }

export function returnInput(date: string, incident: boolean, description: string, startsAt: string, now = Date.now()): ReturnInput {
  const time = new Date(date).getTime()
  if (!date || !Number.isFinite(time)) throw new Error('Indica una fecha y hora válidas.')
  if (time !== now) throw new Error('La devolución ordinaria debe usar el instante actual de confirmación, sin anticipar ni antedatar.')
  if (!Number.isFinite(new Date(startsAt).getTime())) throw new Error('El inicio del préstamo no es válido.')
  if (time < new Date(startsAt).getTime()) throw new Error('La devolución no puede preceder al inicio del préstamo.')
  const observation = description.trim()
  if (incident && !observation) throw new Error('Describe la incidencia que requiere revisión.')
  if (incident && observation.length > 1000) throw new Error('La descripción admite como máximo 1000 caracteres.')
  return { returnedAt: new Date(time).toISOString(), ...(incident ? { observation } : {}) }
}

export function localDateTime(now = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, -1)
}

export function uncertainReturn(status: number | undefined): boolean {
  return status === undefined || status === 0 || status >= 500
}
