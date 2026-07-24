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

import { googleMapUrl, coordsFromGoogle } from '../src/place.js'

test('구글맵을 붙인 글에서 단축 링크를 뽑는다', () => {
  const url = googleMapUrl(fixture('post-google'))

  assert.equal(url, 'https://maps.app.goo.gl/7psEb79WdyQYGzx39')
})

test('네이버 장소만 붙인 글엔 구글 링크가 없다', () => {
  assert.equal(googleMapUrl(fixture('post-place')), null)
})

test('펼친 구글맵 주소에서 장소 좌표를 읽는다', () => {
  const url =
    'https://www.google.co.kr/maps/place/Butcher+Yakiniku/@34.0741819,134.5512502,21z/' +
    'data=!4m6!3m5!1s0x35536d5bd5df1c11:0x5f8dde53f7f6e5cb!8m2!3d34.0741994!4d134.551541!16s%2Fg%2F11q8g6s1dm'

  assert.deepEqual(coordsFromGoogle(url), {
    placeId: '0x35536d5bd5df1c11:0x5f8dde53f7f6e5cb',
    name: 'Butcher Yakiniku',
    lat: 34.0741994,
    lng: 134.551541,
  })
})

test('좌표가 없는 주소는 비운다', () => {
  assert.equal(coordsFromGoogle('https://www.google.com/maps'), null)
})
