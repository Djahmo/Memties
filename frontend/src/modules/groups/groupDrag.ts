import type { Group } from '../../types/api'

export type GroupRow = { group: Group; depth: number }
export type GroupDrop = { parentId: string | null; beforeId: string | null; index: number; depth: number }

export const compareGroups = (a: Group, b: Group) => a.position - b.position || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)

export const canMoveGroup = (groups: Group[], source: Group, parentId: string | null) => {
  if (source.isPersonal || source.role !== 'owner') return false
  if (parentId === source.parentId) return true
  if (parentId === null) return true
  const visited = new Set([source.id])
  let ancestor = groups.find(group => group.id === parentId)
  if (!ancestor || ancestor.role !== 'owner') return false
  while (ancestor) {
    if (visited.has(ancestor.id)) return false
    visited.add(ancestor.id)
    ancestor = groups.find(group => group.id === ancestor?.parentId)
  }
  return true
}

export const projectGroupDrop = (groups: Group[], rows: GroupRow[], index: number, placement: 'before' | 'inside' | 'after', source: Group): GroupDrop | null => {
  const row = rows[index]
  if (!row || row.group.id === source.id) return null
  const parentId = placement === 'inside' ? row.group.id : row.group.parentId
  if (!canMoveGroup(groups, source, parentId)) return null
  const siblings = groups.filter(group => group.parentId === parentId && group.id !== source.id).sort(compareGroups)
  const beforeId = placement === 'inside' ? siblings[0]?.id ?? null
    : placement === 'before' ? row.group.id
      : siblings[siblings.findIndex(group => group.id === row.group.id) + 1]?.id ?? null
  let insertionIndex = index
  if (placement === 'inside') insertionIndex++
  if (placement === 'after') {
    insertionIndex++
    while (insertionIndex < rows.length && rows[insertionIndex]!.depth > row.depth) insertionIndex++
  }
  if (parentId === source.parentId) {
    const current = groups.filter(group => group.parentId === parentId).sort(compareGroups)
    if ((current[current.findIndex(group => group.id === source.id) + 1]?.id ?? null) === beforeId) return null
  }
  return { parentId, beforeId, index: insertionIndex, depth: row.depth + (placement === 'inside' ? 1 : 0) }
}

export const previewGroupMove = (groups: Group[], source: Group, target: GroupDrop): Group => {
  const siblings = groups.filter(group => group.parentId === target.parentId && group.id !== source.id).sort(compareGroups)
  const nextIndex = target.beforeId ? siblings.findIndex(group => group.id === target.beforeId) : -1
  const next = siblings[nextIndex]?.position
  return {
    ...source,
    parentId: target.parentId,
    position: next === undefined ? (siblings.at(-1)?.position ?? 0) + 1024
      : ((siblings[nextIndex - 1]?.position ?? next - 2048) + next) / 2,
  }
}
