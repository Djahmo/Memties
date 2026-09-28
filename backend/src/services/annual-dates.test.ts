import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextAnnualDate } from './annual-dates.js'

test('an annual date remains upcoming on its day and rolls forward afterward', () => {
  assert.equal(nextAnnualDate('1990-09-28', new Date('2026-09-28T18:00:00Z')), '2026-09-28')
  assert.equal(nextAnnualDate('1990-09-28', new Date('2026-09-29T00:00:00Z')), '2027-09-28')
})

test('29 February falls on 28 February in non-leap years', () => {
  assert.equal(nextAnnualDate('2000-02-29', new Date('2026-01-01T00:00:00Z')), '2026-02-28')
  assert.equal(nextAnnualDate('2000-02-29', new Date('2028-01-01T00:00:00Z')), '2028-02-29')
})

test('annual reminders never precede the original event', () => {
  assert.equal(nextAnnualDate('2028-06-15', new Date('2026-09-28T12:00:00Z')), '2028-06-15')
  assert.equal(nextAnnualDate('2028-02-29', new Date('2026-01-01T00:00:00Z')), '2028-02-29')
})
