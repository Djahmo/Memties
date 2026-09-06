import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import type { Config } from '../config.js'

const config: Config = { NODE_ENV: 'test', HOST: '127.0.0.1', PORT: 3001, APP_ORIGIN: 'http://localhost:5173', DATABASE_URL: 'mysql://unused', ALLOW_REGISTRATION: true }
const user = { id: '123', email: 'alice@example.test', displayName: 'Alice' }
const unused = async (): Promise<never> => { throw new Error('Protected service should not have been called') }

test('HTTP rejects anonymous requests, foreign origins and malformed inputs', async t => {
  const app = await createApp(config, {
    auth: { authenticate: async token => token === 'valid' ? user : null, register: unused, login: unused, logout: unused, externalLogin: unused },
    groups: { list: async () => [], create: unused, update: unused, move: unused, remove: unused },
  })
  t.after(() => app.close())
  assert.equal((await app.inject({ url: '/api/groups' })).statusCode, 401)
  assert.equal((await app.inject({ url: '/api/auth/me' })).statusCode, 401)
  assert.equal((await app.inject({ url: '/api/groups', cookies: { memties_session: 'valid' } })).statusCode, 200)
  for (const origin of [undefined, 'https://evil.example']) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', headers: origin ? { origin } : {}, payload: { email: 'alice@example.test', password: 'secret' } })).statusCode, 403)
  }
  const headers = { origin: config.APP_ORIGIN }
  assert.equal((await app.inject({ method: 'POST', url: '/api/groups', headers, payload: { name: 'group' } })).statusCode, 401)
  assert.equal((await app.inject({ method: 'POST', url: '/api/groups', headers, cookies: { memties_session: 'valid' }, payload: { name: 'group', personalOwnerId: '123' } })).statusCode, 400)
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/register', headers, payload: { email: 'alice@example.test', displayName: 'Alice', password: 'short' } })).statusCode, 400)
})

test('session cookies are HttpOnly, Secure in production, and cleared on logout', async t => {
  let revoked: string | undefined
  const app = await createApp({ ...config, NODE_ENV: 'production', APP_ORIGIN: 'https://memties.example' }, {
    auth: {
      authenticate: async () => null,
      register: unused,
      externalLogin: unused,
      login: async () => ({ user, token: 'new-session' }),
      logout: async token => { revoked = token },
    },
    groups: { list: unused, create: unused, update: unused, move: unused, remove: unused },
  })
  t.after(() => app.close())
  const headers = { origin: 'https://memties.example' }
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { email: user.email, password: 'correct-password' } })
  assert.equal(login.statusCode, 200)
  const session = login.cookies.find(cookie => cookie.name === 'memties_session')!
  assert.equal(session.httpOnly, true)
  assert.equal(session.secure, true)
  assert.equal(session.sameSite, 'Lax')
  assert.equal(login.body.includes('new-session'), false)
  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers, cookies: { memties_session: 'new-session' } })
  assert.equal(revoked, 'new-session')
  assert.equal(logout.statusCode, 200)
  assert.equal(logout.cookies[0].value, '')
})

test('registration can be disabled and login attempts are rate limited', async t => {
  const app = await createApp({ ...config, ALLOW_REGISTRATION: false }, {
    auth: { authenticate: async () => null, register: unused, login: unused, logout: unused, externalLogin: unused },
    groups: { list: unused, create: unused, update: unused, move: unused, remove: unused },
  })
  t.after(() => app.close())
  const headers = { origin: config.APP_ORIGIN }
  assert.deepEqual((await app.inject({ url: '/api/auth/config' })).json(), { registrationEnabled: false, ldapEnabled: false, samlEnabled: false })
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/register', headers, payload: {} })).statusCode, 403)
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: {} })).statusCode, 400)
  }
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: {} })).statusCode, 429)
})
