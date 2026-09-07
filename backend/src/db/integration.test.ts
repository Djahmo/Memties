import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { and, eq, inArray } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { createApp } from '../app.js'
import { createAuthService } from '../auth/service.js'
import { createGroupService } from '../services/groups.js'
import { connectDatabase } from './index.js'
import { entries, groupMembers, groups, people, sessions, users } from './schema.js'
import { createPeopleService } from '../services/people.js'
import { createEntryService } from '../services/entries.js'
import { createSharingService } from '../services/sharing.js'
import { entryInput, historyInput, listInput, personInput } from '../services/content-input.js'
import { reminderInput, reminderListInput } from '../services/content-input.js'
import { createReminderService } from '../services/reminders.js'
import { createTokenService } from '../auth/tokens.js'
import { apiTokens, reminders } from './schema.js'

test('MySQL: reminder permissions, MCP tokens, group moves and external identity linking', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = process.env.TEST_DATABASE_URL!
  assert.ok(new URL(url).pathname.endsWith('_test'))
  const { db, pool } = connectDatabase(url)
  await migrate(db, { migrationsFolder: './drizzle' })
  const auth = createAuthService(db)
  const groupService = createGroupService(db)
  const contacts = createPeopleService(db)
  const memories = createEntryService(db)
  const followups = createReminderService(db)
  const tokens = createTokenService(db)
  const sharing = createSharingService(db)
  const suffix = randomUUID()
  const alice = await auth.register({ email: `v1-alice-${suffix}@example.test`, displayName: 'Alice', password: 'correct long password' })
  const bob = await auth.register({ email: `v1-bob-${suffix}@example.test`, displayName: 'Bob', password: 'correct long password' })
  const vault = (await groupService.list(alice.user.id))[0]
  const bobVault = (await groupService.list(bob.user.id))[0]
  const project = await groupService.create(alice.user.id, { name: 'Project', description: '', parentId: null })
  const child = await groupService.create(alice.user.id, { name: 'Child', description: '', parentId: project.id })
  const nested = await groupService.create(alice.user.id, { name: 'Nested', description: '', parentId: child.id })
  const target = await groupService.create(alice.user.id, { name: 'Target', description: '', parentId: null })
  t.after(async () => {
    try {
    const owners = [alice.user.id, bob.user.id]
    await db.delete(reminders).where(inArray(reminders.creatorId, owners))
    await db.delete(entries).where(inArray(entries.creatorId, owners))
    await db.delete(people).where(inArray(people.creatorId, owners))
    for (const id of [nested.id, child.id, target.id, project.id, vault.id, bobVault.id]) await db.delete(groups).where(eq(groups.id, id))
    await db.delete(users).where(inArray(users.id, owners))
    } finally { await pool.end() }
  })
  const person = await contacts.create(alice.user.id, personInput.parse({ displayName: 'Shared contact', groupIds: [child.id] }))
  const input = entryInput.parse({ title: 'Shared memory', occurredAt: '2026-09-01T10:00:00Z', groupId: child.id, personIds: [person.id],
    reminder: { title: 'Shared follow-up', dueAt: '2026-09-14T10:00:00Z', notifyByEmail: true, language: 'fr' },
  })
  const shared = await memories.create(alice.user.id, input)
  const secret = await memories.create(alice.user.id, { ...input, groupId: vault.id, title: 'Secret memory', reminder: { ...input.reminder!, title: 'Secret follow-up' } })
  await sharing.set(alice.user.id, project.id, { email: bob.user.email, role: 'viewer' })
  const list = await followups.list(bob.user.id, reminderListInput.parse({ personId: person.id }))
  assert.equal(list.items.length, 1)
  assert.equal(list.items[0].title, 'Shared follow-up')
  assert.equal(list.items[0].notifyByEmail, false)
  assert.equal(JSON.stringify(list).includes('Secret'), false)
  const reminder = list.items[0]
  await assert.rejects(followups.list(bob.user.id, reminderListInput.parse({ entryId: secret.id })), { statusCode: 404 })
  await assert.rejects(followups.update(bob.user.id, reminder.id, { status: 'completed' }), { statusCode: 403 })
  await assert.rejects(followups.create(bob.user.id, reminderInput.parse({ entryId: shared.id, title: 'No write', dueAt: '2026-09-14T10:00:00Z' })), { statusCode: 403 })
  const origin = 'http://localhost:5173'
  const app = await createApp({ NODE_ENV: 'test', HOST: '127.0.0.1', PORT: 3001, APP_ORIGIN: origin, DATABASE_URL: url, ALLOW_REGISTRATION: true }, {
    auth, groups: groupService, content: { people: contacts, entries: memories }, reminders: followups, tokens, sharing,
  })
  t.after(() => app.close())
  const read = await tokens.create(alice.user.id, { name: 'Read only', access: 'read', days: 1 })
  const write = await tokens.create(alice.user.id, { name: 'Writer', access: 'write', days: 1 })
  const bobToken = await tokens.create(bob.user.id, { name: 'Bob', access: 'write', days: 1 })
  assert.equal(JSON.stringify(await tokens.list(alice.user.id)).includes(read.token), false)
  assert.equal((await db.select().from(apiTokens).where(eq(apiTokens.id, read.id)))[0].tokenHash.includes(read.token), false)
  const headers = { accept: 'application/json, text/event-stream' }
  assert.equal((await app.inject({ method: 'POST', url: '/api/mcp', headers, payload: {} })).statusCode, 401)
  assert.equal((await app.inject({ method: 'POST', url: '/api/mcp', headers: { ...headers, authorization: `Bearer ${read.token}`, origin: 'https://evil.test' }, payload: {} })).statusCode, 403)
  assert.equal((await app.inject({ method: 'POST', url: '/api/mcp', headers, cookies: { memties_session: alice.token }, payload: {} })).statusCode, 401)
  const invoke = async (token: string, method: string, params: Record<string, unknown>) => {
    const response = await app.inject({ method: 'POST', url: '/api/mcp', headers: { ...headers, authorization: `Bearer ${token}` }, payload: { jsonrpc: '2.0', id: randomUUID(), method, params } })
    assert.equal(response.statusCode, 200, response.body)
    return response.json<{ result: { isError?: boolean; content: { text: string }[]; tools?: { name: string }[] }; error?: unknown }>()
  }
  const tool = async (token: string, name: string, args: Record<string, unknown>) => (await invoke(token, 'tools/call', { name, arguments: args })).result
  const initialize = await invoke(read.token, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
  assert.ok(initialize.result)
  const catalog = await invoke(read.token, 'tools/list', {})
  assert.equal(catalog.result.tools?.length, 10)
  assert.equal((await tool(read.token, 'create_entry', { title: 'Blocked', occurredAt: '2026-09-02T10:00:00Z', groupId: vault.id })).isError, true)
  assert.equal((await tool(bobToken.token, 'create_entry', { title: 'Blocked viewer', occurredAt: '2026-09-02T10:00:00Z', groupId: child.id })).isError, true)
  assert.equal((await tool(bobToken.token, 'get_entry', { id: secret.id })).isError, true)
  assert.equal(JSON.stringify(await tool(bobToken.token, 'search_entries', { personId: person.id })).includes('Secret'), false)
  assert.equal(JSON.stringify(await tool(bobToken.token, 'list_reminders', {})).includes('Secret'), false)
  const created = await tool(write.token, 'create_entry', { title: 'MCP memory', occurredAt: '2026-09-02T10:00:00Z', groupId: child.id, personIds: [person.id], reminder: { title: 'MCP follow-up', dueAt: '2026-09-15T10:00:00Z' } })
  assert.equal(created.isError, undefined)
  assert.ok(created.content[0].text.includes('"source":"mcp"'))
  const secondPage = await followups.list(alice.user.id, reminderListInput.parse({ entryId: shared.id, limit: 1 }))
  assert.equal(secondPage.items.length, 1)
  await sharing.set(alice.user.id, project.id, { email: bob.user.email, role: 'editor' })
  const changed = await app.inject({ method: 'PATCH', url: `/api/reminders/${reminder.id}`, headers: { origin }, cookies: { memties_session: bob.token }, payload: { status: 'completed' } })
  assert.equal(changed.statusCode, 200, changed.body)
  await assert.rejects(followups.update(bob.user.id, reminder.id, { notifyByPush: true }), { statusCode: 403 })
  await followups.update(alice.user.id, reminder.id, { notifyByPush: true })
  assert.equal((await db.select().from(reminders).where(eq(reminders.id, reminder.id)))[0].notifyByPush, 'yes')
  assert.equal((await db.select().from(reminders).where(eq(reminders.id, reminder.id)))[0].notifyByEmail, 'yes')
  await assert.rejects(followups.update(bob.user.id, reminder.id, { notifyByEmail: false }), { statusCode: 403 })
  await followups.update(alice.user.id, reminder.id, { status: 'pending', dueAt: new Date('2026-09-20T10:00:00Z') })
  await memories.update(alice.user.id, shared.id, { ...input, reminder: undefined, groupId: vault.id })
  assert.equal((await followups.list(bob.user.id, reminderListInput.parse({}))).items.some(item => item.id === reminder.id), false)
  await assert.rejects(followups.update(bob.user.id, reminder.id, { status: 'completed' }), { statusCode: 404 })
  await memories.update(alice.user.id, shared.id, { ...input, reminder: undefined })
  await groupService.move(alice.user.id, child.id, target.id)
  assert.equal((await groupService.list(bob.user.id)).some(group => group.id === child.id), false)
  assert.equal(JSON.stringify(await tool(bobToken.token, 'search_entries', {})).includes('Shared memory'), false)
  await groupService.move(alice.user.id, child.id, null)
  assert.equal((await groupService.list(alice.user.id)).find(group => group.id === child.id)?.role, 'owner')
  await assert.rejects(groupService.move(alice.user.id, child.id, nested.id), { statusCode: 400 })
  await assert.rejects(groupService.move(alice.user.id, vault.id, target.id), { statusCode: 403 })
  await assert.rejects(groupService.move(alice.user.id, child.id, vault.id), { statusCode: 403 })
  await assert.rejects(groupService.remove(alice.user.id, child.id), { statusCode: 409 })
  await groupService.remove(alice.user.id, nested.id)
  await groupService.remove(alice.user.id, target.id)
  await tokens.revoke(bob.user.id, read.id)
  assert.ok(await tokens.authenticate(read.token))
  await tokens.revoke(alice.user.id, read.id)
  assert.equal(await tokens.authenticate(read.token), null)
  await db.update(apiTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(apiTokens.id, write.id))
  assert.equal(await tokens.authenticate(write.token), null)
  assert.equal((await app.inject({ method: 'POST', url: '/api/mcp', headers: { ...headers, authorization: `Bearer ${read.token}` }, payload: {} })).statusCode, 401)
  await assert.rejects(auth.externalLogin('saml:test', 'stable-subject', { email: alice.user.email, displayName: 'External Alice' }), { statusCode: 409 })
  const linked = await auth.externalLogin('saml:test', `stable-${suffix}`, { email: alice.user.email, displayName: 'External Alice' }, alice.user.id)
  assert.equal(linked.user.id, alice.user.id)
  assert.equal((await auth.externalLogin('saml:test', `stable-${suffix}`, { email: 'new-address@example.test', displayName: 'Changed name' })).user.id, alice.user.id)
  await assert.rejects(auth.externalLogin('saml:test', `stable-${suffix}`, { email: bob.user.email, displayName: 'Bob' }, bob.user.id), { statusCode: 409 })
})

test('MySQL: registration, group privacy, permissions and session revocation', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = process.env.TEST_DATABASE_URL!
  assert.ok(new URL(url).pathname.endsWith('_test'), 'Integration tests require a dedicated database ending in _test')
  const { db, pool } = connectDatabase(url)
  t.after(() => pool.end())
  await migrate(db, { migrationsFolder: './drizzle' })
  // Running migrations twice must be harmless.
  await migrate(db, { migrationsFolder: './drizzle' })
  const auth = createAuthService(db)
  const groupService = createGroupService(db)
  const app = await createApp({ NODE_ENV: 'test', HOST: '127.0.0.1', PORT: 3001, APP_ORIGIN: 'http://localhost:5173', DATABASE_URL: url, ALLOW_REGISTRATION: true }, { auth, groups: groupService })
  t.after(() => app.close())
  const suffix = randomUUID()
  const alice = await auth.register({ email: `alice-${suffix}@example.test`, displayName: 'Alice', password: 'correct long password' })
  const bob = await auth.register({ email: `bob-${suffix}@example.test`, displayName: 'Bob', password: 'another long password' })
  const aliceGroups = await groupService.list(alice.user.id)
  assert.equal(aliceGroups.length, 1)
  const vault = aliceGroups[0]
  assert.equal(vault.name, 'Personal')
  assert.equal(vault.isPrivate, true)
  assert.equal(vault.isPersonal, true)
  assert.equal((await groupService.list(bob.user.id)).some(group => group.id === vault.id), false)
  await assert.rejects(auth.register({ email: alice.user.email, displayName: 'Duplicate', password: 'correct long password' }), { statusCode: 409 })
  assert.equal((await db.select().from(users).where(eq(users.email, alice.user.email))).length, 1)
  await assert.rejects(auth.login(alice.user.email, 'incorrect password'), { statusCode: 401 })
  const login = await auth.login(alice.user.email, 'correct long password')
  assert.equal((await auth.authenticate(login.token))?.id, alice.user.id)

  const child = await groupService.create(alice.user.id, { name: 'Family', description: '', parentId: vault.id })
  const grandchild = await groupService.create(alice.user.id, { name: 'Cousins', description: '', parentId: child.id })
  assert.equal(grandchild.isPrivate, true)
  await assert.rejects(groupService.update(alice.user.id, vault.id, { name: 'Public', description: '' }), { statusCode: 403 })
  const headers = { origin: 'http://localhost:5173' }
  const cookies = { memties_session: bob.token }
  assert.equal((await app.inject({ method: 'POST', url: '/api/groups', headers, cookies, payload: { name: 'Intrusion', parentId: child.id } })).statusCode, 404)
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/groups/${child.id}`, headers, cookies, payload: { name: 'Intrusion' } })).statusCode, 404)
  assert.equal((await app.inject({ url: '/api/groups', cookies })).body.includes('Family'), false)

  const project = await groupService.create(alice.user.id, { name: 'Project', description: 'Initial', parentId: null })
  const team = await groupService.create(alice.user.id, { name: 'Team', description: '', parentId: project.id })
  await db.insert(groupMembers).values({ groupId: project.id, userId: bob.user.id, role: 'viewer' })
  assert.equal((await groupService.list(bob.user.id)).find(group => group.id === team.id)?.role, 'viewer')
  await assert.rejects(groupService.update(bob.user.id, team.id, { name: 'Changed', description: '' }), { statusCode: 403 })
  await assert.rejects(groupService.create(bob.user.id, { name: 'Intrusion', description: '', parentId: team.id }), { statusCode: 403 })
  await db.update(groupMembers).set({ role: 'editor' }).where(and(eq(groupMembers.groupId, project.id), eq(groupMembers.userId, bob.user.id)))
  await assert.rejects(groupService.update(bob.user.id, team.id, { name: 'Changed', description: '' }), { statusCode: 403 })
  assert.equal((await groupService.update(alice.user.id, team.id, { name: 'Renamed', description: 'Context' })).name, 'Renamed')
  // Even an invalid membership inserted outside the API cannot grant vault access.
  await db.insert(groupMembers).values({ groupId: child.id, userId: bob.user.id, role: 'owner' })
  assert.equal((await groupService.list(bob.user.id)).some(group => [vault.id, child.id, grandchild.id].includes(group.id)), false)
  await auth.logout(login.token)
  assert.equal(await auth.authenticate(login.token), null)
  await db.update(sessions).set({ expiresAt: new Date(Date.now() - 60000) }).where(eq(sessions.userId, bob.user.id))
  assert.equal(await auth.authenticate(bob.token), null)
  assert.equal((await app.inject({ url: '/api/groups', cookies })).statusCode, 401)

  // Only fixtures created by this test are removed, children first.
  for (const id of [grandchild.id, child.id, team.id, project.id, vault.id, ...(await groupService.list(bob.user.id)).filter(group => group.isPersonal).map(group => group.id)]) {
    await db.delete(groups).where(eq(groups.id, id))
  }
  await db.delete(users).where(eq(users.id, alice.user.id))
  await db.delete(users).where(eq(users.id, bob.user.id))
})

test('MySQL: recursive contacts, independent entry privacy, filtered links and authorized moves', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = process.env.TEST_DATABASE_URL!
  assert.ok(new URL(url).pathname.endsWith('_test'))
  const { db, pool } = connectDatabase(url)
  t.after(() => pool.end())
  await migrate(db, { migrationsFolder: './drizzle' })
  const auth = createAuthService(db)
  const groupService = createGroupService(db)
  const contacts = createPeopleService(db)
  const memories = createEntryService(db)
  const app = await createApp({ NODE_ENV: 'test', HOST: '127.0.0.1', PORT: 3001, APP_ORIGIN: 'http://localhost:5173', DATABASE_URL: url, ALLOW_REGISTRATION: true }, { auth, groups: groupService, content: { people: contacts, entries: memories } })
  t.after(() => app.close())
  const suffix = randomUUID()
  const alice = await auth.register({ email: `content-alice-${suffix}@example.test`, displayName: 'Alice', password: 'correct long password' })
  const bob = await auth.register({ email: `content-bob-${suffix}@example.test`, displayName: 'Bob', password: 'another long password' })
  const vault = (await groupService.list(alice.user.id))[0]
  const bobVault = (await groupService.list(bob.user.id))[0]
  const project = await groupService.create(alice.user.id, { name: 'Project', description: '', parentId: null })
  const lab = await groupService.create(alice.user.id, { name: 'Lab', description: '', parentId: project.id })
  const finance = await groupService.create(alice.user.id, { name: 'Finance', description: '', parentId: lab.id })
  const privateChild = await groupService.create(alice.user.id, { name: 'Private subtree', description: '', parentId: vault.id })
  await db.insert(groupMembers).values({ groupId: project.id, userId: bob.user.id, role: 'viewer' })
  const thomas = await contacts.create(alice.user.id, personInput.parse({ displayName: 'Thomas', organization: 'Laboratory', groupIds: [lab.id, finance.id, vault.id] }))
  const marie = await contacts.create(alice.user.id, personInput.parse({ displayName: 'Marie', groupIds: [finance.id] }))
  const hidden = await contacts.create(alice.user.id, personInput.parse({ displayName: 'Secret contact', groupIds: [privateChild.id] }))
  const list = await contacts.list(bob.user.id, listInput.parse({ groupId: project.id }))
  assert.deepEqual(list.items.map(person => person.id).sort(), [thomas.id, marie.id].sort())
  assert.equal(list.items.find(person => person.id === thomas.id)?.groupIds.includes(vault.id), false)
  await assert.rejects(contacts.get(bob.user.id, hidden.id), { statusCode: 404 })
  await assert.rejects(contacts.create(bob.user.id, personInput.parse({ displayName: 'No write', groupIds: [lab.id] })), { statusCode: 403 })
  assert.equal((await contacts.list(bob.user.id, listInput.parse({ q: 'Secret' }))).items.length, 0)
  assert.equal((await contacts.list(bob.user.id, listInput.parse({ q: '%' }))).items.length, 0)

  const sharedInput = entryInput.parse({ title: 'Budget meeting', body: 'Discussed budget', occurredAt: '2026-09-01T10:00:00Z', groupId: finance.id, personIds: [thomas.id, marie.id] })
  const shared = await memories.create(alice.user.id, sharedInput)
  const privateInput = { ...sharedInput, title: 'Private observation', groupId: privateChild.id }
  const privateEntry = await memories.create(alice.user.id, privateInput)
  const mixed = await memories.create(alice.user.id, { ...sharedInput, title: 'Visible note', personIds: [thomas.id, hidden.id] })
  const note = await memories.create(alice.user.id, { ...sharedInput, title: 'Standalone note', personIds: [] })
  assert.equal(note.people.length, 0)
  const bobHistory = await memories.list(bob.user.id, historyInput.parse({ personId: thomas.id, groupId: project.id }))
  assert.deepEqual(bobHistory.items.map(entry => entry.id).sort(), [shared.id, mixed.id].sort())
  assert.equal(JSON.stringify(bobHistory).includes(privateEntry.id), false)
  assert.equal(JSON.stringify(bobHistory).includes(hidden.id), false)
  assert.equal(JSON.stringify(bobHistory).includes('Secret contact'), false)
  await assert.rejects(memories.get(bob.user.id, privateEntry.id), { statusCode: 404 })
  await assert.rejects(memories.list(bob.user.id, historyInput.parse({ participantId: hidden.id })), { statusCode: 404 })
  assert.equal((await memories.list(bob.user.id, historyInput.parse({ q: 'Private observation' }))).items.length, 0)
  assert.deepEqual((await memories.list(bob.user.id, historyInput.parse({ personId: thomas.id, participantId: marie.id }))).items.map(entry => entry.id), [shared.id])
  assert.equal((await memories.list(bob.user.id, historyInput.parse({ from: '2026-09-02T00:00:00Z' }))).items.length, 0)
  assert.equal((await memories.list(bob.user.id, historyInput.parse({ q: '%' }))).items.length, 0)
  const firstPage = await memories.list(bob.user.id, historyInput.parse({ limit: 1 }))
  const secondPage = await memories.list(bob.user.id, historyInput.parse({ limit: 1, offset: firstPage.nextOffset }))
  assert.equal(firstPage.nextOffset, 1)
  assert.notEqual(firstPage.items[0].id, secondPage.items[0].id)
  await assert.rejects(memories.create(bob.user.id, sharedInput), { statusCode: 403 })
  await assert.rejects(memories.update(bob.user.id, shared.id, { ...sharedInput, groupId: bobVault.id }), { statusCode: 403 })
  await assert.rejects(memories.update(alice.user.id, privateEntry.id, { ...privateInput, groupId: bobVault.id }), { statusCode: 404 })

  await db.update(groupMembers).set({ role: 'editor' }).where(and(eq(groupMembers.groupId, project.id), eq(groupMembers.userId, bob.user.id)))
  await assert.rejects(memories.create(bob.user.id, { ...sharedInput, personIds: [hidden.id] }), { statusCode: 404 })
  const updated = await memories.update(bob.user.id, mixed.id, { ...sharedInput, title: 'Edited visible note', personIds: [marie.id] })
  assert.equal(updated.creatorId, alice.user.id)
  assert.deepEqual(updated.people.map(person => person.id), [marie.id])
  assert.deepEqual((await memories.get(alice.user.id, mixed.id)).people.map(person => person.id).sort(), [marie.id, hidden.id].sort())
  await memories.update(alice.user.id, privateEntry.id, { ...privateInput, groupId: lab.id })
  assert.equal((await memories.get(bob.user.id, privateEntry.id)).id, privateEntry.id)
  await memories.update(alice.user.id, privateEntry.id, privateInput)
  await assert.rejects(memories.get(bob.user.id, privateEntry.id), { statusCode: 404 })

  const headers = { origin: 'http://localhost:5173' }
  const cookies = { memties_session: bob.token }
  assert.equal((await app.inject({ url: '/api/people' })).statusCode, 401)
  assert.equal((await app.inject({ url: `/api/people/${hidden.id}`, cookies })).statusCode, 404)
  assert.equal((await app.inject({ url: `/api/entries/${privateEntry.id}`, cookies })).statusCode, 404)
  assert.equal((await app.inject({ method: 'POST', url: '/api/entries', headers, cookies, payload: { ...sharedInput, occurredAt: sharedInput.occurredAt.toISOString(), source: 'mcp' } })).statusCode, 400)
  assert.equal((await app.inject({ method: 'POST', url: '/api/entries', headers, cookies, payload: { ...sharedInput, occurredAt: 'not a date' } })).statusCode, 400)
  assert.equal((await app.inject({ method: 'POST', url: '/api/entries', headers, cookies, payload: { ...sharedInput, occurredAt: '0999-01-01T00:00:00Z' } })).statusCode, 400)

  await db.delete(entries).where(eq(entries.creatorId, alice.user.id))
  await db.delete(people).where(eq(people.creatorId, alice.user.id))
  for (const id of [finance.id, lab.id, project.id, privateChild.id, vault.id, bobVault.id]) await db.delete(groups).where(eq(groups.id, id))
  await db.delete(users).where(inArray(users.id, [alice.user.id, bob.user.id]))
})

test('MySQL: sharing roles, inherited access, last owner and editing all contact groups', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = process.env.TEST_DATABASE_URL!
  assert.ok(new URL(url).pathname.endsWith('_test'))
  const { db, pool } = connectDatabase(url)
  t.after(() => pool.end())
  await migrate(db, { migrationsFolder: './drizzle' })
  const auth = createAuthService(db)
  const groupService = createGroupService(db)
  const sharing = createSharingService(db)
  const contacts = createPeopleService(db)
  const suffix = randomUUID()
  const alice = await auth.register({ email: `sharing-alice-${suffix}@example.test`, displayName: 'Alice', password: 'correct long password' })
  const bob = await auth.register({ email: `sharing-bob-${suffix}@example.test`, displayName: 'Bob', password: 'another long password' })
  const vault = (await groupService.list(alice.user.id))[0]
  const bobVault = (await groupService.list(bob.user.id))[0]
  const project = await groupService.create(alice.user.id, { name: 'Shared', description: '', parentId: null })
  const child = await groupService.create(alice.user.id, { name: 'Child', description: '', parentId: project.id })
  const privateChild = await groupService.create(alice.user.id, { name: 'Private child', description: '', parentId: vault.id })
  const other = await groupService.create(alice.user.id, { name: 'Other', description: '', parentId: null })
  for (const id of [vault.id, privateChild.id]) {
    await assert.rejects(sharing.list(alice.user.id, id), { statusCode: 403 })
    await assert.rejects(sharing.set(alice.user.id, id, { email: bob.user.email, role: 'owner' }), { statusCode: 403 })
    await assert.rejects(sharing.remove(alice.user.id, id, alice.user.id), { statusCode: 403 })
  }
  await assert.rejects(sharing.remove(alice.user.id, project.id, alice.user.id), { statusCode: 409 })
  await assert.rejects(sharing.set(alice.user.id, project.id, { email: alice.user.email, role: 'viewer' }), { statusCode: 409 })
  await sharing.set(alice.user.id, project.id, { email: bob.user.email, role: 'viewer' })
  assert.equal((await groupService.list(bob.user.id)).find(group => group.id === child.id)?.role, 'viewer')
  await assert.rejects(sharing.list(bob.user.id, project.id), { statusCode: 403 })
  await assert.rejects(sharing.set(bob.user.id, project.id, { email: bob.user.email, role: 'owner' }), { statusCode: 403 })
  await assert.rejects(sharing.remove(bob.user.id, project.id, alice.user.id), { statusCode: 403 })
  const input = personInput.parse({ displayName: 'Multigroup contact', groupIds: [child.id, other.id] })
  const contact = await contacts.create(alice.user.id, input)
  assert.equal((await contacts.get(bob.user.id, contact.id)).canEdit, false)
  await sharing.set(alice.user.id, project.id, { email: bob.user.email, role: 'editor' })
  await assert.rejects(contacts.update(bob.user.id, contact.id, { ...input, displayName: 'Intrusion', groupIds: [child.id] }), { statusCode: 403 })
  await sharing.set(alice.user.id, other.id, { email: bob.user.email, role: 'editor' })
  assert.equal((await contacts.get(bob.user.id, contact.id)).canEdit, true)
  assert.equal((await contacts.update(bob.user.id, contact.id, { ...input, displayName: 'Updated' })).displayName, 'Updated')
  await assert.rejects(contacts.update(bob.user.id, contact.id, { ...input, groupIds: [vault.id] }), { statusCode: 404 })
  await sharing.remove(alice.user.id, other.id, bob.user.id)
  assert.equal((await contacts.get(bob.user.id, contact.id)).canEdit, false)
  await assert.rejects(contacts.update(bob.user.id, contact.id, input), { statusCode: 403 })
  assert.equal((await contacts.get(alice.user.id, contact.id)).displayName, 'Updated')

  await sharing.set(alice.user.id, child.id, { email: bob.user.email, role: 'viewer' })
  const inherited = (await sharing.list(alice.user.id, child.id)).find(member => member.userId === bob.user.id)!
  assert.deepEqual([inherited.role, inherited.directRole, inherited.inheritedRole], ['editor', 'viewer', 'editor'])
  await sharing.remove(alice.user.id, child.id, bob.user.id)
  assert.equal((await groupService.list(bob.user.id)).find(group => group.id === child.id)?.role, 'editor')
  await sharing.remove(alice.user.id, project.id, bob.user.id)
  assert.equal((await groupService.list(bob.user.id)).some(group => group.id === child.id), false)
  await assert.rejects(contacts.get(bob.user.id, contact.id), { statusCode: 404 })
  await sharing.set(alice.user.id, project.id, { email: bob.user.email, role: 'owner' })
  await sharing.remove(alice.user.id, project.id, alice.user.id)
  await assert.rejects(sharing.list(alice.user.id, project.id), { statusCode: 404 })
  await assert.rejects(sharing.remove(bob.user.id, project.id, bob.user.id), { statusCode: 409 })
  // Concurrent last-owner removals must never leave a root without an owner.
  await sharing.set(bob.user.id, project.id, { email: alice.user.email, role: 'owner' })
  const removals = await Promise.allSettled([sharing.remove(alice.user.id, project.id, alice.user.id), sharing.remove(bob.user.id, project.id, bob.user.id)])
  assert.equal(removals.filter(result => result.status === 'fulfilled').length, 1)

  const app = await createApp({ NODE_ENV: 'test', HOST: '127.0.0.1', PORT: 3001, APP_ORIGIN: 'http://localhost:5173', DATABASE_URL: url, ALLOW_REGISTRATION: true }, { auth, groups: groupService, sharing })
  t.after(() => app.close())
  assert.equal((await app.inject({ url: `/api/groups/${other.id}/members` })).statusCode, 401)
  assert.equal((await app.inject({ method: 'PUT', url: `/api/groups/${other.id}/members`, cookies: { memties_session: alice.token }, headers: { origin: 'http://localhost:5173' }, payload: { email: bob.user.email, role: 'admin' } })).statusCode, 400)
  await db.delete(people).where(eq(people.creatorId, alice.user.id))
  for (const id of [child.id, project.id, other.id, privateChild.id, vault.id, bobVault.id]) await db.delete(groups).where(eq(groups.id, id))
  await db.delete(users).where(inArray(users.id, [alice.user.id, bob.user.id]))
})
