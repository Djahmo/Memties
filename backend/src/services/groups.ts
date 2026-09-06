import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { entries, groupMembers, groups, personGroups } from '../db/schema.js'
import { ServiceError } from './errors.js'
import { loadAccess, lockAccess, requireGroup } from './access.js'

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
    move: async (userId: string, id: string, parentId: string | null) => {
      await db.transaction(async tx => {
        // Serialize structural changes before checking ancestry and inherited access.
        const nodes = await tx.select().from(groups).orderBy(groups.id).for('update')
        const access = await loadAccess(tx, userId)
        const node = nodes.find(item => item.id === id)
        const permission = access.permissions.get(id)
        if (!node || !permission) throw new ServiceError(404, 'Group not found.')
        if (permission.role !== 'owner') throw new ServiceError(403, 'Only an owner can manage this group.')
        if (node.personalOwnerId) throw new ServiceError(403, 'The Personal vault is protected.')
        if (parentId === node.parentId) return
        const destination = parentId ? access.permissions.get(parentId) : undefined
        if (parentId && !destination) throw new ServiceError(404, 'Group not found.')
        if (destination && destination.role !== 'owner') throw new ServiceError(403, 'Only an owner can manage this group.')
        if (permission.isPrivate !== (destination?.isPrivate ?? false)) {
          throw new ServiceError(403, 'Groups cannot cross the Personal vault boundary.')
        }
        const visited = new Set<string>([id])
        let ancestor = parentId
        while (ancestor) {
          if (visited.has(ancestor)) throw new ServiceError(400, 'A group cannot be moved into itself or its descendants.')
          visited.add(ancestor)
          ancestor = nodes.find(item => item.id === ancestor)?.parentId ?? null
        }
        await tx.update(groups).set({ parentId }).where(eq(groups.id, id))
        // A detached root needs an explicit owner after inherited access disappears.
        if (!parentId) await tx.insert(groupMembers).values({ groupId: id, userId, role: 'owner' })
          .onDuplicateKeyUpdate({ set: { role: 'owner' } })
      })
      return { success: true }
    },
    remove: async (userId: string, id: string) => {
      await db.transaction(async tx => {
        const nodes = await tx.select().from(groups).orderBy(groups.id).for('update')
        const access = await loadAccess(tx, userId)
        const node = nodes.find(item => item.id === id)
        const permission = access.permissions.get(id)
        if (!node || !permission) throw new ServiceError(404, 'Group not found.')
        if (permission.role !== 'owner') throw new ServiceError(403, 'Only an owner can manage this group.')
        if (node.personalOwnerId) throw new ServiceError(403, 'The Personal vault is protected.')
        const contacts = await tx.select({ id: personGroups.personId }).from(personGroups).where(eq(personGroups.groupId, id)).limit(1).for('update')
        const history = await tx.select({ id: entries.id }).from(entries).where(eq(entries.groupId, id)).limit(1).for('update')
        if (nodes.some(item => item.parentId === id) || contacts.length || history.length) {
          throw new ServiceError(409, 'Only empty groups can be deleted.')
        }
        await tx.delete(groups).where(eq(groups.id, id))
      })
      return { success: true }
    },
    create: async (userId: string, input: { name: string; description: string; parentId: string | null }) => {
      if (input.parentId) await requireOwner(userId, input.parentId)
      const id = randomUUID()
      await db.transaction(async tx => {
        const access = await lockAccess(tx, userId)
        if (input.parentId && requireGroup(access, input.parentId).role !== 'owner') throw new ServiceError(403, 'Only an owner can manage this group.')
        await tx.insert(groups).values({ id, ...input })
        // Child access comes exclusively from its parent at creation.
        if (!input.parentId) await tx.insert(groupMembers).values({ userId, groupId: id, role: 'owner' })
      })
      return (await list(userId)).find(group => group.id === id)!
    },
    update: async (userId: string, id: string, input: { name: string; description: string }) => {
      const group = await requireOwner(userId, id)
      if (group.isPersonal) throw new ServiceError(403, 'The Personal vault is protected.')
      await db.transaction(async tx => {
        const access = await lockAccess(tx, userId)
        if (requireGroup(access, id).role !== 'owner') throw new ServiceError(403, 'Only an owner can manage this group.')
        await tx.update(groups).set(input).where(eq(groups.id, id))
      })
      return { ...group, ...input }
    },
  }
}
