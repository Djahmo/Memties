import { randomUUID } from 'node:crypto'
import { and, asc, eq, exists, inArray } from 'drizzle-orm'
import type { z } from 'zod'
import type { Database } from '../db/index.js'
import { entries, entryPeople, groups, reminders } from '../db/schema.js'
import { groupScope, loadAccess, requireGroup } from './access.js'
import { requirePerson } from './people.js'
import { ServiceError } from './errors.js'
import type { reminderFields, reminderInput, reminderListInput } from './content-input.js'

export const createReminderService = (db: Database) => ({
  list: async (userId: string, input: z.infer<typeof reminderListInput>) => {
    const access = await loadAccess(db, userId)
    const scope = groupScope(access, input.groupId)
    if (input.personId) await requirePerson(db, access, input.personId)
    if (input.entryId) {
      const [entry] = await db.select().from(entries).where(eq(entries.id, input.entryId)).limit(1)
      if (!entry || !access.permissions.has(entry.groupId)) throw new ServiceError(404, 'Entry not found.')
    }
    if (!scope.length) return { items: [], nextOffset: null }
    const rows = await db.select({ reminder: reminders, groupId: entries.groupId, entryTitle: entries.title }).from(reminders)
      .innerJoin(entries, eq(entries.id, reminders.entryId)).where(and(
        inArray(entries.groupId, scope),
        input.entryId ? eq(reminders.entryId, input.entryId) : undefined,
        input.status !== 'all' ? eq(reminders.status, input.status) : undefined,
        input.personId ? exists(db.select({ id: entryPeople.entryId }).from(entryPeople).where(and(eq(entryPeople.entryId, entries.id), eq(entryPeople.personId, input.personId)))) : undefined,
      )).orderBy(asc(reminders.dueAt), asc(reminders.id)).offset(input.offset).limit(input.limit + 1)
    return {
      items: rows.slice(0, input.limit).map(({ reminder, ...entry }) => ({
        id: reminder.id, title: reminder.title, entryId: reminder.entryId, dueAt: reminder.dueAt,
        status: reminder.status, creatorId: reminder.creatorId, createdAt: reminder.createdAt, updatedAt: reminder.updatedAt,
        notifyByEmail: reminder.creatorId === userId && reminder.notifyByEmail === 'yes',
        canEdit: access.permissions.get(entry.groupId)?.role !== 'viewer', canNotify: reminder.creatorId === userId, ...entry,
      })),
      nextOffset: rows.length > input.limit ? input.offset + input.limit : null,
    }
  },
  create: async (userId: string, input: z.infer<typeof reminderInput>) => {
    const id = randomUUID()
    await db.transaction(async tx => {
      await tx.select({ id: groups.id }).from(groups).orderBy(groups.id).for('update')
      const access = await loadAccess(tx, userId)
      const [entry] = await tx.select().from(entries).where(eq(entries.id, input.entryId)).for('update')
      if (!entry || !access.permissions.has(entry.groupId)) throw new ServiceError(404, 'Entry not found.')
      requireGroup(access, entry.groupId, true)
      await tx.insert(reminders).values({ ...input, id, creatorId: userId, notifyByEmail: input.notifyByEmail ? 'yes' : 'no' })
    })
    return { id }
  },
  update: async (userId: string, id: string, input: Partial<z.infer<typeof reminderFields>> & { status?: 'pending' | 'completed' }) => {
    await db.transaction(async tx => {
      await tx.select({ id: groups.id }).from(groups).orderBy(groups.id).for('update')
      const access = await loadAccess(tx, userId)
      const [row] = await tx.select({ reminder: reminders, groupId: entries.groupId }).from(reminders)
        .innerJoin(entries, eq(entries.id, reminders.entryId)).where(eq(reminders.id, id)).for('update')
      if (!row || !access.permissions.has(row.groupId)) throw new ServiceError(404, 'Reminder not found.')
      requireGroup(access, row.groupId, true)
      if ((input.notifyByEmail !== undefined || input.language !== undefined) && row.reminder.creatorId !== userId) {
        throw new ServiceError(403, 'Only the creator can change email notifications.')
      }
      const { notifyByEmail, ...fields } = input
      await tx.update(reminders).set({ ...fields, updatedAt: new Date(),
        ...(notifyByEmail !== undefined ? { notifyByEmail: notifyByEmail ? 'yes' as const : 'no' as const } : {}),
        ...(input.dueAt || input.status === 'pending' || notifyByEmail === true ? { notifiedAt: null, notificationAttemptAt: null } : {}),
      }).where(eq(reminders.id, id))
    })
    return { success: true }
  },
})
