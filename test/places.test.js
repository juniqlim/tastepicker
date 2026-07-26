import { test } from 'node:test'
import assert from 'node:assert/strict'

import { openDb, savePick, saveClosed, closedPlaces, placesToCheck, digest } from '../src/db.js'

const 픽 = (placeId, link) => ({
  picker: 'thddbcjf',
  name: '억떡볶이',
  link,
  place: { placeId, name: '억떡볶이', lat: 37.38, lng: 126.95 },
})

test('없어진 가게를 담고 꺼낸다', () => {
  const db = openDb(':memory:')

  saveClosed(db, '111', true, '2026-07-25')
  saveClosed(db, '222', false, '2026-07-25')

  assert.deepEqual(closedPlaces(db), new Set(['111']))
})

test('다시 열면 없어진 표시를 거둔다', () => {
  const db = openDb(':memory:')

  saveClosed(db, '111', true, '2026-07-01')
  saveClosed(db, '111', false, '2026-07-25')

  assert.deepEqual(closedPlaces(db), new Set())
})

test('오래된 글의 가게부터 확인한다', () => {
  const db = openDb(':memory:')
  // 네이버 글 번호는 시간이 갈수록 커진다. 날짜를 따로 담지 않아 이걸로 나이를 본다.
  savePick(db, 픽('111', 'https://blog.naver.com/aaa/224000000000'))
  savePick(db, 픽('222', 'https://blog.naver.com/aaa/221000000000'))
  savePick(db, 픽('333', 'https://blog.naver.com/bbb/222000000000'))

  // 옛 글의 가게일수록 이미 없어졌을 확률이 높다. 열 배 차이가 난다.
  assert.deepEqual(placesToCheck(db, 10), ['222', '333', '111'])
})

test('같은 가게는 가장 오래된 글로 줄을 선다', () => {
  const db = openDb(':memory:')
  savePick(db, 픽('111', 'https://blog.naver.com/aaa/224000000000'))
  savePick(db, 픽('111', 'https://blog.naver.com/bbb/220000000000'))
  savePick(db, 픽('222', 'https://blog.naver.com/aaa/222000000000'))

  // 옛날에 한 번이라도 다녀간 집이면 그만큼 오래된 집이다.
  assert.deepEqual(placesToCheck(db, 10), ['111', '222'])
})

test('아직 안 본 가게부터 확인한다', () => {
  const db = openDb(':memory:')
  savePick(db, 픽('111', 'a'))
  savePick(db, 픽('222', 'b'))
  savePick(db, 픽('333', 'c'))
  saveClosed(db, '222', false, '2026-07-25')

  assert.deepEqual(placesToCheck(db, 10), ['111', '333', '222'])
})

test('다 봤으면 오래 안 본 가게부터 확인한다', () => {
  const db = openDb(':memory:')
  savePick(db, 픽('111', 'a'))
  savePick(db, 픽('222', 'b'))
  saveClosed(db, '111', false, '2026-07-25')
  saveClosed(db, '222', false, '2026-07-01')

  assert.deepEqual(placesToCheck(db, 10), ['222', '111'])
})

test('하루에 볼 만큼만 준다', () => {
  const db = openDb(':memory:')
  savePick(db, 픽('111', 'a'))
  savePick(db, 픽('222', 'b'))
  savePick(db, 픽('333', 'c'))

  assert.equal(placesToCheck(db, 2).length, 2)
})

test('가게가 없어지면 지문도 달라진다', () => {
  const db = openDb(':memory:')
  savePick(db, 픽('111', 'a'))
  const before = digest(db)

  saveClosed(db, '111', true, '2026-07-25')

  // 지문이 그대로면 새 글이 없는 날에는 배포가 일어나지 않아 지도가 옛 상태로 남는다.
  assert.notEqual(digest(db), before)
})

test('언제 물었는지는 지문을 바꾸지 않는다', () => {
  const db = openDb(':memory:')
  savePick(db, 픽('111', 'a'))
  saveClosed(db, '111', false, '2026-07-01')
  const before = digest(db)

  saveClosed(db, '111', false, '2026-07-25')

  // 매일 다시 물으므로 날짜까지 세면 아무것도 안 변한 날에도 배포가 일어난다.
  assert.equal(digest(db), before)
})

test('네이버 장소가 아닌 것은 묻지 않는다', () => {
  const db = openDb(':memory:')
  savePick(db, 픽('1209575927', 'a'))
  // 구글맵을 붙인 글. 네이버에 물어봐야 늘 없다고 나온다.
  savePick(db, 픽('ChIJcfcwKaKLGGARZ2Ptk7fUo_c', 'b'))
  // 구형 지도 위젯은 좌표만 준다.
  savePick(db, { ...픽(null, 'c'), place: { lat: 37.38, lng: 126.95 } })

  assert.deepEqual(placesToCheck(db, 10), ['1209575927'])
})
