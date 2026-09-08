export type User = { id: string; email: string; displayName: string; role?: 'admin' | 'user' }
export type Group = {
  id: string
  name: string
  description: string
  parentId: string | null
  isPersonal: boolean
  isPrivate: boolean
  role: 'owner' | 'editor' | 'viewer'
}

export type Page<T> = { items: T[]; nextOffset: number | null }
export type Person = {
  id: string; displayName: string; firstName: string; lastName: string; nickname: string
  email: string; phone: string; organization: string; jobTitle: string; notes: string
  groupIds: string[]; canEdit: boolean; createdAt: string; updatedAt: string
}

export type GroupMember = { userId: string; displayName: string; email: string; role: Group['role']; directRole: Group['role'] | null; inheritedRole: Group['role'] | null }
export type Entry = {
  id: string; title: string; body: string; occurredAt: string; groupId: string
  creatorId: string; creatorName: string; source: 'web' | 'mcp'
  people: { id: string; displayName: string }[]; canEdit: boolean
  createdAt: string; updatedAt: string
}
