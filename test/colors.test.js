import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pickerColors } from '../src/colors.js'

test('픽커 수만큼 색을 준다', () => {
  assert.equal(pickerColors(8).length, 8)
  assert.equal(pickerColors(1).length, 1)
  assert.equal(pickerColors(0).length, 0)
})

test('색은 여섯 자리 hex 다', () => {
  for (const color of pickerColors(8)) assert.match(color, /^#[0-9a-f]{6}$/)
})

test('돌려 쓰지 않는다. 픽커가 늘면 색도 는다', () => {
  const 열둘 = pickerColors(12)

  assert.equal(new Set(열둘).size, 12)
})

test('같은 수를 물으면 같은 색이 나온다', () => {
  assert.deepEqual(pickerColors(8), pickerColors(8))
})

test('이웃한 색은 서로 멀다', () => {
  // 색상환을 고르게 나눈다. 여덟이면 45도씩 벌어진다.
  const 여덟 = pickerColors(8)

  assert.notEqual(여덟[0], 여덟[4])
  assert.equal(new Set(여덟).size, 8)
})
