import { test } from 'node:test'
import assert from 'node:assert/strict'

import { openDb, savePick, savedLinks, allPicks, placeOf, dropOthers } from '../src/db.js'

const 억떡볶이 = {
  picker: 'thddbcjf',
  region: '안양 평촌학원가',
  name: '억떡볶이',
  note: '추억은 현재진행듕',
  rating: null,
  level: null,
  levelBy: null,
  link: 'https://blog.naver.com/thddbcjf/224355010343',
  place: {
    placeId: '1209575927',
    name: '억떡볶이',
    address: '경기도 안양시 동안구 평촌대로 127',
    lat: 37.3833212,
    lng: 126.9595726,
    tel: '0507-1306-4057',
  },
}

test('픽을 넣고 그대로 꺼낸다', () => {
  const db = openDb(':memory:')

  savePick(db, 억떡볶이)

  assert.deepEqual(allPicks(db), [억떡볶이])
})

test('장소가 없는 픽도 넣는다', () => {
  const db = openDb(':memory:')

  savePick(db, { ...억떡볶이, place: null })

  assert.equal(allPicks(db)[0].place, null)
})

test('같은 글을 다시 넣으면 갱신한다', () => {
  const db = openDb(':memory:')

  savePick(db, 억떡볶이)
  savePick(db, { ...억떡볶이, note: '고친 한줄평' })

  assert.equal(allPicks(db).length, 1)
  assert.equal(allPicks(db)[0].note, '고친 한줄평')
})

test('이미 넣은 글을 알려준다', () => {
  const db = openDb(':memory:')

  savePick(db, 억떡볶이)

  assert.ok(savedLinks(db).has(억떡볶이.link))
  assert.ok(!savedLinks(db).has('https://blog.naver.com/thddbcjf/1'))
})

test('받아둔 장소를 꺼낸다', () => {
  const db = openDb(':memory:')

  savePick(db, 억떡볶이)

  assert.deepEqual(placeOf(db, 억떡볶이.link), 억떡볶이.place)
  assert.equal(placeOf(db, 'https://blog.naver.com/thddbcjf/1'), undefined)
})

test('규칙에서 빠진 글은 지운다', () => {
  const db = openDb(':memory:')
  const 옛픽 = { ...억떡볶이, link: 'https://blog.naver.com/thddbcjf/1' }
  const 남픽 = { ...억떡볶이, picker: 'fascinoya', link: 'https://blog.naver.com/fascinoya/1' }

  savePick(db, 억떡볶이)
  savePick(db, 옛픽)
  savePick(db, 남픽)
  dropOthers(db, 'thddbcjf', [억떡볶이.link])

  assert.deepEqual(
    allPicks(db).map((pick) => pick.link).sort(),
    [남픽.link, 억떡볶이.link].sort(),
  )
})
