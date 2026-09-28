import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './server.js'
import type { McpServices } from './server.js'

test('MCP contact tools preserve omitted fields and pass direct group searches through', async t => {
  const personId = '11111111-1111-4111-8111-111111111111'
  const groupId = '22222222-2222-4222-8222-222222222222'
  const calls: { updated?: Record<string, unknown>; directOnly?: boolean; upcomingGroupId?: string } = {}
  const server = createMcpServer({ people: {
    get: async () => ({ id: personId, displayName: 'Alice Smith', firstName: 'Alice', lastName: 'Smith', nickname: 'Ali', email: 'alice@example.com', phone: '123', organization: 'Studio', jobTitle: 'Designer', notes: 'Existing note', groupIds: [groupId], importantDates: [{ id: '33333333-3333-4333-8333-333333333333', label: 'Birthday', date: '2000-09-30', annualReminder: true }] }),
    update: async (_userId: string, _id: string, input: Record<string, unknown>) => { calls.updated = input; return input },
    list: async (_userId: string, input: { directOnly?: boolean }) => { calls.directOnly = input.directOnly; return { items: [], nextOffset: null } },
    upcomingDates: async (_userId: string, input: string | undefined) => { calls.upcomingGroupId = input; return [] },
  } } as unknown as McpServices, { userId: personId, access: 'write' })
  const client = new Client({ name: 'test', version: '1' }, { capabilities: {} })
  const transports = InMemoryTransport.createLinkedPair()
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(transports[0])
  await client.connect(transports[1])

  assert.ok((await client.listTools()).tools.some(tool => tool.name === 'update_person'))
  assert.equal((await client.callTool({ name: 'update_person', arguments: { id: personId, changes: { nickname: 'New nickname' } } })).isError, undefined)
  assert.deepEqual(calls.updated, { nickname: 'New nickname' })

  await client.callTool({ name: 'search_people', arguments: { groupId, directOnly: true } })
  assert.equal(calls.directOnly, true)
  await client.callTool({ name: 'list_upcoming_dates', arguments: { groupId } })
  assert.equal(calls.upcomingGroupId, groupId)
})
