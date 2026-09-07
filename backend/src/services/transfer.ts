import { z } from 'zod'
import type { ServiceDatabase } from '../db/index.js'
import { createGroupService } from './groups.js'
import { createPeopleService } from './people.js'
import { createEntryService } from './entries.js'
import { createReminderService } from './reminders.js'
import { entryInput, historyInput, listInput, personInput, reminderInput, reminderListInput } from './content-input.js'
import { lockAccess } from './access.js'
import { ServiceError } from './errors.js'

const groupRecord = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(120), description: z.string().max(2000), parentId: z.uuid().nullable() }).strict()
const personRecord = personInput.extend({ id: z.uuid() })
const entryRecord = entryInput.omit({ reminder: true }).extend({ id: z.uuid(), occurredAt: z.iso.datetime({ offset: true }), source: z.enum(['web', 'mcp']) })
const reminderRecord = reminderInput.omit({ notifyByPush: true, notifyByEmail: true, language: true }).extend({ id: z.uuid(), dueAt: z.iso.datetime({ offset: true }), status: z.enum(['pending', 'completed']) })
const tagRecord = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(80), groupIds: z.array(z.uuid()).max(10000), personIds: z.array(z.uuid()).max(10000) }).strict()
export const transferInput = z.object({
  format: z.literal('memties'), version: z.literal(1), exportedAt: z.iso.datetime({ offset: true }),
  groups: z.array(groupRecord).max(10000), people: z.array(personRecord).max(10000),
  entries: z.array(entryRecord).max(10000), reminders: z.array(reminderRecord).max(10000), tags: z.array(tagRecord).max(10000),
}).strict()
export type MemtiesExport = z.infer<typeof transferInput>

const collect = async <T>(read: (offset: number) => Promise<{ items: T[]; nextOffset: number | null }>) => {
  const rows: T[] = []
  let offset: number | null = 0
  while (offset !== null) {
    const page = await read(offset)
    rows.push(...page.items)
    if (rows.length > 10000) throw new ServiceError(400, 'Export is limited to 10000 objects per type.')
    offset = page.nextOffset
  }
  return rows
}

const validateRelations = (data: MemtiesExport) => {
  const ids = (rows: { id: string }[]) => {
    const values = new Set(rows.map(row => row.id))
    if (values.size !== rows.length) throw new ServiceError(400, 'Duplicate identifiers in import.')
    return values
  }
  const groupIds = ids(data.groups), personIds = ids(data.people), entryIds = ids(data.entries)
  ids(data.reminders); ids(data.tags)
  const requireId = (set: Set<string>, id: string) => { if (!set.has(id)) throw new ServiceError(400, 'Invalid import relationships.') }
  const ordered: MemtiesExport['groups'] = []
  const children = new Map<string | null, MemtiesExport['groups']>()
  for (const group of data.groups) {
    if (group.parentId) requireId(groupIds, group.parentId)
    const siblings = children.get(group.parentId) ?? []
    siblings.push(group); children.set(group.parentId, siblings)
  }
  const pending = [...children.get(null) ?? []]
  for (let index = 0; index < pending.length; index++) {
    const group = pending[index]!
    ordered.push(group); pending.push(...children.get(group.id) ?? [])
  }
  if (ordered.length !== data.groups.length) throw new ServiceError(400, 'Cyclic group hierarchy in import.')
  for (const person of data.people) for (const id of person.groupIds) requireId(groupIds, id)
  for (const entry of data.entries) {
    requireId(groupIds, entry.groupId)
    for (const id of entry.personIds) requireId(personIds, id)
    entryInput.parse({ title: entry.title, body: entry.body, occurredAt: entry.occurredAt, groupId: entry.groupId, personIds: entry.personIds })
  }
  for (const reminder of data.reminders) {
    requireId(entryIds, reminder.entryId)
    reminderInput.parse({ title: reminder.title, dueAt: reminder.dueAt, entryId: reminder.entryId })
  }
  for (const tag of data.tags) {
    for (const id of tag.groupIds) requireId(groupIds, id)
    for (const id of tag.personIds) requireId(personIds, id)
  }
  return ordered
}

export const createTransferService = (db: ServiceDatabase) => {
  const snapshot = async (userId: string): Promise<MemtiesExport> => {
    const groups = await createGroupService(db).list(userId)
    const people = await collect(offset => createPeopleService(db).list(userId, listInput.parse({ offset, limit: 100 })))
    const entries = await collect(offset => createEntryService(db).list(userId, historyInput.parse({ offset, limit: 100 })))
    const reminders = await collect(offset => createReminderService(db).list(userId, reminderListInput.parse({ offset, limit: 100, status: 'all' })))
    return transferInput.parse({ format: 'memties', version: 1, exportedAt: new Date().toISOString(),
      groups: groups.map(({ id, name, description, parentId }) => ({ id, name, description, parentId })),
      people: people.map(({ id, displayName, firstName, lastName, nickname, email, phone, organization, jobTitle, notes, groupIds }) => ({ id, displayName, firstName, lastName, nickname, email, phone, organization, jobTitle, notes, groupIds })),
      entries: entries.map(({ id, title, body, occurredAt, groupId, people, source }) => ({ id, title, body, occurredAt: occurredAt.toISOString(), groupId, personIds: people.map(person => person.id), source })),
      reminders: reminders.map(({ id, title, dueAt, entryId, status }) => ({ id, title, dueAt: dueAt.toISOString(), entryId, status })), tags: [],
    })
  }
  const preview = async (userId: string, data: MemtiesExport) => {
    validateRelations(data)
    const groups = await createGroupService(db).list(userId)
    if (!groups.some(group => group.isPersonal)) throw new ServiceError(403, 'Personal vault unavailable.')
    return {
      counts: { groups: data.groups.length, people: data.people.length, entries: data.entries.length, reminders: data.reminders.length, tags: data.tags.length },
      groups: data.groups.map(group => group.name), people: data.people.map(person => person.displayName),
      entries: data.entries.map(entry => entry.title), reminders: data.reminders.map(reminder => reminder.title), tags: data.tags.map(tag => tag.name),
    }
  }
  return {
    export: async (userId: string) => db.transaction(async tx => {
      await lockAccess(tx, userId)
      const data = await createTransferService(tx).snapshot(userId)
      if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 19_000_000) throw new ServiceError(400, 'Export exceeds the import file size limit.')
      return data
    }),
    snapshot,
    preview,
    import: async (userId: string, data: MemtiesExport) => db.transaction(async tx => {
      await lockAccess(tx, userId)
      const ordered = validateRelations(data)
      if (data.tags.length) throw new ServiceError(400, 'Tag import is not available yet.')
      const groups = createGroupService(tx), people = createPeopleService(tx), entries = createEntryService(tx), reminders = createReminderService(tx)
      const personal = (await groups.list(userId)).find(group => group.isPersonal)
      if (!personal) throw new ServiceError(403, 'Personal vault unavailable.')
      const root = await groups.create(userId, { name: `Import ${new Date().toISOString()}`, description: '', parentId: personal.id })
      const mapping = { groups: new Map<string, string>(), people: new Map<string, string>(), entries: new Map<string, string>(), reminders: new Map<string, string>(), tags: new Map<string, string>() }
      const mapped = (map: Map<string, string>, id: string) => {
        const value = map.get(id)
        if (!value) throw new ServiceError(400, 'Invalid import relationships.')
        return value
      }
      for (const group of ordered) {
        const created = await groups.create(userId, { name: group.name, description: group.description, parentId: group.parentId ? mapped(mapping.groups, group.parentId) : root.id })
        mapping.groups.set(group.id, created.id)
      }
      for (const { id, ...person } of data.people) {
        const created = await people.create(userId, { ...person, groupIds: person.groupIds.map(id => mapped(mapping.groups, id)) })
        mapping.people.set(id, created.id)
      }
      for (const { id, source, ...entry } of data.entries) {
        const created = await entries.create(userId, entryInput.parse({ ...entry, groupId: mapped(mapping.groups, entry.groupId), personIds: entry.personIds.map(id => mapped(mapping.people, id)) }), source)
        mapping.entries.set(id, created.id)
      }
      for (const reminder of data.reminders) {
        const created = await reminders.create(userId, reminderInput.parse({ title: reminder.title, dueAt: reminder.dueAt, entryId: mapped(mapping.entries, reminder.entryId) }))
        if (reminder.status === 'completed') await reminders.update(userId, created.id, { status: 'completed' })
        mapping.reminders.set(reminder.id, created.id)
      }
      return { rootId: root.id, mapping: Object.fromEntries(Object.entries(mapping).map(([kind, values]) => [kind, Object.fromEntries(values)])) }
    }),
  }
}
