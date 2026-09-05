import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveGroupAccess } from './permissions.js'
import type { GroupNode } from './permissions.js'

test('parent access propagates without exposing unrelated trees', () => {
  const nodes = [
    { id: 'project', parentId: null, personalOwnerId: null },
    { id: 'team', parentId: 'project', personalOwnerId: null },
    { id: 'other', parentId: null, personalOwnerId: null },
  ]
  const access = resolveGroupAccess('alice', nodes, [{ groupId: 'project', role: 'editor' }, { groupId: 'team', role: 'viewer' }])
  assert.deepEqual([...access.keys()].sort(), ['project', 'team'])
  assert.deepEqual(access.get('team'), { role: 'editor', isPrivate: false })
  assert.equal(resolveGroupAccess('alice', nodes, [{ groupId: 'team', role: 'viewer' }]).has('project'), false)
})

test('Personal and its descendants reject foreign direct and inherited access', () => {
  const nodes = [
    { id: 'shared', parentId: null, personalOwnerId: null },
    { id: 'vault', parentId: 'shared', personalOwnerId: 'alice' },
    { id: 'child', parentId: 'vault', personalOwnerId: null },
  ]
  const access = resolveGroupAccess('bob', nodes, [{ groupId: 'shared', role: 'owner' }, { groupId: 'child', role: 'owner' }, { groupId: 'vault', role: 'owner' }])
  assert.deepEqual([...access.keys()], ['shared'])
  const ownerAccess = resolveGroupAccess('alice', nodes, [])
  assert.deepEqual(ownerAccess.get('child'), { role: 'owner', isPrivate: true })
})

test('deep trees are not constrained by recursion limits', () => {
  const nodes: GroupNode[] = Array.from({ length: 15000 }, (_, index) => ({
    id: String(index), parentId: index ? String(index - 1) : null, personalOwnerId: null,
  }))
  assert.equal(resolveGroupAccess('alice', nodes, [{ groupId: '0', role: 'viewer' }]).size, 15000)
})

test('malformed orphaned and cyclic trees fail closed', () => {
  const nodes = [
    { id: 'a', parentId: 'b', personalOwnerId: null },
    { id: 'b', parentId: 'a', personalOwnerId: null },
    { id: 'orphan', parentId: 'missing', personalOwnerId: null },
  ]
  assert.equal(resolveGroupAccess('alice', nodes, [{ groupId: 'a', role: 'owner' }, { groupId: 'orphan', role: 'owner' }]).size, 0)
})
