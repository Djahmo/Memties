import type { Group } from '../../types/api'

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
