import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, exists, inArray, or, sql } from 'drizzle-orm'
import type { Database, ServiceDatabase } from '../db/index.js'
import { groups, people, personGroups } from '../db/schema.js'
import { selfContactId } from './self-contact.js'
import { groupScope, loadAccess, lockAccess, requireGroup } from './access.js'
import type { Access } from './access.js'
import { ServiceError } from './errors.js'
import type { ListInput, PersonInput } from './content-input.js'
import { searchPattern } from './content-input.js'

export const personVisibility = (db: Pick<Database, 'select'>, groupIds: string[]) => groupIds.length
  ? exists(db.select({ id: personGroups.personId }).from(personGroups).where(and(eq(personGroups.personId, people.id), inArray(personGroups.groupId, groupIds))))
  : sql`false`

export const visiblePersonIds = (db: Pick<Database, 'select'>, access: Access) => db.select({ id: people.id }).from(people).where(personVisibility(db, [...access.permissions.keys()]))

export const requirePerson = async (db: Pick<Database, 'select'>, access: Access, id: string) => {
  const [person] = await db.select().from(people).where(and(eq(people.id, id), personVisibility(db, [...access.permissions.keys()]))).limit(1)
  if (!person) throw new ServiceError(404, 'Person not found.')
  return person
}

export const createPeopleService = (db: ServiceDatabase) => {
  const present = async (userId: string, access: Access, rows: typeof people.$inferSelect[]) => {
    if (!rows.length) return []
    const links = await db.select().from(personGroups).where(inArray(personGroups.personId, rows.map(person => person.id)))
    return rows.map(person => {
      const groupIds = links.filter(link => link.personId === person.id).map(link => link.groupId)
      return {
        id: person.id, isSelf: person.userId === userId, displayName: person.displayName, firstName: person.firstName, lastName: person.lastName,
        nickname: person.nickname, email: person.email, phone: person.phone, organization: person.organization,
        jobTitle: person.jobTitle, notes: person.notes, createdAt: person.createdAt, updatedAt: person.updatedAt,
        groupIds: groupIds.filter(id => access.permissions.has(id)),
        canEdit: (!person.userId || person.userId === userId) && groupIds.length > 0 && groupIds.every(id => access.permissions.has(id) && access.permissions.get(id)?.role !== 'viewer'),
      }
    })
  }
  const get = async (userId: string, id: string) => {
    const access = await loadAccess(db, userId)
    return (await present(userId, access, [await requirePerson(db, access, id)]))[0]
  }
  return {
    get,
    self: async (userId: string) => get(userId, await selfContactId(db, userId)),
    update: async (userId: string, id: string, input: PersonInput) => {
      await requirePerson(db, await loadAccess(db, userId), id)
      await db.transaction(async tx => {
        const access = await lockAccess(tx, userId)
        const [person] = await tx.select({ userId: people.userId }).from(people).where(eq(people.id, id)).for('update')
        if (person?.userId && person.userId !== userId) throw new ServiceError(403, 'You cannot edit this contact.')
        const links = await tx.select().from(personGroups).where(eq(personGroups.personId, id))
        if (!links.length || links.some(link => !access.permissions.has(link.groupId) || access.permissions.get(link.groupId)?.role === 'viewer')) {
          throw new ServiceError(403, 'You cannot edit this contact.')
        }
        const { groupIds, ...fields } = input
        const retainedGroups = new Set(groupIds)
        if (person?.userId === userId) {
          const [personal] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.personalOwnerId, userId))
          if (personal) retainedGroups.add(personal.id)
        }
        for (const groupId of groupIds) requireGroup(access, groupId, true)
        await tx.update(people).set({ ...fields, updatedAt: new Date() }).where(eq(people.id, id))
        await tx.delete(personGroups).where(eq(personGroups.personId, id))
        await tx.insert(personGroups).values([...retainedGroups].map(groupId => ({ personId: id, groupId })))
      })
      return get(userId, id)
    },
    list: async (userId: string, input: ListInput) => {
      const access = await loadAccess(db, userId)
      const pattern = searchPattern(input.q)
      const rows = await db.select().from(people).where(and(
        or(eq(people.userId, userId), personVisibility(db, groupScope(access, input.groupId))),
        input.q ? or(sql`${people.displayName} like ${pattern} escape '!'`, sql`${people.email} like ${pattern} escape '!'`, sql`${people.organization} like ${pattern} escape '!'`, sql`${people.jobTitle} like ${pattern} escape '!'`, sql`${people.nickname} like ${pattern} escape '!'`) : undefined,
      )).orderBy(desc(eq(people.userId, userId)), asc(people.displayName), asc(people.id)).offset(input.offset).limit(input.limit + 1)
      return { items: await present(userId, access, rows.slice(0, input.limit)), nextOffset: rows.length > input.limit ? input.offset + input.limit : null }
    },
    create: async (userId: string, input: PersonInput) => {
      const access = await loadAccess(db, userId)
      const { groupIds, ...fields } = input
      for (const id of groupIds) requireGroup(access, id, true)
      const id = randomUUID()
      await db.transaction(async tx => {
        const current = await lockAccess(tx, userId)
        for (const groupId of groupIds) requireGroup(current, groupId, true)
        await tx.insert(people).values({ id, ...fields, creatorId: userId })
        await tx.insert(personGroups).values([...new Set(groupIds)].map(groupId => ({ personId: id, groupId })))
      })
      return get(userId, id)
    },
  }
}
