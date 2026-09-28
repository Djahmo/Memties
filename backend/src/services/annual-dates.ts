export const nextAnnualDate = (date: string, today = new Date()) => {
  const [originalYear, month, day] = date.split('-').map(Number)
  const todayDate = today.toISOString().slice(0, 10)
  let year = Math.max(originalYear, today.getUTCFullYear())
  const occurrence = (value: number) => new Date(Date.UTC(value, month - 1, Math.min(day, new Date(Date.UTC(value, month, 0)).getUTCDate()))).toISOString().slice(0, 10)
  if (occurrence(year) < todayDate) year++
  return occurrence(year)
}
