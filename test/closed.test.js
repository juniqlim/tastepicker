import { test } from 'node:test'
import assert from 'node:assert/strict'

import { checkUrl, isGone, checkable } from '../src/closed.js'

test('살아있는 장소는 업종 페이지로 넘긴다', () => {
  // 302 로 넘기는 것 자체가 그 장소가 있다는 뜻이다.
  assert.equal(isGone(302), false)
})

test('없어진 장소는 넘기지 않고 빈 껍데기를 준다', () => {
  // 있지도 않았던 번호와 같은 응답이다. 네이버에서 지워진 것이다.
  assert.equal(isGone(200), true)
})

test('막히거나 흔들린 응답은 판정하지 않는다', () => {
  // 429·500 을 없어진 것으로 보면 살아있는 가게가 사라진다.
  for (const status of [429, 500, 502, 403]) assert.equal(isGone(status), null, String(status))
})

test('아예 못 물었으면 판정하지 않는다', () => {
  // 연결이 끊기면 답이 없다. 없어진 것과는 다르다.
  assert.equal(isGone(null), null)
})

test('네이버 장소만 확인할 수 있다', () => {
  assert.equal(checkable('1209575927'), true)
  // 구글맵을 붙인 글은 구글 ID 라 네이버에 물어봐야 늘 없다고 나온다.
  assert.equal(checkable('ChIJcfcwKaKLGGARZ2Ptk7fUo_c'), false)
  assert.equal(checkable('0x357ca3b7e1b0b8f5:0x1'), false)
  assert.equal(checkable(null), false)
})

test('업종을 모르는 범용 주소로 묻는다', () => {
  // 업종 경로(restaurant·cafe)로 물으면 없는 가게도 페이지를 준다. 범용 주소만 넘김으로 답한다.
  assert.equal(checkUrl('1209575927'), 'https://m.place.naver.com/place/1209575927/home')
})
