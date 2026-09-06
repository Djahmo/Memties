import { and, eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { groupMembers, groups } from '../db/schema.js'
import { resolveGroupAccess } from './permissions.js'
import { ServiceError } from './errors.js'

export const loadAccess = async (db: Pick<Database, 'select'>, userId: string) => {
  const rows = await db.select({ node: groups, role: groupMembers.role }).from(groups)
    .leftJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId)))
  const nodes = rows.map(row => row.node)
  const memberships = rows.flatMap(row => row.role ? [{ groupId: row.node.id, role: row.role }] : [])
  return { nodes, permissions: resolveGroupAccess(userId, nodes, memberships) }
}
// V1 serializes writes against structural and membership changes in one lock order.
export const lockAccess = async (db: Pick<Database, 'select'>, userId: string) => {
  await db.select({ id: groups.id }).from(groups).orderBy(groups.id).for('update')
  return loadAccess(db, userId)
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
