import { randomUUID } from 'node:crypto'
import { and, asc, eq, exists, inArray, or, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { people, personGroups } from '../db/schema.js'
import { groupScope, loadAccess, requireGroup } from './access.js'
import type { Access } from './access.js'
import { ServiceError } from './errors.js'
import type { ListInput, PersonInput } from './content-input.js'
import { searchPattern } from './content-input.js'

export const personVisibility = (db: Database, groupIds: string[]) => groupIds.length
  ? exists(db.select({ id: personGroups.personId }).from(personGroups).where(and(eq(personGroups.personId, people.id), inArray(personGroups.groupId, groupIds))))
  : sql`false`

export const visiblePersonIds = (db: Database, access: Access) => db.select({ id: people.id }).from(people).where(personVisibility(db, [...access.permissions.keys()]))

export const requirePerson = async (db: Database, access: Access, id: string) => {
  const [person] = await db.select().from(people).where(and(eq(people.id, id), personVisibility(db, [...access.permissions.keys()]))).limit(1)
  if (!person) throw new ServiceError(404, 'Person not found.')
  return person
}

export const createPeopleService = (db: Database) => {
  const present = async (access: Access, rows: typeof people.$inferSelect[]) => {
    if (!rows.length) return []
    const links = await db.select().from(personGroups).where(inArray(personGroups.personId, rows.map(person => person.id)))
    return rows.map(person => {
      const groupIds = links.filter(link => link.personId === person.id).map(link => link.groupId)
      return {
        id: person.id, displayName: person.displayName, firstName: person.firstName, lastName: person.lastName,
        nickname: person.nickname, email: person.email, phone: person.phone, organization: person.organization,
        jobTitle: person.jobTitle, notes: person.notes, createdAt: person.createdAt, updatedAt: person.updatedAt,
        groupIds: groupIds.filter(id => access.permissions.has(id)),
        canEdit: groupIds.length > 0 && groupIds.every(id => access.permissions.has(id) && access.permissions.get(id)?.role !== 'viewer'),
      }
    })
  }
  const get = async (userId: string, id: string) => {
    const access = await loadAccess(db, userId)
    return (await present(access, [await requirePerson(db, access, id)]))[0]
  }
  return {
    get,
    update: async (userId: string, id: string, input: PersonInput) => {
      await requirePerson(db, await loadAccess(db, userId), id)
      await db.transaction(async tx => {
        await tx.select({ id: people.id }).from(people).where(eq(people.id, id)).for('update')
        const access = await loadAccess(tx, userId)
        const links = await tx.select().from(personGroups).where(eq(personGroups.personId, id))
        if (!links.length || links.some(link => !access.permissions.has(link.groupId) || access.permissions.get(link.groupId)?.role === 'viewer')) {
          throw new ServiceError(403, 'You cannot edit this contact.')
        }
        const { groupIds, ...fields } = input
        for (const groupId of groupIds) requireGroup(access, groupId, true)
        await tx.update(people).set({ ...fields, updatedAt: new Date() }).where(eq(people.id, id))
        await tx.delete(personGroups).where(eq(personGroups.personId, id))
        await tx.insert(personGroups).values([...new Set(groupIds)].map(groupId => ({ personId: id, groupId })))
      })
      return get(userId, id)
    },
    list: async (userId: string, input: ListInput) => {
      const access = await loadAccess(db, userId)
      const pattern = searchPattern(input.q)
      const rows = await db.select().from(people).where(and(
        personVisibility(db, groupScope(access, input.groupId)),
        input.q ? or(sql`${people.displayName} like ${pattern} escape '!'`, sql`${people.email} like ${pattern} escape '!'`, sql`${people.organization} like ${pattern} escape '!'`, sql`${people.jobTitle} like ${pattern} escape '!'`, sql`${people.nickname} like ${pattern} escape '!'`) : undefined,
      )).orderBy(asc(people.displayName), asc(people.id)).offset(input.offset).limit(input.limit + 1)
      return { items: await present(access, rows.slice(0, input.limit)), nextOffset: rows.length > input.limit ? input.offset + input.limit : null }
    },
    create: async (userId: string, input: PersonInput) => {
      const access = await loadAccess(db, userId)
      const { groupIds, ...fields } = input
      for (const id of groupIds) requireGroup(access, id, true)
      const id = randomUUID()
      await db.transaction(async tx => {
        await tx.insert(people).values({ id, ...fields, creatorId: userId })
        await tx.insert(personGroups).values([...new Set(groupIds)].map(groupId => ({ personId: id, groupId })))
      })
      return get(userId, id)
    },
  }
}
