import type { Group } from '../../types/api'
import { compareGroups } from './groupDrag'

export const groupLabel = (groups: Group[], id: string) => {
  const names: string[] = []
  const visited = new Set<string>()
  let current = groups.find(group => group.id === id)
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.unshift(current.name)
    current = groups.find(group => group.id === current?.parentId)
  }
  return names.join(' / ')
}

export const groupRows = (groups: Group[]) => {
  const children = new Map<string | null, Group[]>()
  const ids = new Set(groups.map(group => group.id))
  for (const group of groups) {
    const parentId = group.parentId && ids.has(group.parentId) ? group.parentId : null
    children.set(parentId, [...children.get(parentId) ?? [], group])
  }
  for (const siblings of children.values()) {
    siblings.sort(compareGroups)
  }
  const pending = [...children.get(null) ?? []].reverse().map(group => ({ group, depth: 0 }))
  const rows: { group: Group; depth: number }[] = []
  const visited = new Set<string>()
  while (pending.length) {
    const row = pending.pop()!
    if (visited.has(row.group.id)) continue
    visited.add(row.group.id)
    rows.push(row)
    for (const child of [...children.get(row.group.id) ?? []].reverse()) {
      pending.push({ group: child, depth: row.depth + 1 })
    }
  }
  return rows
}
