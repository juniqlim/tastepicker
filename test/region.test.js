import { test } from 'node:test'
import assert from 'node:assert/strict'

import { regionOf } from '../src/region.js'

test('광역시는 시와 구로 나눈다', () => {
  assert.equal(regionOf('서울특별시 마포구 양화로 123'), '서울 마포구')
  assert.equal(regionOf('부산광역시 해운대구 우동 1'), '부산 해운대구')
})

test('도는 도와 시로 나눈다', () => {
  assert.equal(regionOf('경기도 안양시 동안구 평촌대로 127'), '경기 안양시')
  assert.equal(regionOf('충청북도 청주시 상당구 1'), '충북 청주시')
})

test('같은 곳을 다르게 적어도 하나로 모은다', () => {
  assert.equal(regionOf('강원도 속초시 중앙로 1'), regionOf('강원특별자치도 속초시 중앙로 1'))
  assert.equal(regionOf('전라북도 전주시 1'), regionOf('전북특별자치도 전주시 1'))
})

test('세종은 구가 없다', () => {
  assert.equal(regionOf('세종특별자치시 한누리대로 2130'), '세종')
})

test('해외 주소는 나라만 남긴다', () => {
  assert.equal(regionOf('일본 도쿄도 시부야구'), '해외')
  assert.equal(regionOf('1-chōme-2-2 Nishishinjuku'), '해외')
  assert.equal(regionOf('梅田地下街2-8'), '해외')
})

test('주소가 없으면 비운다', () => {
  assert.equal(regionOf(null), null)
  assert.equal(regionOf(''), null)
})
