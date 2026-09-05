export type Role = 'owner' | 'editor' | 'viewer'
export type GroupNode = { id: string; parentId: string | null; personalOwnerId: string | null }
export type GroupAccess = { role: Role; isPrivate: boolean }
const rank: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 }

// Iterative traversal avoids a call-stack limit for deeply nested groups.
export const resolveGroupAccess = (
  userId: string,
  nodes: GroupNode[],
  memberships: { groupId: string; role: Role }[],
): Map<string, GroupAccess> => {
  const children = new Map<string | null, GroupNode[]>()
  const direct = new Map(memberships.map(member => [member.groupId, member.role]))
  for (const node of nodes) {
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node)
    children.set(node.parentId, siblings)
  }
  const pending = (children.get(null) ?? []).map(node => ({ node, inherited: undefined as Role | undefined, vaultOwner: null as string | null }))
  const visited = new Set<string>()
  const access = new Map<string, GroupAccess>()
  while (pending.length) {
    const item = pending.pop()!
    if (visited.has(item.node.id)) continue
    visited.add(item.node.id)
    const vaultOwner = item.vaultOwner ?? item.node.personalOwnerId
    const ownRole = direct.get(item.node.id)
    let role = item.inherited
    if (ownRole && (!role || rank[ownRole] > rank[role])) role = ownRole
    if (vaultOwner) role = vaultOwner === userId ? 'owner' : undefined
    if (role) access.set(item.node.id, { role, isPrivate: vaultOwner !== null })
    for (const node of children.get(item.node.id) ?? []) pending.push({ node, inherited: role, vaultOwner })
  }
  return access
}
