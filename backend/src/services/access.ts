import { eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { groupMembers, groups } from '../db/schema.js'
import { resolveGroupAccess } from './permissions.js'
import { ServiceError } from './errors.js'

export const loadAccess = async (db: Pick<Database, 'select'>, userId: string) => {
  const [nodes, memberships] = await Promise.all([
    db.select().from(groups),
    db.select({ groupId: groupMembers.groupId, role: groupMembers.role }).from(groupMembers).where(eq(groupMembers.userId, userId)),
  ])
  return { nodes, permissions: resolveGroupAccess(userId, nodes, memberships) }
}
export type Access = Awaited<ReturnType<typeof loadAccess>>

export const requireGroup = (access: Access, id: string, write = false) => {
  const permission = access.permissions.get(id)
  if (!permission) throw new ServiceError(404, 'Group not found.')
  if (write && permission.role === 'viewer') throw new ServiceError(403, 'This group is read-only.')
  return permission
}

export const groupScope = (access: Access, rootId?: string) => {
  if (!rootId) return [...access.permissions.keys()]
  requireGroup(access, rootId)
  const children = new Map<string, string[]>()
  for (const node of access.nodes) {
    if (!node.parentId) continue
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node.id)
    children.set(node.parentId, siblings)
  }
  const pending = [rootId]
  const visited = new Set<string>()
  const scope: string[] = []
  while (pending.length) {
    const id = pending.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    if (access.permissions.has(id)) scope.push(id)
    for (const child of children.get(id) ?? []) pending.push(child)
  }
  return scope
}
