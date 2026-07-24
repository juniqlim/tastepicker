import { test } from 'node:test'
import assert from 'node:assert/strict'

import { toSpots, byWeight, byVisits, byName } from '../src/spots.js'

const 픽 = (over) => ({
  picker: 'thddbcjf', name: '억떡볶이', note: '맛있다', rating: null, level: null,
  link: 'https://blog.naver.com/thddbcjf/1', visited: null,
  place: { placeId: '1', name: '억떡볶이', address: '서울특별시 마포구 1', lat: 37.5, lng: 127 },
  ...over,
})

test('같은 장소의 픽을 한 가게로 모은다', () => {
  const spots = toSpots([픽({}), 픽({ picker: 'fascinoya', link: 'https://blog.naver.com/fascinoya/1' })])

  assert.equal(spots.length, 1)
  assert.equal(spots[0].picks.length, 2)
})

test('장소 ID가 없으면 좌표로 묶는다', () => {
  const 좌표만 = (link) => 픽({ link, place: { placeId: null, name: null, address: null, lat: 37.5, lng: 127 } })
  const spots = toSpots([좌표만('a'), 좌표만('b')])

  assert.equal(spots.length, 1)
})

test('주소에서 지역을 붙인다', () => {
  assert.equal(toSpots([픽({})])[0].region, '서울 마포구')
})

test('주소가 없으면 지역도 비운다', () => {
  const spots = toSpots([픽({ place: { placeId: null, name: null, address: null, lat: 37.5, lng: 127 } })])

  assert.equal(spots[0].region, null)
})

test('가게 이름은 장소 상호로 쓰고, 없으면 픽커가 적은 이름으로 쓴다', () => {
  const 상호없음 = 픽({ place: { placeId: null, name: null, address: null, lat: 1, lng: 2 } })

  assert.equal(toSpots([픽({})])[0].name, '억떡볶이')
  assert.equal(toSpots([상호없음])[0].name, '억떡볶이')
})

const 방문 = (picker, link) => ({
  picker, name: '집', note: '', rating: null, level: null, link, visited: null,
  place: { placeId: link.slice(0, 1), name: '집', address: '서울특별시 마포구 1', lat: 1, lng: 2 },
})

test('픽커가 겹칠수록 먼저다', () => {
  const 셋 = toSpots([방문('a', '1'), 방문('b', '1x'), 방문('c', '1y')])[0]
  const 하나가여러번 = toSpots([방문('a', '2'), 방문('a', '2x'), 방문('a', '2y'), 방문('a', '2z')])[0]

  assert.deepEqual([하나가여러번, 셋].sort(byWeight), [셋, 하나가여러번])
})

test('같은 픽커 수면 많이 간 집이 먼저다', () => {
  const 두번 = toSpots([방문('a', '1'), 방문('b', '1x'), 방문('a', '1y')])[0]
  const 한번 = toSpots([방문('a', '2'), 방문('b', '2x')])[0]

  assert.deepEqual([한번, 두번].sort(byWeight), [두번, 한번])
})

test('방문이 많은 순으로도 세운다', () => {
  const 많이 = toSpots([방문('a', '1'), 방문('a', '1x'), 방문('a', '1y')])[0]
  const 적게 = toSpots([방문('a', '2'), 방문('b', '2x')])[0]

  assert.deepEqual([적게, 많이].sort(byVisits), [많이, 적게])
})

test('이름 순으로도 세운다', () => {
  const spots = [{ name: '나집' }, { name: '가집' }, { name: '다집' }]

  assert.deepEqual(spots.sort(byName).map((spot) => spot.name), ['가집', '나집', '다집'])
})
