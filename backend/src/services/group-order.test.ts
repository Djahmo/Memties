import assert from 'node:assert/strict'
import { test } from 'node:test'
import { insertionPosition } from './group-order.js'

test('group ordering inserts before, between and after siblings without modifying them', () => {
  const siblings = [{ id: 'a', position: 1024 }, { id: 'b', position: 2048 }]
  assert.equal(insertionPosition(siblings, 'a'), 0)
  assert.equal(insertionPosition(siblings, 'b'), 1536)
  assert.equal(insertionPosition(siblings, null), 3072)
  assert.equal(insertionPosition([]), 1024)
  assert.deepEqual(siblings, [{ id: 'a', position: 1024 }, { id: 'b', position: 2048 }])
})

test('group ordering rejects missing targets and exhausted gaps', () => {
  assert.throws(() => insertionPosition([{ id: 'a', position: 0 }], 'missing'), { statusCode: 409 })
  assert.throws(() => insertionPosition([{ id: 'a', position: 0 }, { id: 'b', position: 0 }], 'b'), { statusCode: 409 })
})
