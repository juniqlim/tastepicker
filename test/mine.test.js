import { test } from 'node:test'
import assert from 'node:assert/strict'

import { openDb, savePick } from '../src/db.js'
import { myPicks } from '../src/mine.js'

const 장작구이 = {
  picker: 'thddbcjf',
  region: '안양',
  name: '할아버지참나무장작구이',
  note: '맹목적 찬양',
  rating: null,
  level: null,
  levelBy: null,
  link: 'https://blog.naver.com/thddbcjf/224341052743',
  place: {
    placeId: '1813629847',
    name: '할아버지 참나무 장작구이',
    address: '경기도 안양시 만안구 양화로25번길 20-4 1층',
    lat: 37.4,
    lng: 126.92,
    tel: null,
  },
}

const dbWith장작구이 = () => {
  const db = openDb(':memory:')
  savePick(db, 장작구이)
  return db
}

test('가게를 place로 찾아 내 평가를 붙인다', () => {
  const picks = myPicks(dbWith장작구이(), [
    { placeId: '1813629847', visited: '2026-07-20', level: 5, note: '역시' },
  ])

  assert.deepEqual(picks, [
    {
      id: 'juniqlim:1813629847:2026-07-20',
      picker: 'juniqlim',
      region: '안양',
      name: '할아버지 참나무 장작구이',
      note: '역시',
      rating: '5',
      level: 5,
      levelBy: '픽커',
      visited: '2026-07-20',
      link: 'https://map.naver.com/p/entry/place/1813629847',
      place: 장작구이.place,
    },
  ])
})

test('다시 가면 방문마다 따로 남는다', () => {
  const picks = myPicks(dbWith장작구이(), [
    { placeId: '1813629847', visited: '2025-03-11', level: 3, note: '그냥 그랬다' },
    { placeId: '1813629847', visited: '2026-07-20', level: 5, note: '이번엔 좋았다' },
  ])

  assert.equal(picks.length, 2)
  assert.deepEqual(picks.map((pick) => pick.level), [3, 5])
})

test('아직 모르는 가게는 건너뛴다', () => {
  const picks = myPicks(dbWith장작구이(), [{ placeId: '999', visited: '2026-07-20', level: 5 }])

  assert.deepEqual(picks, [])
})

test('점수나 날짜를 안 적은 줄은 건너뛴다', () => {
  const db = dbWith장작구이()

  assert.deepEqual(myPicks(db, [{ placeId: '1813629847', visited: '2026-07-20', level: null }]), [])
  assert.deepEqual(myPicks(db, [{ placeId: '1813629847', level: 5 }]), [])
})
