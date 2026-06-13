import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  crosses,
  fillQuantity,
  parseDec,
  quoteAmount,
  remainderQuantity,
  toDec,
} from '../src/decimal.ts'

test('parse/format round-trips at 10dp', () => {
  assert.equal(toDec(parseDec('2.5')), '2.5000000000')
  assert.equal(toDec(parseDec('10')), '10.0000000000')
  assert.equal(toDec(parseDec('0')), '0.0000000000')
  assert.equal(toDec(parseDec('-3.25')), '-3.2500000000')
})

test('crosses: buyLimit >= sellLimit, equal crosses', () => {
  assert.equal(crosses(parseDec('2.0'), parseDec('1.0')), true)
  assert.equal(crosses(parseDec('1.0'), parseDec('1.0')), true)
  assert.equal(crosses(parseDec('0.9'), parseDec('1.0')), false)
})

test('fillQuantity = min', () => {
  assert.equal(toDec(fillQuantity(parseDec('10'), parseDec('8'))), '8.0000000000')
  assert.equal(toDec(fillQuantity(parseDec('8'), parseDec('10'))), '8.0000000000')
})

test('quoteAmount floors the exact product down to 10dp', () => {
  // exact 1.0000000001 * 1.0000000001 = 1.00000000020000000001 -> floor10 = 1.0000000002
  assert.equal(
    toDec(quoteAmount(parseDec('1.0000000001'), parseDec('1.0000000001'))),
    '1.0000000002',
  )
  // exact 0.0000000003 * 0.0000000003 = 9e-20 -> floor10 = 0
  assert.equal(
    toDec(quoteAmount(parseDec('0.0000000003'), parseDec('0.0000000003'))),
    '0.0000000000',
  )
  assert.equal(toDec(quoteAmount(parseDec('10'), parseDec('2.0'))), '20.0000000000')
})

test('remainderQuantity: re-rest iff rest >= minFill', () => {
  assert.equal(remainderQuantity(parseDec('10'), parseDec('8'), parseDec('1')), parseDec('2'))
  assert.equal(remainderQuantity(parseDec('10'), parseDec('9.5'), parseDec('1')), null)
})
