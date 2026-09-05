import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { groupMembers, groups, users } from '../db/schema.js'
import { loadAccess, requireGroup } from './access.js'
import type { Access } from './access.js'
import type { Role } from './permissions.js'
import { ServiceError } from './errors.js'

const assertSharingOwner = (access: Access, id: string) => {
  const permission = requireGroup(access, id)
  if (permission.isPrivate) throw new ServiceError(403, 'Personal groups cannot be shared.')
  if (permission.role !== 'owner') throw new ServiceError(403, 'Only an owner can manage this group.')
}
const ancestors = (access: Access, id: string) => {
  const ids: string[] = []
  let current = access.nodes.find(group => group.id === id)
  while (current) { ids.push(current.id); current = access.nodes.find(group => group.id === current?.parentId) }
  return ids
}
const rank: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 }

export const createSharingService = (db: Database) => ({
  list: async (userId: string, id: string) => {
    const access = await loadAccess(db, userId)
    assertSharingOwner(access, id)
    const rows = await db.select({ userId: users.id, displayName: users.displayName, email: users.email, groupId: groupMembers.groupId, role: groupMembers.role })
      .from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId)).where(inArray(groupMembers.groupId, ancestors(access, id)))
    const members = new Map<string, { userId: string; displayName: string; email: string; role: Role; directRole: Role | null; inheritedRole: Role | null }>()
    for (const row of rows) {
      const member = members.get(row.userId) ?? { userId: row.userId, displayName: row.displayName, email: row.email, role: row.role, directRole: null, inheritedRole: null }
      if (rank[row.role] > rank[member.role]) member.role = row.role
      if (row.groupId === id) member.directRole = row.role
      else if (!member.inheritedRole || rank[row.role] > rank[member.inheritedRole]) member.inheritedRole = row.role
      members.set(row.userId, member)
    }
    return [...members.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
  },
  set: async (userId: string, id: string, input: { email: string; role: Role }) => {
    const access = await loadAccess(db, userId)
    assertSharingOwner(access, id)
    const chain = ancestors(access, id)
    await db.transaction(async tx => {
      // Every membership change in this tree locks the same root, protecting its last owner.
      await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, chain.at(-1)!)).for('update')
      assertSharingOwner(await loadAccess(tx, userId), id)
      const [target] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1)
      if (!target) throw new ServiceError(404, 'No account with this email.')
      await tx.insert(groupMembers).values({ groupId: id, userId: target.id, role: input.role }).onDuplicateKeyUpdate({ set: { role: input.role } })
      const owners = await tx.select({ id: groupMembers.userId }).from(groupMembers).where(and(inArray(groupMembers.groupId, chain), eq(groupMembers.role, 'owner')))
      if (!owners.length) throw new ServiceError(409, 'A group must keep at least one owner.')
    })
  },
  remove: async (userId: string, id: string, targetId: string) => {
    const access = await loadAccess(db, userId)
    assertSharingOwner(access, id)
    const chain = ancestors(access, id)
    await db.transaction(async tx => {
      await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, chain.at(-1)!)).for('update')
      assertSharingOwner(await loadAccess(tx, userId), id)
      const [result] = await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, targetId)))
      if (!result.affectedRows) throw new ServiceError(404, 'No direct membership in this group.')
      const owners = await tx.select({ id: groupMembers.userId }).from(groupMembers).where(and(inArray(groupMembers.groupId, chain), eq(groupMembers.role, 'owner')))
      if (!owners.length) throw new ServiceError(409, 'A group must keep at least one owner.')
    })
  },
})
