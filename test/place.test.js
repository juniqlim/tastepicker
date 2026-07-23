import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parsePlace } from '../src/place.js'

const fixture = (name) =>
  readFileSync(join(import.meta.dirname, '../data/fixtures', `${name}.html`), 'utf-8')

test('픽커가 글에 붙인 장소를 읽는다', () => {
  const place = parsePlace(fixture('post-place'))

  assert.deepEqual(place, {
    placeId: '1209575927',
    name: '억떡볶이',
    address: '경기도 안양시 동안구 평촌대로 127 중앙상가 1층 억떡볶이',
    lat: 37.3833212,
    lng: 126.9595726,
    tel: '0507-1306-4057',
  })
})

test('장소를 안 붙인 글은 비운다', () => {
  assert.equal(parsePlace(fixture('post-nomap')), null)
})
