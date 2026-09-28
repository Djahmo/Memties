import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { connectDatabase } from './index.js'
import { groupMembers, groups, people, personGroups, users } from './schema.js'
import { createPeopleService } from '../services/people.js'
import { listInput } from '../services/content-input.js'

test('MySQL: parent-link migration preserves leaf memberships and recursive visibility', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  assert.ok(new URL(process.env.TEST_DATABASE_URL!).pathname.endsWith('_test'))
  const { db, pool } = connectDatabase(process.env.TEST_DATABASE_URL!)
  const owner = randomUUID()
  const ids = Object.fromEntries(['root', 'middle', 'leaf', 'sibling', 'other', 'personal', 'privateChild'].map(name => [name, randomUUID()]))
  const contacts = Object.fromEntries(['deep', 'rootOnly', 'branches', 'gap', 'self'].map(name => [name, randomUUID()]))
  t.after(async () => {
    try {
      await db.delete(people).where(eq(people.creatorId, owner))
      for (const name of ['leaf', 'middle', 'sibling', 'privateChild', 'root', 'other', 'personal']) await db.delete(groups).where(eq(groups.id, ids[name]))
      await db.delete(users).where(eq(users.id, owner))
    } finally { await pool.end() }
  })
  await migrate(db, { migrationsFolder: './drizzle' })
  await db.insert(users).values({ id: owner, email: `${owner}@example.test`, displayName: 'Migration test' })
  for (const [name, parent] of [['root', null], ['middle', 'root'], ['leaf', 'middle'], ['sibling', 'root'], ['other', null], ['personal', null], ['privateChild', 'personal']] as const) {
    await db.insert(groups).values({ id: ids[name], name, parentId: parent ? ids[parent] : null, personalOwnerId: name === 'personal' ? owner : null })
  }
  await db.insert(groupMembers).values(['root', 'other', 'personal'].map(name => ({ groupId: ids[name], userId: owner, role: 'owner' as const })))
  await db.insert(people).values(Object.entries(contacts).map(([name, id]) => ({ id, displayName: name, creatorId: owner, userId: name === 'self' ? owner : null, notes: '' })))
  await db.insert(personGroups).values(Object.entries({
    deep: ['root', 'middle', 'leaf'], rootOnly: ['root'],
    branches: ['root', 'leaf', 'sibling', 'other'], gap: ['root', 'leaf', 'personal', 'privateChild'],
    self: ['personal', 'privateChild'],
  }).flatMap(([name, memberships]) => memberships.map(group => ({ personId: contacts[name], groupId: ids[group] }))))

  // Limit execution to these fixtures so parallel tests keep their own data.
  const migration = /*sql*/`${readFileSync('./drizzle/0012_remove_parent_contact_links.sql', 'utf8').trim().replace(/;$/, '')}
    AND person.creator_id = ?`
  await pool.query(migration, [owner])
  const links = await db.select().from(personGroups).where(inArray(personGroups.personId, Object.values(contacts)))
  assert.deepEqual(links.filter(link => link.personId === contacts.deep).map(link => link.groupId), [ids.leaf])
  assert.deepEqual(links.filter(link => link.personId === contacts.rootOnly).map(link => link.groupId), [ids.root])
  assert.deepEqual(new Set(links.filter(link => link.personId === contacts.branches).map(link => link.groupId)), new Set([ids.leaf, ids.sibling, ids.other]))
  assert.deepEqual(new Set(links.filter(link => link.personId === contacts.gap).map(link => link.groupId)), new Set([ids.leaf, ids.privateChild]))
  assert.deepEqual(new Set(links.filter(link => link.personId === contacts.self).map(link => link.groupId)), new Set([ids.personal, ids.privateChild]))
  await pool.query(migration, [owner])
  assert.deepEqual(await db.select().from(personGroups).where(inArray(personGroups.personId, Object.values(contacts))), links)

  const service = createPeopleService(db)
  assert.ok((await service.list(owner, listInput.parse({ groupId: ids.root }))).items.some(person => person.id === contacts.deep))
  assert.deepEqual((await service.list(owner, { ...listInput.parse({ groupId: ids.root }), directOnly: true })).items.map(person => person.id), [contacts.rootOnly])
})
