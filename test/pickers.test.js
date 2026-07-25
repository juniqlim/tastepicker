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

const pickerOf = (id) => PICKERS.find((picker) => picker.id === id)

test('미식탐정 - 가게명과 지역과 한줄평을 나눈다', () => {
  const pick = pickerOf('tastesherlok').read({
    title: '3451번째 식당 / 대방양곱창구이 / 둔촌: 탁월한 곱창을 넘어서는 친절한 대접',
  })

  assert.deepEqual(pick, {
    region: '둔촌',
    name: '대방양곱창구이',
    note: '탁월한 곱창을 넘어서는 친절한 대접',
    rating: null,
    level: null,
    levelBy: null,
  })
})

test('미식탐정 - 식당 순번이 없는 글은 거른다', () => {
  const read = pickerOf('tastesherlok').read

  assert.equal(read({ title: '서울 이모저모 식당 - 7월 2주차' }), null)
  assert.equal(read({ title: '2026년 막국수 완전 정복 (총 30곳 식당)' }), null)
})

test('맛짱 - 대괄호 안은 지역 다음 가게명이다', () => {
  const pick = pickerOf('symin67').read({
    title: '[종암동/스담] 디너 오마카세 가격이 33,000원의 최저가인데도 훌륭한 고려대역 스시야 맛집',
  })

  assert.equal(pick.region, '종암동')
  assert.equal(pick.name, '스담')
  assert.equal(pick.note, '디너 오마카세 가격이 33,000원의 최저가인데도 훌륭한 고려대역 스시야 맛집')
})

test('맛짱 - 대괄호 없는 글은 거른다', () => {
  const pick = pickerOf('symin67').read({
    title: '한우 전문점이 제주돈 생갈비까지 잘하면 반칙이죠. 여기는 등촌동 가양역 맛집 월정떼루아입니다.',
  })

  assert.equal(pick, null)
})

test('오먹산 - 대괄호 안은 가게명 다음 지역이다', () => {
  const pick = pickerOf('melburne').read({
    title: '[효제루/종로5가] - 밸런스가 좋은 짬뽕 한그릇! 마무리 밥까지 말아서 완뽕',
  })

  assert.equal(pick.name, '효제루')
  assert.equal(pick.region, '종로5가')
  assert.equal(pick.note, '밸런스가 좋은 짬뽕 한그릇! 마무리 밥까지 말아서 완뽕')
})

test('오먹산 - 하이픈 뒤 공백이 없어도 읽는다', () => {
  const pick = pickerOf('melburne').read({
    title: '[바다회향기/노량진 컵밥거리] -원조의 깊이는 쉽게 흉내 낼 수 없습니다',
  })

  assert.equal(pick.name, '바다회향기')
  assert.equal(pick.note, '원조의 깊이는 쉽게 흉내 낼 수 없습니다')
})

test('오먹산 - 한줄평이 없는 묶음 글은 거른다', () => {
  const read = pickerOf('melburne').read

  assert.equal(read({ title: '[향원·띠디·대박각/경기도] 짜장으로 소문난 3대 맛집 탐방기' }), null)
  assert.equal(read({ title: '[2025 마이 블로그 리포트] 데이터로 채워보는 내 블로그 취향 리포트' }), null)
})

test('공대이끼 - 대괄호 안은 지역, 하이픈 뒤가 가게명이다', () => {
  const pick = pickerOf('ikky21').read({
    title: '[신림] 매력넘치는 난축맛돈 족구이 - 머시기쪽갈비 신림점',
  })

  assert.equal(pick.region, '신림')
  assert.equal(pick.name, '머시기쪽갈비 신림점')
  assert.equal(pick.note, '매력넘치는 난축맛돈 족구이')
})

test('공대이끼 - 지역에 붙은 맛집은 뗀다', () => {
  const region = (title) => pickerOf('ikky21').read({ title }).region

  assert.equal(region('[강원도 양양 맛집] 섭부침개, 섭국 전문점 - 해촌'), '강원도 양양')
  assert.equal(region('[영등포 술집] 술맛나는 분위기 - 오박사냉면'), '영등포')
})

test('공대이끼 - 하이픈 뒤 공백이 없어도 읽는다', () => {
  const pick = pickerOf('ikky21').read({
    title: '[성북동] 입구에서 돌아서야 했던 곳 -스시 오오시마',
  })

  assert.equal(pick.name, '스시 오오시마')
})

test('공대이끼 - 가게명 없는 집밥·나들이 글은 거른다', () => {
  const read = pickerOf('ikky21').read

  assert.equal(read({ title: '[홈파티] 수비드 아롱사태, 화이트 라구 파스타, 닭발' }), null)
  assert.equal(read({ title: '비프웰링턴 만들어 홈파티하기' }), null)
})

test('비밀이야 - 대괄호 안이 가게명이고 다음이 지역이다', () => {
  const pick = pickerOf('mardukas').read({
    title: '[원대구탕] 삼각지 - 추억 속의 푸짐한 대구탕',
  })

  assert.equal(pick.name, '원대구탕')
  assert.equal(pick.region, '삼각지')
  assert.equal(pick.note, '추억 속의 푸짐한 대구탕')
})

test('비밀이야 - 여행 글은 대괄호가 가게명이 아니라 거른다', () => {
  const read = pickerOf('mardukas').read

  assert.equal(read({ title: '[2025 나고야] 기후현 미즈나미 - 사냥, 채집 요리의 정석, 야나기야' }), null)
  assert.equal(read({ title: '[주옥 Joo. Ok] 안녕이라고 말하지마~!' }), null)
  assert.equal(read({ title: '서울푸드 Seoul Food 2026 참가 (킨텍스)' }), null)
})

test('비밀이야 - 별은 미쉐린 별이라 등급으로 옮기지 않는다', () => {
  const pick = pickerOf('mardukas').read({
    title: '[솔밤 Solbam] 논현동 - 여전히 핫플, 앞으로도 계속될 이유! (★)',
  })

  assert.equal(pick.note, '여전히 핫플, 앞으로도 계속될 이유! (★)')
  assert.equal(pick.rating, null)
  assert.equal(pick.level, null)
})

test('홍아 - 맛집 카테고리가 아니면 거른다', () => {
  const read = pickerOf('dkfl279').read

  assert.equal(read({ title: "연태 마사지추천 '산리와SPA' 고급마사지샵", categoryNo: '34' }), null)
  assert.equal(read({ title: "압구정로데오 네일 '내일디디' 여름 시럽젤", categoryNo: '25' }), null)
  assert.ok(read({ title: "서울 신당맛집 '쿄오모라멘' 파이탄라멘", categoryNo: '10' }))
})

test('홍아 - 따옴표 안이 가게명이다', () => {
  const pick = pickerOf('dkfl279').read({
    title: "망포 야장고깃집 '우백탄 반월점' 마늘양념 소갈빗살 맛집",
    categoryNo: '10',
  })

  assert.equal(pick.region, '망포')
  assert.equal(pick.name, '우백탄 반월점')
  assert.equal(pick.note, '마늘양념 소갈빗살 맛집')
})

test('홍아 - 대괄호가 있으면 그 안이 지역이다', () => {
  const region = (title) => pickerOf('dkfl279').read({ title, categoryNo: '10' }).region

  assert.equal(region("[용인] '고기가맛있는집' 김량장동 삼겹살"), '용인')
  assert.equal(region('[제주] :: 갓포효 :: 제주이자카야'), '제주')
  assert.equal(region('안양일번가맛집 :: 통큰흑염소 :: 흑염소탕'), '안양일번가')
})

test('홍아 - 가게명과 한줄평 사이 구분자는 여러 가지다', () => {
  const name = (title) => pickerOf('dkfl279').read({ title, categoryNo: '10' }).name

  assert.equal(name('[제주] :: 함덕고갈치 :: 통갈치조림'), '함덕고갈치')
  assert.equal(name('[파주] 신간짬뽕 본점 :: 파주 간짬뽕 맛집'), '신간짬뽕 본점')
  assert.equal(name('[산본] 우정식당 : 동태찌개 찐맛집'), '우정식당')
  assert.equal(name('[군포] 어죽이네 철렵국 군포점 - 어죽과 도리뱅뱅'), '어죽이네 철렵국 군포점')
})

test('홍아 - 떡동여지도는 순번을 떼고 읽는다', () => {
  const pick = pickerOf('dkfl279').read({
    title: "떡동여지도 200. 배곧 떡볶이 '금메달떡볶이' 시흥 배곧 학교 앞 분식집",
    categoryNo: '10',
  })

  assert.equal(pick.region, '배곧')
  assert.equal(pick.name, '금메달떡볶이')
})

test('홍아 - 옛 떡동여지도는 괄호 안이 지역이다', () => {
  const pick = pickerOf('dkfl279').read({
    title: '떡동여지도 45. 진미떡볶이 (용인 죽전) 해물즉석떡볶이',
    categoryNo: '10',
  })

  assert.equal(pick.region, '용인 죽전')
  assert.equal(pick.name, '진미떡볶이')
  assert.equal(pick.note, '해물즉석떡볶이')
})

test('홍아 - 가게를 집을 수 없는 협찬·묶음 글은 거른다', () => {
  const read = (title) => pickerOf('dkfl279').read({ title, categoryNo: '10' })

  assert.equal(read('알베기 간장게장 택배추천, 순우리 간장게장 2.5kg (feat.늘푸른우리)'), null)
  assert.equal(read('성남 재래시장 모란 오일장 먹을거리 추천 맛집 주차하는 곳'), null)
  assert.equal(read('떡동여지도 3탄 : 떡볶이 맛집 모음 , 떡볶러의 떡지순례'), null)
  assert.equal(read(':: 샤샤몰 마라탕 :: 집에서 간편하게 마라탕만들기레시피'), null)
  assert.equal(read('[부산 맛집 모음] : 먹기만 하고온 식도락여행 , 찐맛집만 모은 부산 맛집리스트'), null)
})

test('새 픽커들은 등급을 안 매기니 비워둔다', () => {
  const 픽 = [
    pickerOf('tastesherlok').read({ title: '1번째 식당 / 집 / 안양: 좋다' }),
    pickerOf('symin67').read({ title: '[안양/집] 좋다' }),
    pickerOf('melburne').read({ title: '[집/안양] - 좋다' }),
    pickerOf('ikky21').read({ title: '[안양] 좋다 - 집' }),
    pickerOf('mardukas').read({ title: '[집] 안양 - 좋다' }),
    pickerOf('dkfl279').read({ title: "안양 '집' 좋다", categoryNo: '10' }),
  ]

  for (const pick of 픽) {
    assert.equal(pick.level, null)
    assert.equal(pick.levelBy, null)
  }
})
