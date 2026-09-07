import ICAL from 'ical.js'
import { z } from 'zod'
import type { ServiceDatabase } from '../db/index.js'
import { loadAccess, lockAccess, requireGroup } from './access.js'
import { personInput, listInput } from './content-input.js'
import { createPeopleService } from './people.js'
import { ServiceError } from './errors.js'

export const contactImportInput = z.object({ text: z.string().min(1).max(2_000_000), groupId: z.uuid() }).strict()
export const contactCommitInput = contactImportInput.extend({ selected: z.array(z.number().int().min(0)).min(1).max(2000) })
const textValue = (value: unknown): string => typeof value === 'string' ? value : Array.isArray(value) ? value.map(textValue).join(' ') : ''
const normalize = (value: string) => value.trim().toLocaleLowerCase()
const duplicate = (a: { email: string; phone: string; displayName: string }, b: typeof a) =>
  !!a.email && normalize(a.email) === normalize(b.email) ||
  a.phone.replace(/\D/g, '').length >= 7 && a.phone.replace(/\D/g, '') === b.phone.replace(/\D/g, '') ||
  normalize(a.displayName) === normalize(b.displayName)

export const createContactImportService = (db: ServiceDatabase) => {
  const preview = async (userId: string, input: z.infer<typeof contactImportInput>) => {
    requireGroup(await loadAccess(db, userId), input.groupId, true)
    let parsed: unknown
    try { parsed = ICAL.parse(input.text.replace(/^\uFEFF/, '')) } catch { throw new ServiceError(400, 'Invalid vCard file.') }
    if (!Array.isArray(parsed)) throw new ServiceError(400, 'Invalid vCard file.')
    const cards: unknown[] = typeof parsed[0] === 'string' ? [parsed] : parsed
    if (!cards.length || cards.length > 2000) throw new ServiceError(400, 'Import up to 2000 contacts at a time.')
    const existing: { displayName: string; email: string; phone: string }[] = []
    let offset: number | null = 0
    while (offset !== null) {
      const page = await createPeopleService(db).list(userId, listInput.parse({ offset, limit: 100 }))
      existing.push(...page.items); offset = page.nextOffset
    }
    return cards.map((raw, index) => {
      if (!Array.isArray(raw) || raw[0] !== 'vcard') throw new ServiceError(400, 'Invalid vCard file.')
      const card = new ICAL.Component(raw)
      const version: unknown = card.getFirstPropertyValue('version')
      if (version !== '3.0' && version !== '4.0') throw new ServiceError(400, 'Only vCard 3.0 and 4.0 are supported.')
      const name: unknown = card.getFirstPropertyValue('n')
      const firstName = Array.isArray(name) ? textValue(name[1]) : ''
      const lastName = Array.isArray(name) ? textValue(name[0]) : ''
      const contact = {
        firstName, lastName, displayName: textValue(card.getFirstPropertyValue('fn')) || `${firstName} ${lastName}`.trim(),
        email: textValue(card.getFirstPropertyValue('email')).replace(/^mailto:/i, ''),
        phone: textValue(card.getFirstPropertyValue('tel')).replace(/^tel:/i, ''),
        organization: textValue(card.getFirstPropertyValue('org')),
        groupIds: [input.groupId],
      }
      const valid = personInput.safeParse(contact)
      const isDuplicate = existing.some(person => duplicate(contact, person))
      if (valid.success) existing.push(valid.data)
      return { index, contact, duplicate: isDuplicate, valid: valid.success }
    })
  }
  return {
    preview,
    commit: async (userId: string, input: z.infer<typeof contactCommitInput>) => db.transaction(async tx => {
      await lockAccess(tx, userId)
      const rows = await createContactImportService(tx).preview(userId, input)
      const selected = new Set(input.selected)
      if (rows.filter(row => selected.has(row.index)).length !== selected.size) throw new ServiceError(400, 'Invalid contact selection.')
      let imported = 0
      for (const row of rows.filter(row => selected.has(row.index))) {
        if (!row.valid || row.duplicate) continue
        await createPeopleService(tx).create(userId, personInput.parse(row.contact)); imported++
      }
      return { imported, skipped: selected.size - imported }
    }),
  }
}
