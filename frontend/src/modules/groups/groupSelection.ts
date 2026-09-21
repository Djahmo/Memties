import type { Group } from '../../types/api'

export const includeParentGroups = (groups: Group[], selected: string[]) => {
  const result = new Set(selected)
  const byId = new Map(groups.map(group => [group.id, group]))
  for (const id of selected) {
    const visited = new Set<string>()
    let current = byId.get(id)
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      // Automatic selection must respect the same permissions as manual selection.
      if (current.role !== 'viewer') result.add(current.id)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
  }
  return [...result]
}

export const toggleGroupSelection = (groups: Group[], selected: string[], id: string, checked: boolean) => {
  if (groups.find(group => group.id === id)?.role === 'viewer') return selected
  if (checked) return includeParentGroups(groups, [...selected, id])
  const removed = new Set([id])
  const pending = [id]
  while (pending.length) {
    const parentId = pending.pop()
    for (const group of groups) {
      if (group.parentId === parentId && !removed.has(group.id)) {
        removed.add(group.id)
        pending.push(group.id)
      }
    }
  }
  return selected.filter(groupId => !removed.has(groupId))
}
