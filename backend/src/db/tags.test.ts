import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { connectDatabase } from './index.js'
import { entries, entryTags, groups, people, users } from './schema.js'
import { createAuthService } from '../auth/service.js'
import { createGroupService } from '../services/groups.js'
import { createSharingService } from '../services/sharing.js'
import { createEntryService } from '../services/entries.js'
import { createTagService, tagInput } from '../services/tags.js'
import { entryInput } from '../services/content-input.js'
import { createTransferService, transferInput } from '../services/transfer.js'

test('Tags validate names and allow only six-digit colors', () => {
  assert.deepEqual(tagInput.parse({ name: ' RH ', color: '#AABBCC' }), { name: 'RH', color: '#aabbcc' })
  for (const input of [{ name: ' ', color: '#aabbcc' }, { name: 'RH', color: 'red' }, { name: 'RH', color: '#fff' }, { name: 'RH', color: '#ffffff', userId: randomUUID() }]) {
    assert.equal(tagInput.safeParse(input).success, false)
  }
})

test('MySQL: personal tags, foreign ownership, reassignment and JSON round trip', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  assert.ok(new URL(process.env.TEST_DATABASE_URL!).pathname.endsWith('_test'))
  const { db, pool } = connectDatabase(process.env.TEST_DATABASE_URL!)
  const userIds: string[] = []
  t.after(async () => {
    try {
      if (userIds.length) {
        await db.delete(entries).where(inArray(entries.creatorId, userIds))
        await db.delete(people).where(inArray(people.creatorId, userIds))
        for (const userId of userIds) {
          const remaining = (await createGroupService(db).list(userId)).filter(group => !group.isPersonal)
          while (remaining.length) {
            const index = remaining.findIndex(group => !remaining.some(child => child.parentId === group.id))
            assert.notEqual(index, -1)
            await db.delete(groups).where(eq(groups.id, remaining[index]!.id))
            remaining.splice(index, 1)
          }
        }
        await db.delete(groups).where(inArray(groups.personalOwnerId, userIds))
        await db.delete(users).where(inArray(users.id, userIds))
      }
    } finally { await pool.end() }
  })
  await migrate(db, { migrationsFolder: './drizzle' })
  const auth = createAuthService(db)
  const owner = await auth.register({ email: `tags-owner-${randomUUID()}@example.test`, displayName: 'Owner', password: 'correct long password' })
  userIds.push(owner.user.id)
  const reader = await auth.register({ email: `tags-reader-${randomUUID()}@example.test`, displayName: 'Reader', password: 'correct long password' })
  userIds.push(reader.user.id)
  const group = await createGroupService(db).create(owner.user.id, { name: 'Shared tags test', description: '', parentId: null })
  await createSharingService(db).set(owner.user.id, group.id, { email: reader.user.email, role: 'viewer' })
  const tags = createTagService(db)
  const service = createEntryService(db)
  const hr = await tags.create(owner.user.id, tagInput.parse({ name: 'RH', color: '#3366ff' }))
  const finance = await tags.create(reader.user.id, tagInput.parse({ name: 'Finance', color: '#228844' }))
  const entry = await service.create(owner.user.id, entryInput.parse({ title: 'Tagged entry', groupId: group.id, occurredAt: new Date().toISOString(), tagId: hr.id }))
  assert.deepEqual(entry.tag, hr)
  assert.equal((await service.get(reader.user.id, entry.id)).tag, null)
  assert.deepEqual(await tags.list(reader.user.id), [finance])
  await assert.rejects(tags.update(reader.user.id, hr.id, { name: 'Other', color: '#000000' }), { statusCode: 404 })
  await assert.rejects(service.setTag(reader.user.id, entry.id, hr.id), { statusCode: 404 })
  assert.deepEqual((await service.setTag(reader.user.id, entry.id, finance.id)).tag, finance)
  assert.deepEqual((await service.get(owner.user.id, entry.id)).tag, hr)
  await tags.update(owner.user.id, hr.id, { name: 'Human resources', color: '#ff8800' })
  assert.equal((await service.get(owner.user.id, entry.id)).tag?.color, '#ff8800')
  await service.update(owner.user.id, entry.id, entryInput.parse({ title: 'Updated', groupId: group.id, occurredAt: new Date().toISOString() }))
  assert.equal((await service.get(owner.user.id, entry.id)).tag?.id, hr.id)
  const transfer = createTransferService(db)
  const exported = transferInput.parse(await transfer.export(owner.user.id))
  assert.equal(exported.tags.length, 1)
  assert.equal(exported.entries[0]?.tagId, hr.id)
  const imported = await transfer.import(owner.user.id, exported)
  assert.equal((await service.get(owner.user.id, imported.mapping.entries![entry.id]!)).tag?.color, '#ff8800')
  assert.notEqual(imported.mapping.tags![hr.id], hr.id)
  assert.equal((await service.setTag(reader.user.id, entry.id, null)).tag, null)
  assert.equal((await service.get(owner.user.id, entry.id)).tag?.id, hr.id)
  const privateEntry = await service.create(owner.user.id, entryInput.parse({ title: 'Private', groupId: (await createGroupService(db).list(owner.user.id)).find(group => group.isPersonal)!.id, occurredAt: new Date().toISOString() }))
  await assert.rejects(service.setTag(reader.user.id, privateEntry.id, finance.id), { statusCode: 404 })
  await service.setArchived(owner.user.id, entry.id, true)
  await assert.rejects(service.remove(reader.user.id, entry.id), { statusCode: 403 })
  await service.remove(owner.user.id, entry.id)
  await assert.rejects(service.get(owner.user.id, entry.id), { statusCode: 404 })
  assert.equal((await db.select().from(entryTags).where(eq(entryTags.entryId, entry.id))).length, 0)
  assert.ok((await tags.list(owner.user.id)).some(tag => tag.id === hr.id))
})
