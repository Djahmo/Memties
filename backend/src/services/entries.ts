import { randomUUID } from 'node:crypto'
import { and, desc, eq, exists, gte, inArray, lte, or, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { entries, entryPeople, people, reminders, users } from '../db/schema.js'
import { groupScope, loadAccess, lockAccess, requireGroup } from './access.js'
import type { Access } from './access.js'
import { requirePerson, visiblePersonIds } from './people.js'
import { ServiceError } from './errors.js'
import type { EntryInput, HistoryInput } from './content-input.js'
import { searchPattern } from './content-input.js'

export const createEntryService = (db: Database) => {
  const present = async (access: Access, rows: typeof entries.$inferSelect[]) => {
    if (!rows.length) return []
    const [participants, creators] = await Promise.all([
      db.select({ entryId: entryPeople.entryId, id: people.id, displayName: people.displayName }).from(entryPeople)
        .innerJoin(people, eq(people.id, entryPeople.personId))
        .where(and(inArray(entryPeople.entryId, rows.map(entry => entry.id)), inArray(people.id, visiblePersonIds(db, access)))),
      db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, [...new Set(rows.map(entry => entry.creatorId))])),
    ])
    return rows.map(entry => ({ ...entry,
      creatorName: creators.find(user => user.id === entry.creatorId)?.displayName ?? '',
      people: participants.filter(person => person.entryId === entry.id).map(person => ({ id: person.id, displayName: person.displayName })),
      canEdit: access.permissions.get(entry.groupId)?.role !== 'viewer',
    }))
  }
  const requireEntry = async (access: Access, id: string, store: Pick<Database, 'select'> = db) => {
    const ids = [...access.permissions.keys()]
    if (!ids.length) throw new ServiceError(404, 'Entry not found.')
    const [entry] = await store.select().from(entries).where(and(eq(entries.id, id), inArray(entries.groupId, ids))).limit(1)
    if (!entry) throw new ServiceError(404, 'Entry not found.')
    return entry
  }
  const validatePeople = async (access: Access, ids: string[], store: Pick<Database, 'select'> = db) => {
    if (!ids.length) return
    const visible = await store.select({ id: people.id }).from(people).where(and(inArray(people.id, ids), inArray(people.id, visiblePersonIds(store, access))))
    if (visible.length !== new Set(ids).size) throw new ServiceError(404, 'One or more people are unavailable.')
  }
  const get = async (userId: string, id: string) => {
    const access = await loadAccess(db, userId)
    return (await present(access, [await requireEntry(access, id)]))[0]
  }
  return {
    get,
    list: async (userId: string, input: HistoryInput) => {
      const access = await loadAccess(db, userId)
      const scope = groupScope(access, input.groupId)
      for (const id of [input.personId, input.participantId]) if (id) await requirePerson(db, access, id)
      if (!scope.length) return { items: [], nextOffset: null }
      const pattern = searchPattern(input.q)
      const participantFilter = (personId: string | undefined) => personId
        ? exists(db.select({ id: entryPeople.entryId }).from(entryPeople).where(and(eq(entryPeople.entryId, entries.id), eq(entryPeople.personId, personId)))) : undefined
      const rows = await db.select().from(entries).where(and(
        inArray(entries.groupId, scope), participantFilter(input.personId), participantFilter(input.participantId),
        input.from ? gte(entries.occurredAt, input.from) : undefined,
        input.to ? lte(entries.occurredAt, input.to) : undefined,
        input.q ? or(sql`${entries.title} like ${pattern} escape '!'`, sql`${entries.body} like ${pattern} escape '!'`) : undefined,
      )).orderBy(desc(entries.occurredAt), desc(entries.id)).offset(input.offset).limit(input.limit + 1)
      return { items: await present(access, rows.slice(0, input.limit)), nextOffset: rows.length > input.limit ? input.offset + input.limit : null }
    },
    create: async (userId: string, input: EntryInput, source: 'web' | 'mcp' = 'web') => {
      const access = await loadAccess(db, userId)
      requireGroup(access, input.groupId, true)
      await validatePeople(access, input.personIds)
      const { personIds, reminder, ...fields } = input
      const id = randomUUID()
      await db.transaction(async tx => {
        const current = await lockAccess(tx, userId)
        requireGroup(current, input.groupId, true)
        await validatePeople(current, personIds, tx)
        await tx.insert(entries).values({ id, ...fields, creatorId: userId, source })
        if (personIds.length) await tx.insert(entryPeople).values([...new Set(personIds)].map(personId => ({ entryId: id, personId })))
        if (reminder) await tx.insert(reminders).values({ id: randomUUID(), entryId: id, creatorId: userId, ...reminder, notifyByEmail: reminder.notifyByEmail ? 'yes' : 'no' })
      })
      return get(userId, id)
    },
    update: async (userId: string, id: string, input: EntryInput) => {
      if (input.reminder) throw new ServiceError(400, 'Add reminders from the entry history.')
      const access = await loadAccess(db, userId)
      const previous = await requireEntry(access, id)
      requireGroup(access, previous.groupId, true)
      requireGroup(access, input.groupId, true)
      await validatePeople(access, input.personIds)
      const { personIds, reminder: _reminder, ...fields } = input
      await db.transaction(async tx => {
        const current = await lockAccess(tx, userId)
        const locked = await requireEntry(current, id, tx)
        requireGroup(current, locked.groupId, true)
        requireGroup(current, input.groupId, true)
        await validatePeople(current, personIds, tx)
        const [result] = await tx.update(entries).set({ ...fields, updatedAt: new Date() }).where(and(eq(entries.id, id), eq(entries.groupId, previous.groupId)))
        if (!result.affectedRows) throw new ServiceError(409, 'This entry was moved. Reload it before editing.')
        // Editing a visible entry must not remove or reveal participants inaccessible to this reader.
        await tx.delete(entryPeople).where(and(eq(entryPeople.entryId, id), inArray(entryPeople.personId, visiblePersonIds(tx, current))))
        if (personIds.length) await tx.insert(entryPeople).values([...new Set(personIds)].map(personId => ({ entryId: id, personId })))
      })
      return get(userId, id)
    },
  }
}
