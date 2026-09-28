import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Group } from '../src/types/api.ts'
import { toggleGroupSelection } from '../src/modules/groups/groupSelection.ts'

const groups: Group[] = [
  { id: 'parent', parentId: null, role: 'owner' as const },
  { id: 'child', parentId: 'parent', role: 'owner' as const },
  { id: 'readonly', parentId: 'parent', role: 'viewer' as const },
].map(group => ({ ...group, name: group.id, color: '#64748b', description: '', position: 0, isPersonal: false, isPrivate: false }))

test('selecting a child does not assign the contact to its parent', () => {
  assert.deepEqual(toggleGroupSelection(groups, [], 'child', true), ['child'])
  assert.deepEqual(toggleGroupSelection(groups, ['parent'], 'child', true), ['parent', 'child'])
})

test('removing a legacy parent association preserves the child association', () => {
  assert.deepEqual(toggleGroupSelection(groups, ['parent', 'child'], 'parent', false), ['child'])
  assert.deepEqual(toggleGroupSelection(groups, ['child'], 'child', true), ['child'])
})

test('read-only and unknown groups cannot be selected', () => {
  assert.deepEqual(toggleGroupSelection(groups, [], 'readonly', true), [])
  assert.deepEqual(toggleGroupSelection(groups, ['child'], 'missing', true), ['child'])
})
