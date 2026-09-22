import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { connectDatabase } from './index.js'
import { entries, groups, people, users } from './schema.js'
import { createAuthService } from '../auth/service.js'
import { createPeopleService } from '../services/people.js'
import { createGroupService } from '../services/groups.js'
import { createEntryService } from '../services/entries.js'
import { entryInput, listInput, personInput } from '../services/content-input.js'

test('MySQL: accounts have a private self contact, always listed and linked to their entries', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  assert.ok(new URL(process.env.TEST_DATABASE_URL!).pathname.endsWith('_test'))
  const { db, pool } = connectDatabase(process.env.TEST_DATABASE_URL!)
  const userIds: string[] = []
  const groupIds: string[] = []
  t.after(async () => {
    try {
      if (userIds.length) {
        await db.delete(entries).where(inArray(entries.creatorId, userIds))
        await db.delete(people).where(inArray(people.creatorId, userIds))
        if (groupIds.length) await db.delete(groups).where(inArray(groups.id, groupIds))
        await db.delete(groups).where(inArray(groups.personalOwnerId, userIds))
        await db.delete(users).where(inArray(users.id, userIds))
      }
    } finally { await pool.end() }
  })
  await migrate(db, { migrationsFolder: './drizzle' })
  const auth = createAuthService(db)
  const contacts = createPeopleService(db)
  const memories = createEntryService(db)
  const alice = await auth.register({ email: `self-${randomUUID()}@example.test`, displayName: 'Alice', password: 'correct long password' })
  userIds.push(alice.user.id)
  const bob = await auth.externalLogin('ldap', randomUUID(), { email: `self-${randomUUID()}@example.test`, displayName: 'Bob' })
  userIds.push(bob.user.id)
  const self = await contacts.self(alice.user.id)
  const group = await createGroupService(db).create(alice.user.id, { name: 'Work', description: '', parentId: null })
  groupIds.push(group.id)
  assert.equal(self.isSelf, true)
  assert.equal(self.email, alice.user.email)
  assert.equal((await contacts.self(bob.user.id)).isSelf, true)
  assert.equal((await contacts.list(alice.user.id, listInput.parse({ groupId: group.id }))).items[0]?.id, self.id)
  await assert.rejects(contacts.get(bob.user.id, self.id), { statusCode: 404 })
  await auth.login(alice.user.email, 'correct long password')
  assert.equal((await db.select().from(people).where(eq(people.userId, alice.user.id))).length, 1)
  const entry = await memories.create(alice.user.id, entryInput.parse({ title: 'Note', groupId: group.id, occurredAt: new Date().toISOString() }))
  assert.deepEqual(entry.people.map(person => person.id), [self.id])
  assert.deepEqual((await memories.update(alice.user.id, entry.id, entryInput.parse({ title: 'Updated', groupId: group.id, occurredAt: new Date().toISOString(), personIds: [] }))).people.map(person => person.id), [self.id])
  assert.ok((await contacts.update(alice.user.id, self.id, personInput.parse({ displayName: 'Alice', groupIds: [group.id] }))).groupIds.includes(self.groupIds[0]!))
})
