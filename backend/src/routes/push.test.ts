import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import webpush from 'web-push'
import { pushEndpoint, pushInput } from '../services/push.js'
import { pushRoutes } from './push.js'
import type { Config } from '../config.js'

test('push endpoints reject arbitrary hosts, credentials and insecure destinations', () => {
  for (const endpoint of ['https://localhost/push', 'https://127.0.0.1/push', 'http://fcm.googleapis.com/push', 'https://fcm.googleapis.com.evil.test/push', 'https://user:pass@fcm.googleapis.com/push', 'https://fcm.googleapis.com:8443/push']) {
    assert.equal(pushEndpoint.safeParse(endpoint).success, false, endpoint)
  }
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/abc', 'https://wns2-par02p.notify.windows.com/abc']) {
    assert.equal(pushEndpoint.safeParse(endpoint).success, true, endpoint)
  }
  const keys = webpush.generateVAPIDKeys()
  assert.equal(pushInput.safeParse({ endpoint: 'https://fcm.googleapis.com/test', keys: { p256dh: keys.publicKey, auth: 'AAAAAAAAAAAAAAAAAAAAAA' }, expirationTime: null }).success, true)
  assert.equal(pushInput.safeParse({ endpoint: 'https://fcm.googleapis.com/test', keys: { p256dh: 'bad', auth: 'bad' } }).success, false)
})

test('push routes require authentication and pass only the authenticated owner to the service', async t => {
  const app = Fastify()
  t.after(() => app.close())
  app.decorateRequest('user', null)
  app.addHook('onRequest', async request => {
    if (request.headers.authorization === 'test') request.user = { id: 'owner', email: 'owner@example.test', displayName: 'Owner' }
  })
  const calls: string[] = []
  const config: Config = { NODE_ENV: 'test', HOST: 'localhost', PORT: 3001, APP_ORIGIN: 'https://example.test', DATABASE_URL: 'mysql://localhost/test', ALLOW_REGISTRATION: true, VAPID_PUBLIC_KEY: webpush.generateVAPIDKeys().publicKey }
  await pushRoutes(app, {
    list: async userId => { calls.push(userId); return [] },
    subscribe: async userId => { calls.push(userId); return { success: true } },
    unsubscribe: async userId => { calls.push(userId); return { success: true } },
  }, config)
  assert.equal((await app.inject('/api/push/subscriptions')).statusCode, 401)
  assert.equal(calls.length, 0)
  assert.equal((await app.inject({ url: '/api/push/subscriptions', headers: { authorization: 'test' } })).statusCode, 200)
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/push/subscriptions', headers: { authorization: 'test' }, payload: { endpoint: 'https://fcm.googleapis.com/test' } })).statusCode, 200)
  assert.deepEqual(calls, ['owner', 'owner'])
})
