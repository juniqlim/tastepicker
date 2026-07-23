import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseRss } from '../src/rss.js'
import { PICKERS, collect } from '../src/pickers.js'

const picksOf = (id) => {
  const picker = PICKERS.find((p) => p.id === id)
  const xml = readFileSync(join(import.meta.dirname, '../data/fixtures', `${id}.xml`), 'utf-8')
  return collect(picker, parseRss(xml))
}

const byName = (picks, name) => picks.find((p) => p.name === name)

test('정직한 청년 - 지역과 가게명과 한줄평을 나눈다', () => {
  const pick = byName(picksOf('thddbcjf'), '억떡볶이')

  assert.deepEqual(pick, {
    picker: 'thddbcjf',
    region: '안양 평촌학원가',
    name: '억떡볶이',
    note: '추억은 현재진행듕',
    rating: null,
    level: null,
    levelBy: null,
    link: 'https://blog.naver.com/thddbcjf/224355010343',
  })
})

test('정직한 청년 - 지점명은 가게명에 붙인다', () => {
  const pick = byName(picksOf('thddbcjf'), '을밀대 본점')

  assert.equal(pick.region, '마포')
})

test('정직한 청년 - 일상 글은 거른다', () => {
  const picks = picksOf('thddbcjf')

  assert.equal(picks.length, 38)
  assert.ok(!picks.some((p) => p.name.includes('일상')))
})

test('RockHer - 지역과 가게명과 등급을 나눈다', () => {
  const pick = byName(picksOf('fascinoya'), '하가원')

  assert.deepEqual(pick, {
    picker: 'fascinoya',
    region: '부산',
    name: '하가원',
    note: '해운대 장산 콩국수 메뉴 점심 웨이팅 등',
    rating: '추천',
    level: 4,
    levelBy: '픽커',
    link: 'https://blog.naver.com/fascinoya/224354139472',
  })
})

test('모든 픽은 출처를 밝힌다', () => {
  const picks = [...picksOf('thddbcjf'), ...picksOf('fascinoya')]

  for (const pick of picks) {
    assert.ok(PICKERS.some((p) => p.id === pick.picker), `${pick.name}: 픽커 없음`)
    assert.match(pick.link, /^https:\/\/blog\.naver\.com\/\w+\/\d+$/, `${pick.name}: 원문 링크 없음`)
  }
})

test('RockHer - 강추와 추천을 구분한다', () => {
  const picks = picksOf('fascinoya')

  assert.equal(byName(picks, '롱메').rating, '강추')
  assert.equal(byName(picks, '부산애').rating, '추천')
})

const rockher = () => PICKERS.find((p) => p.id === 'fascinoya')

test('RockHer - 본인 등급을 5점 자로 옮긴다', () => {
  const level = (grade) => rockher().read({ title: `[안양 맛집] 집 (${grade})` }).level

  assert.deepEqual(
    ['강추', '추천', '괜춘', '쏘쏘', '보통', '그닥', '별로'].map(level),
    [5, 4, 3, 3, 3, 2, 1],
  )
})

test('RockHer - 등급을 옮긴 것임을 남긴다', () => {
  const pick = rockher().read({ title: '[안양 맛집] 집 (강추)' })

  assert.equal(pick.levelBy, '픽커')
})

test('정직한 청년 - 등급을 안 매기니 비워둔다', () => {
  const pick = PICKERS.find((p) => p.id === 'thddbcjf').read({ title: '안양 호계동 장수옥-뽀얀 걸로' })

  assert.equal(pick.rating, null)
  assert.equal(pick.level, null)
  assert.equal(pick.levelBy, null)
})

test('RockHer - 한 글에 여러 가게를 쓰면 첫 가게만 받는다', () => {
  const pick = rockher().read({
    title: '[삼각지 카페] 스쿠퍼젤라또 (괜춘) - 아포가토 / 에피하우스 (추천)',
  })

  assert.equal(pick.name, '스쿠퍼젤라또')
  assert.equal(pick.rating, '괜춘')
})

test('RockHer - 나쁜 평가도 받는다', () => {
  const pick = rockher().read({ title: '[홍대 맛집] 천지마라탕 (별로) - 히밥이 다녀간 집' })

  assert.equal(pick.name, '천지마라탕')
  assert.equal(pick.rating, '별로')
})

test('RockHer - 등급이 아닌 괄호는 이름에 남긴다', () => {
  const pick = rockher().read({ title: '[이태원 맛집] 난 (Naan) (강추) - 인도 커리' })

  assert.equal(pick.name, '난 (Naan)')
  assert.equal(pick.rating, '강추')
})

test('RockHer - 등급을 안 붙인 글은 거른다', () => {
  const picks = picksOf('fascinoya')

  assert.equal(picks.length, 17)
  assert.ok(!byName(picks, '시하온'))
})

test('RockHer - 와인 글은 거른다', () => {
  const picks = picksOf('fascinoya')

  assert.ok(!picks.some((p) => p.name.includes('샴페인')))
})
