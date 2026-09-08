import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { adminRoutes } from './admin.js'
import { ServiceError } from '../services/errors.js'
import { accountRole, administratorEmails } from '../auth/admin.js'

test('administrator email matching is normalized and exact', () => {
  const admins = administratorEmails(' Admin@Example.test , other@example.test ')
  assert.equal(accountRole('ADMIN@example.test', admins), 'admin')
  assert.equal(accountRole('admin@example.test.evil', admins), 'user')
  assert.equal(accountRole('nobody@example.test', administratorEmails()), 'user')
})

test('admin endpoints deny anonymous and ordinary users and validate updates', async t => {
  const app = Fastify()
  t.after(() => app.close())
  let changes = 0
  let lists = 0
  let deletions = 0
  app.decorateRequest('user', null)
  app.addHook('onRequest', async request => {
    if (request.headers.authorization) request.user = { id: 'actor', email: 'actor@example.test', displayName: 'Actor', role: request.headers.authorization === 'admin' ? 'admin' : 'user' }
  })
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof ServiceError ? error.statusCode : 400).send({ message: error instanceof Error ? error.message : 'Invalid request' }))
  await adminRoutes(app, { list: async () => { lists++; return { items: [], nextOffset: null } }, setStatus: async (actor, id, status) => {
    assert.equal(actor, 'actor'); assert.equal(id, 'd791aebe-caba-4470-9be2-fbc135c81cda'); assert.equal(status, 'suspended')
    changes++; return { success: true }
  }, remove: async (actor, id, email) => {
    assert.equal(actor, 'actor'); assert.equal(id, 'd791aebe-caba-4470-9be2-fbc135c81cda'); assert.equal(email, 'member@example.test')
    deletions++; return { success: true }
  } })
  const url = '/api/admin/users/d791aebe-caba-4470-9be2-fbc135c81cda'
  for (const authorization of [undefined, 'user']) {
    const headers = authorization ? { authorization } : {}
    const expected = authorization ? 403 : 401
    assert.equal((await app.inject({ url: '/api/admin/users', headers })).statusCode, expected)
    assert.equal((await app.inject({ method: 'PATCH', url, headers, payload: { status: 'suspended' } })).statusCode, expected)
    assert.equal((await app.inject({ method: 'DELETE', url, headers, payload: { email: 'member@example.test' } })).statusCode, expected)
  }
  assert.equal(lists, 0); assert.equal(changes, 0)
  const headers = { authorization: 'admin' }
  assert.equal((await app.inject({ url: '/api/admin/users', headers })).statusCode, 200)
  assert.equal((await app.inject({ method: 'PATCH', url, headers, payload: { status: 'suspended', role: 'admin' } })).statusCode, 400)
  assert.equal((await app.inject({ method: 'PATCH', url, headers, payload: { status: 'suspended' } })).statusCode, 200)
  assert.equal(changes, 1)
  assert.equal(deletions, 0)
  assert.equal((await app.inject({ method: 'DELETE', url, headers, payload: {} })).statusCode, 400)
  assert.equal((await app.inject({ method: 'DELETE', url, headers, payload: { email: 'member@example.test' } })).statusCode, 200)
  assert.equal(deletions, 1)
})
