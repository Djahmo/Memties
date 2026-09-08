import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { connectDatabase } from './index.js'
import { entries, entryPeople, groupMembers, groups, identities, oauthRecords, people, personGroups, reminders, samlRequests, users } from './schema.js'
import { createAuthService } from '../auth/service.js'
import { createAdminService } from '../services/admin.js'
import { createGroupService } from '../services/groups.js'

test('MySQL: deletion removes shared contributions, preserves other users and refuses orphaned groups', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = process.env.TEST_DATABASE_URL!
  assert.ok(new URL(url).pathname.endsWith('_test'))
  const { db, pool } = connectDatabase(url)
  const accountIds: string[] = [], groupIds: string[] = []
  const personIds = [randomUUID(), randomUUID()], entryIds = [randomUUID(), randomUUID()]
  const codeId = `code:${randomUUID()}`, flowId = `flow:${randomUUID()}`
  t.after(async () => {
    try {
      await db.delete(oauthRecords).where(eq(oauthRecords.id, codeId))
      await db.delete(samlRequests).where(eq(samlRequests.id, flowId))
      await db.delete(reminders).where(inArray(reminders.entryId, entryIds))
      await db.delete(entries).where(inArray(entries.id, entryIds))
      await db.delete(people).where(inArray(people.id, personIds))
      if (groupIds.length) {
        await db.update(groups).set({ parentId: null }).where(inArray(groups.id, groupIds))
        await db.delete(groups).where(inArray(groups.id, groupIds))
      }
      if (accountIds.length) await db.delete(users).where(inArray(users.id, accountIds))
    } finally { await pool.end() }
  })
  await migrate(db, { migrationsFolder: './drizzle' })
  const adminEmail = `admin-${randomUUID()}@example.test`
  const auth = createAuthService(db, adminEmail), admin = createAdminService(db, adminEmail), groupService = createGroupService(db)
  const actor = await auth.register({ email: adminEmail, displayName: 'Admin', password: 'correct long password' })
  accountIds.push(actor.user.id)
  groupIds.push(...(await groupService.list(actor.user.id)).map(group => group.id))
  const target = await auth.register({ email: `target-${randomUUID()}@example.test`, displayName: 'Target', password: 'correct long password' })
  accountIds.push(target.user.id)
  const personal = (await groupService.list(target.user.id))[0]!
  groupIds.push(personal.id)
  const nested = await groupService.create(target.user.id, { name: 'Private child', description: '', parentId: personal.id })
  groupIds.push(nested.id)
  const shared = await groupService.create(target.user.id, { name: 'Shared', description: '', parentId: null })
  groupIds.push(shared.id)
  await db.insert(groupMembers).values({ groupId: shared.id, userId: actor.user.id, role: 'viewer' })
  await db.insert(people).values(personIds.map((id, index) => ({ id, displayName: 'Contact', notes: '', creatorId: index === 0 ? target.user.id : actor.user.id })))
  await db.insert(personGroups).values(personIds.map(personId => ({ personId, groupId: shared.id })))
  await db.insert(entries).values(entryIds.map((id, index) => ({ id, title: 'Entry', body: '', occurredAt: new Date(), groupId: shared.id, creatorId: index === 0 ? target.user.id : actor.user.id })))
  await db.insert(entryPeople).values({ entryId: entryIds[1]!, personId: personIds[0]! })
  await db.insert(reminders).values({ id: randomUUID(), title: 'Reminder', dueAt: new Date(), entryId: entryIds[0]!, creatorId: actor.user.id })
  await db.insert(oauthRecords).values({ id: codeId, value: JSON.stringify({ userId: target.user.id }), expiresAt: new Date(Date.now() + 60000) })
  await db.insert(samlRequests).values({ id: flowId, value: target.user.id, createdAt: new Date() })
  await assert.rejects(admin.remove(actor.user.id, actor.user.id, adminEmail), { statusCode: 403 })
  await assert.rejects(admin.remove(actor.user.id, target.user.id, target.user.email), { statusCode: 409 })
  await admin.setStatus(actor.user.id, target.user.id, 'suspended')
  await assert.rejects(admin.remove(actor.user.id, target.user.id, 'wrong@example.test'), { statusCode: 400 })
  await assert.rejects(admin.remove(actor.user.id, target.user.id, target.user.email), { statusCode: 409 })
  assert.equal((await db.select().from(people).where(eq(people.id, personIds[0]!))).length, 1)
  await db.update(groupMembers).set({ role: 'owner' }).where(eq(groupMembers.userId, actor.user.id))
  await admin.remove(actor.user.id, target.user.id, target.user.email)
  assert.equal((await db.select().from(users).where(eq(users.id, target.user.id))).length, 0)
  assert.equal((await db.select().from(identities).where(eq(identities.userId, target.user.id))).length, 0)
  assert.equal((await db.select().from(groups).where(inArray(groups.id, [personal.id, nested.id]))).length, 0)
  assert.equal((await db.select().from(groups).where(eq(groups.id, shared.id))).length, 1)
  assert.deepEqual((await db.select({ id: people.id }).from(people).where(inArray(people.id, personIds))).map(row => row.id), [personIds[1]])
  assert.deepEqual((await db.select({ id: entries.id }).from(entries).where(inArray(entries.id, entryIds))).map(row => row.id), [entryIds[1]])
  assert.equal((await db.select().from(entryPeople).where(eq(entryPeople.entryId, entryIds[1]!))).length, 0)
  assert.equal((await db.select().from(reminders).where(eq(reminders.entryId, entryIds[0]!))).length, 0)
  assert.equal((await db.select().from(oauthRecords).where(eq(oauthRecords.id, codeId))).length, 0)
  assert.equal((await db.select().from(samlRequests).where(eq(samlRequests.id, flowId))).length, 0)
})
