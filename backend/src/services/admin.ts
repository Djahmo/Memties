import { and, asc, eq, inArray, like, ne, or, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { apiTokens, entries, entryPeople, groupMembers, groups, identities, oauthRecords, people, personGroups, reminders, samlRequests, sessions, users } from '../db/schema.js'
import { accountRole, administratorEmails } from '../auth/admin.js'
import { ServiceError } from './errors.js'
import { lockAccess } from './access.js'

export const createAdminService = (db: Database, adminEmails = '') => {
  const admins = administratorEmails(adminEmails)
  return {
    list: async (offset: number) => {
      const rows = await db.select({ id: users.id, email: users.email, displayName: users.displayName, status: users.status, createdAt: users.createdAt })
        .from(users).orderBy(asc(users.createdAt), asc(users.id)).limit(51).offset(offset)
      const page = rows.slice(0, 50)
      const methods = page.length ? await db.select({ userId: identities.userId, provider: identities.provider }).from(identities).where(inArray(identities.userId, page.map(user => user.id))) : []
      return {
        items: page.map(user => ({ ...user, role: accountRole(user.email, admins), methods: [...new Set(methods.filter(method => method.userId === user.id).map(method => method.provider.split(':')[0]))] })),
        nextOffset: rows.length > 50 ? offset + 50 : null,
      }
    },
    setStatus: async (actorId: string, userId: string, status: 'active' | 'suspended') => db.transaction(async tx => {
      const [account] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId)).for('update')
      if (!account) throw new ServiceError(404, 'User not found.')
      if (status === 'suspended' && (actorId === userId || accountRole(account.email, admins) === 'admin')) throw new ServiceError(403, 'Administrator accounts cannot be suspended. Remove their email from ADMIN_EMAILS first.')
      await tx.update(users).set({ status }).where(eq(users.id, userId))
      if (status === 'suspended') {
        await tx.delete(sessions).where(eq(sessions.userId, userId))
        await tx.delete(apiTokens).where(eq(apiTokens.userId, userId))
      }
      return { success: true }
    }),
    remove: async (actorId: string, userId: string, email: string) => db.transaction(async tx => {
      const { nodes } = await lockAccess(tx, userId)
      const [account] = await tx.select().from(users).where(eq(users.id, userId)).for('update')
      if (!account) throw new ServiceError(404, 'User not found.')
      if (actorId === userId || accountRole(account.email, admins) === 'admin') throw new ServiceError(403, 'Administrator accounts cannot be deleted.')
      if (account.status !== 'suspended') throw new ServiceError(409, 'Suspend the account before deleting it.')
      if (email.trim().toLowerCase() !== account.email.toLowerCase()) throw new ServiceError(400, 'The confirmation email does not match.')
      const memberships = await tx.select().from(groupMembers)
      const children = new Map<string, string[]>()
      for (const node of nodes) if (node.parentId) children.set(node.parentId, [...children.get(node.parentId) ?? [], node.id])
      const subtree = (id: string) => {
        const result = [id]
        const visited = new Set(result)
        for (let index = 0; index < result.length; index++) for (const child of children.get(result[index]!) ?? []) {
          if (visited.has(child)) throw new ServiceError(409, 'Invalid group hierarchy.')
          visited.add(child); result.push(child)
        }
        return result
      }
      const deletedGroups = new Set<string>()
      for (const node of nodes) {
        if (node.personalOwnerId === userId) for (const id of subtree(node.id)) deletedGroups.add(id)
        if (node.parentId || node.personalOwnerId || !memberships.some(member => member.groupId === node.id && member.userId === userId && member.role === 'owner')) continue
        const ids = subtree(node.id)
        if (memberships.some(member => ids.includes(member.groupId) && member.userId !== userId)) continue
        const [otherEntry] = await tx.select({ id: entries.id }).from(entries).where(and(inArray(entries.groupId, ids), ne(entries.creatorId, userId))).limit(1)
        const [otherPerson] = await tx.select({ id: people.id }).from(people).innerJoin(personGroups, eq(personGroups.personId, people.id))
          .where(and(inArray(personGroups.groupId, ids), ne(people.creatorId, userId))).limit(1)
        if (!otherEntry && !otherPerson) for (const id of ids) deletedGroups.add(id)
      }
      const byId = new Map(nodes.map(node => [node.id, node]))
      for (const node of nodes) {
        if (deletedGroups.has(node.id)) continue
        const chain = new Set<string>()
        let current: typeof node | undefined = node
        while (current && !chain.has(current.id)) { chain.add(current.id); current = current.parentId ? byId.get(current.parentId) : undefined }
        const owners = memberships.filter(member => chain.has(member.groupId) && member.role === 'owner')
        if (owners.some(owner => owner.userId === userId) && !owners.some(owner => owner.userId !== userId)) throw new ServiceError(409, 'Assign another owner to shared groups before deleting this account.')
      }
      const groupIds = [...deletedGroups]
      const entryIds = (await tx.select({ id: entries.id }).from(entries).where(or(eq(entries.creatorId, userId), groupIds.length ? inArray(entries.groupId, groupIds) : undefined))).map(row => row.id)
      const personIds = new Set((await tx.select({ id: people.id }).from(people).where(eq(people.creatorId, userId))).map(row => row.id))
      if (groupIds.length) {
        const privateContacts = await tx.select().from(personGroups).where(inArray(personGroups.groupId, groupIds))
        const candidateIds = [...new Set(privateContacts.map(link => link.personId))]
        const links = candidateIds.length ? await tx.select().from(personGroups).where(inArray(personGroups.personId, candidateIds)) : []
        for (const id of candidateIds) if (links.filter(link => link.personId === id).every(link => deletedGroups.has(link.groupId))) personIds.add(id)
      }
      await tx.delete(reminders).where(or(eq(reminders.creatorId, userId), entryIds.length ? inArray(reminders.entryId, entryIds) : undefined))
      if (entryIds.length) await tx.delete(entries).where(inArray(entries.id, entryIds))
      if (personIds.size) {
        await tx.delete(entryPeople).where(inArray(entryPeople.personId, [...personIds]))
        await tx.delete(people).where(inArray(people.id, [...personIds]))
      }
      if (groupIds.length) {
        await tx.delete(personGroups).where(inArray(personGroups.groupId, groupIds))
        // Detach the deleted hierarchy first to satisfy the self-referencing foreign key.
        await tx.update(groups).set({ parentId: null }).where(inArray(groups.id, groupIds))
        await tx.delete(groups).where(inArray(groups.id, groupIds))
      }
      await tx.delete(samlRequests).where(and(like(samlRequests.id, 'flow:%'), eq(samlRequests.value, userId)))
      await tx.delete(oauthRecords).where(and(like(oauthRecords.id, 'code:%'), sql`JSON_UNQUOTE(JSON_EXTRACT(${oauthRecords.value}, '$.userId')) = ${userId}`))
      // Identity, membership, session, API-token and push-subscription rows cascade.
      await tx.delete(users).where(eq(users.id, userId))
      return { success: true }
    }),
  }
}
