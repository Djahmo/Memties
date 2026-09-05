import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { groupMembers, groups } from '../db/schema.js'
import { ServiceError } from './errors.js'
import { loadAccess } from './access.js'

export const createGroupService = (db: Database) => {
  const list = async (userId: string) => {
    const { nodes, permissions: access } = await loadAccess(db, userId)
    return nodes.flatMap(node => {
      const permission = access.get(node.id)
      if (!permission) return []
      return [{ id: node.id, name: node.name, description: node.description,
        parentId: node.parentId && access.has(node.parentId) ? node.parentId : null,
        isPersonal: node.personalOwnerId !== null, ...permission }]
    })
  }

  const requireOwner = async (userId: string, id: string) => {
    const group = (await list(userId)).find(item => item.id === id)
    if (!group) throw new ServiceError(404, 'Group not found.')
    if (group.role !== 'owner') throw new ServiceError(403, 'Only an owner can manage this group.')
    return group
  }

  return {
    list,
    create: async (userId: string, input: { name: string; description: string; parentId: string | null }) => {
      if (input.parentId) await requireOwner(userId, input.parentId)
      const id = randomUUID()
      await db.transaction(async tx => {
        await tx.insert(groups).values({ id, ...input })
        // Child access comes exclusively from its parent at creation.
        if (!input.parentId) await tx.insert(groupMembers).values({ userId, groupId: id, role: 'owner' })
      })
      return (await list(userId)).find(group => group.id === id)!
    },
    update: async (userId: string, id: string, input: { name: string; description: string }) => {
      const group = await requireOwner(userId, id)
      if (group.isPersonal) throw new ServiceError(403, 'The Personal vault is protected.')
      await db.update(groups).set(input).where(eq(groups.id, id))
      return { ...group, ...input }
    },
  }
}
