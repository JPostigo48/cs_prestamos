export const dateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleString('es-PE', { timeZone: 'America/Lima' }) + ' (Lima)'
}
