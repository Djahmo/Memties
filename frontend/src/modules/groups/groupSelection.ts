import type { Group } from '../../types/api'

export const toggleGroupSelection = (groups: Group[], selected: string[], id: string, checked: boolean) => {
  if (!groups.some(group => group.id === id && group.role !== 'viewer')) return selected
  return checked ? [...new Set([...selected, id])] : selected.filter(groupId => groupId !== id)
}
