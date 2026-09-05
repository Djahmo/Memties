import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, verifyPassword } from './password.js'

test('passwords are salted and only the correct password verifies', async () => {
  const password = 'a long test password é 🔐'
  const first = await hashPassword(password)
  assert.notEqual(first, await hashPassword(password))
  assert.equal(first.includes(password), false)
  assert.equal(await verifyPassword(password, first), true)
  assert.equal(await verifyPassword('incorrect password', first), false)
  assert.equal(await verifyPassword(password, 'malformed'), false)
})
