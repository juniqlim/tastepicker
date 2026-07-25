/**
 * 네이버에 실제로 물어보는 시험. `npm test` 에는 들지 않는다.
 * 남의 서버가 답해야 하는 시험이라 매번 돌릴 수 없고, 끊기면 우리 잘못이 아니다.
 *
 *   node --test test/closed.live.js
 *
 * 판정의 근거는 네이버의 응답 방식이다. 그것이 바뀌면 여기가 먼저 깨진다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { askPlace, isGone } from '../src/closed.js'

test('있지도 않은 번호는 없어진 것으로 나온다', async () => {
  assert.equal(isGone(await askPlace('999999999999')), true)
})

test('영업 중인 가게는 있는 것으로 나온다', async () => {
  // 마포원조떡볶이. 이 집이 문을 닫으면 이 시험도 갈아야 한다.
  assert.equal(isGone(await askPlace('13160207')), false)
})

test('잇달아 물어도 막히지 않는다', async () => {
  // Node 로 부르면 여기서 막힌다(429). 막히면 살아있는 가게가 없어진 것처럼 보인다.
  const answers = []
  for (let turn = 0; turn < 20; turn++) answers.push(await askPlace('13160207'))

  assert.deepEqual([...new Set(answers)], [302])
})
