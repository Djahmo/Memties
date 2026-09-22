import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Group } from '../src/types/api'
import { canMoveGroup, compareGroups, previewGroupMove, projectGroupDrop } from '../src/modules/groups/groupDrag'

const groups: Group[] = [
  { id: 'a', name: 'A', parentId: null, position: 1024, color: '#64748b', description: '', isPersonal: false, isPrivate: false, role: 'owner' },
  { id: 'b', name: 'B', parentId: null, position: 2048, color: '#64748b', description: '', isPersonal: false, isPrivate: false, role: 'owner' },
  { id: 'child', name: 'Child', parentId: 'a', position: 1024, color: '#64748b', description: '', isPersonal: false, isPrivate: false, role: 'owner' },
  { id: 'nested', name: 'Nested', parentId: 'child', position: 1024, color: '#64748b', description: '', isPersonal: false, isPrivate: false, role: 'owner' },
]
const rows = [{ group: groups[0]!, depth: 0 }, { group: groups[2]!, depth: 1 }, { group: groups[3]!, depth: 2 }, { group: groups[1]!, depth: 0 }]

test('sibling drop preserves the parent and places the preview before the target', () => {
  const target = projectGroupDrop(groups, rows, 0, 'before', groups[1]!)!
  assert.deepEqual(target, { parentId: null, beforeId: 'a', index: 0, depth: 0 })
  assert.equal(previewGroupMove(groups, groups[1]!, target).parentId, null)
  assert.ok(previewGroupMove(groups, groups[1]!, target).position < groups[0]!.position)
  assert.equal(projectGroupDrop(groups, rows, 3, 'before', groups[0]!), null)
})

test('inside drop previews the first child, after drop skips the entire subtree', () => {
  assert.deepEqual(projectGroupDrop(groups, rows, 0, 'inside', groups[1]!), { parentId: 'a', beforeId: 'child', index: 1, depth: 1 })
  assert.deepEqual(projectGroupDrop(groups, rows, 0, 'after', groups[2]!), { parentId: null, beforeId: 'b', index: 3, depth: 0 })
})

test('invalid destinations and protected groups are rejected', () => {
  assert.equal(canMoveGroup(groups, groups[0]!, 'nested'), false)
  assert.equal(canMoveGroup(groups, { ...groups[0]!, isPersonal: true }, null), false)
  assert.equal(canMoveGroup(groups, { ...groups[0]!, role: 'viewer' }, 'b'), false)
  assert.equal(canMoveGroup(groups, { ...groups[2]!, isPrivate: true }, null), true)
  assert.equal(projectGroupDrop(groups, rows, 1, 'inside', groups[0]!), null)
})

test('groups may enter Personal while its root remains protected', () => {
  const personal: Group = { ...groups[0]!, id: 'personal', isPrivate: true, isPersonal: true }
  assert.equal(canMoveGroup([...groups, personal], groups[0]!, personal.id), true)
  assert.equal(canMoveGroup([...groups, personal], personal, groups[0]!.id), false)
})

test('saved position takes precedence over alphabetical order', () => {
  assert.deepEqual([{ ...groups[0]!, position: 4096 }, groups[1]!].sort(compareGroups).map(group => group.id), ['b', 'a'])
})
