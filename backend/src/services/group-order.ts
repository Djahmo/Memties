import { ServiceError } from './errors.js'

export const insertionPosition = (siblings: { id: string; position: number }[], beforeId: string | null = null) => {
  const ordered = [...siblings].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  if (!beforeId) return (ordered.at(-1)?.position ?? 0) + 1024
  const index = ordered.findIndex(group => group.id === beforeId)
  if (index < 0) throw new ServiceError(409, 'The destination changed. Please try again.')
  const next = ordered[index]!.position
  const previous = ordered[index - 1]?.position ?? next - 2048
  const position = previous + (next - previous) / 2
  if (position <= previous || position >= next) throw new ServiceError(409, 'The destination changed. Please try again.')
  return position
}
