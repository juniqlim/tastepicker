/**
 * 픽커마다 평가하는 말이 다르다. 그 말은 그대로 두고,
 * 픽커끼리 견주려고 상·중·하 하나로 옮긴다.
 * 어떻게 옮겼는지도 남긴다. 픽커가 매긴 등급과 우리가 추측한 값은 무게가 다르다.
 */
export const LEVELS = {
  강추: 5, 추천: 4,
  괜춘: 3, 쏘쏘: 3, 보통: 3, 평범: 3, 무난: 3,
  그닥: 2, 별로: 1,
}

/** 5점 자의 이름. 화면에 쓴다. */
export const LEVEL_NAMES = { 5: '강추', 4: '추천', 3: '보통', 2: '그닥', 1: '비추' }

/** RockHer가 쓰는 등급. 나쁜 평가도 픽커의 판단이라 함께 받는다. */
const GRADES = Object.keys(LEVELS)

/**
 * 픽커는 내가 검증해서 직접 등록한 사람만 들어온다.
 * 서비스가 자동으로 추가하지 않는다.
 *
 * 픽커마다 제목 형식이 달라서 규칙도 픽커마다 하나씩 둔다.
 * 소수만 다루므로 범용 파서보다 이쪽이 정확하다.
 */
export const PICKERS = [
  {
    id: 'juniqlim',
    name: 'juniqlim',
    // 블로그가 없다. 긁어올 글이 없고 내 평가는 Supabase 에 직접 적는다.
  },
  {
    id: 'thddbcjf',
    name: '정직한 청년',
    url: 'https://blog.naver.com/thddbcjf',
    // '안양 호계동 장수옥-장수옥은 뽀얀 걸로'
    // 한줄평에 호평과 혹평이 섞여 있어 등급을 매기지 않고 그대로 보여준다.
    read({ title, category = '' }) {
      if (category.includes('일상') || category.includes('챌린지')) return null

      const found = title.match(/^(.+?)\s*[-–]\s*(.+)$/)
      if (!found) return null

      const [region, name] = splitRegion(found[1].trim())
      return { region, name, note: found[2].trim(), rating: null, level: null, levelBy: null }
    },
  },
  {
    id: 'fascinoya',
    name: 'RockHer',
    url: 'https://blog.naver.com/fascinoya',
    // '[부산 맛집] 하가원 (추천) - 해운대 장산 콩국수 메뉴 점심 웨이팅 등'
    // 본인이 등급을 붙인 글만 받는다. 안 붙인 글은 추천으로 볼 근거가 없다.
    // 한 글에 여러 가게를 쓰기도 해서 첫 등급 앞까지를 가게명으로 본다.
    read({ title }) {
      const found = title.match(
        new RegExp(`^\\[(\\S+)\\s*(?:맛집|카페)\\]\\s*(.+?)\\s*\\((${GRADES.join('|')})\\)\\s*[-–]?\\s*(.*)$`),
      )
      if (!found) return null

      const [, region, name, rating, note] = found
      return { region, name, note: note.trim(), rating, level: LEVELS[rating], levelBy: '픽커' }
    },
  },
  {
    id: 'tastesherlok',
    name: '미식탐정',
    url: 'https://blog.naver.com/tastesherlok',
    // '3451번째 식당 / 대방양곱창구이 / 둔촌: 탁월한 곱창을 넘어서는 친절한 대접'
    // 식당마다 순번을 매긴다. 순번이 없으면 한 집을 다룬 글이 아니다.
    read({ title }) {
      const found = title.match(/^\d+번째 식당\s*\/\s*(.+?)\s*\/\s*(.+?)\s*:\s*(.+)$/)
      if (!found) return null

      const [, name, region, note] = found
      return { region, name, note, rating: null, level: null, levelBy: null }
    },
  },
  {
    id: 'symin67',
    name: '맛짱',
    url: 'https://blog.naver.com/symin67',
    // '[종암동/스담] 디너 오마카세 가격이 33,000원의 최저가인데도 훌륭한 고려대역 스시야 맛집'
    read({ title }) {
      const found = title.match(/^\[([^/\]]+)\/([^\]]+)\]\s*(.+)$/)
      if (!found) return null

      const [, region, name, note] = found
      return { region, name, note, rating: null, level: null, levelBy: null }
    },
  },
  {
    id: 'melburne',
    name: '오먹산',
    url: 'https://blog.naver.com/melburne',
    // '[효제루/종로5가] - 밸런스가 좋은 짬뽕 한그릇! 마무리 밥까지 말아서 완뽕'
    // 맛짱과 대괄호 안 순서가 반대다. 이쪽은 가게명이 먼저다.
    // 하이픈 뒤가 한줄평이라 하이픈이 없으면 여러 집을 묶은 글로 본다.
    read({ title }) {
      const found = title.match(/^\[([^/\]]+)\/([^\]]+)\]\s*[-–]\s*(.+)$/)
      if (!found) return null

      const [, name, region, note] = found
      return { region, name, note, rating: null, level: null, levelBy: null }
    },
  },
  {
    id: 'ikky21',
    name: '공대이끼',
    url: 'https://blog.naver.com/ikky21',
    // '[안양중앙시장] 순댓국은 기본, 소머리국밥까지 - 83순대국'
    // 오먹산과 반대로 하이픈 뒤가 가게명이다. 지역만 대괄호에 넣는다.
    // 하이픈이 없으면 집밥이나 시장 나들이 글이라 가게명을 집을 수 없다.
    read({ title }) {
      const found = title.match(/^\[([^\]]+)\]\s*(.+?)\s*[-–]\s*(.+)$/)
      if (!found) return null

      const [, region, note, name] = found
      return {
        region: region.replace(/\s*(맛집|술집|카페)$/, ''),
        name, note, rating: null, level: null, levelBy: null,
      }
    },
  },
  {
    id: 'mardukas',
    name: '비밀이야',
    url: 'https://blog.naver.com/mardukas',
    // '[원대구탕] 삼각지 - 추억 속의 푸짐한 대구탕'
    // 대괄호 안이 가게명이고 그 다음이 지역이다.
    // 여행 글은 '[2025 나고야]' 처럼 연도로 열고 가게명을 한줄평 끝에 둔다. 규칙이 달라 받지 않는다.
    // 한줄평의 별은 미쉐린 별이라 픽커가 매긴 등급이 아니다. 옮기지 않고 그대로 둔다.
    read({ title }) {
      if (/^\[(19|20)\d\d\s/.test(title)) return null

      const found = title.match(/^\[([^\]]+)\]\s*(.+?)\s*[-–]\s*(.+)$/)
      if (!found) return null

      const [, name, region, note] = found
      return { region, name, note, rating: null, level: null, levelBy: null }
    },
  },
  {
    id: 'dkfl279',
    name: '홍아',
    url: 'https://blog.naver.com/dkfl279',
    // "망포 야장고깃집 '우백탄 반월점' 마늘양념 소갈빗살 맛집"
    // 이 픽커만 카테고리를 본다. 제목에 형식이 없어 제목만으로는 맛집 글을 가려낼 수 없다.
    // 여행·제품리뷰·웨딩을 함께 쓰는데, 맛집은 카테고리 10 하나에 모여 있다.
    // 제목 형식은 시기마다 달라 넷을 차례로 본다. 어느 규칙에도 안 맞으면 협찬·묶음 글이라 버린다.
    read({ title, categoryNo }) {
      if (categoryNo !== EAT) return null

      // '떡동여지도 200.' 은 떡볶이집 순번이다. 떼고 나머지를 규칙에 맡긴다.
      const head = title.replace(SERIES, '')
      // '[부산 맛집 모음] : 먹기만 하고온 식도락여행' 처럼 대괄호 뒤가 바로 설명인 묶음 글이 있다.
      const pick = (region, name, note) => name.trim() ? {
        region: region.replace(TAIL, ''), name, note,
        rating: null, level: null, levelBy: null,
      } : null

      // '[제주] :: 함덕고갈치 :: 통갈치조림', '[산본] 우정식당 : 동태찌개 찐맛집'
      let found = head.match(/^\[([^\]]+)\]\s*(?:::)?\s*(.+?)\s*(?:::|:|[-–])\s*(.+)$/)
      if (found) return pick(found[1], found[2], found[3])

      // '안양일번가맛집 :: 통큰흑염소 :: 흑염소탕'. 지역을 대괄호 없이 적은 시기가 있다.
      found = head.match(/^([^:[]{1,15}?)\s*::\s*([^:]+?)\s*::\s*(.+)$/)
      if (found) return pick(found[1], found[2], found[3])

      // '떡동여지도 45. 진미떡볶이 (용인 죽전) 해물즉석떡볶이'. 순번 글에서만 괄호가 지역이다.
      found = head.match(/^([^()]+?)\s*\(([^()]{1,15})\)\s*(.+)$/)
      if (found && SERIES.test(title)) return pick(found[2], found[1], found[3])

      // "여주 맵친자 매운짬뽕 '유가장' 2단계 도전". 가게명만 따옴표로 감싼다.
      found = head.match(/^(.*?)['‘]([^'’]{1,30})['’]\s*(.*)$/)
      if (found) return pick(regionOf(found[1]), found[2], found[3])

      return null
    },
  },
  {
    id: 'phjsunflower',
    name: '꽃씨',
    url: 'https://blog.naver.com/phjsunflower',
    // '남양주 새암분식 / 더글로리 촬영지 라볶이 순대'
    // 홍아와 같이 제목에 형식이 없다. 맛집 글은 카테고리 하나에 모여 있어 그것으로 좁힌다.
    //
    // 빗금으로 가게와 한줄평을 가른 글이 셋에 둘이다. 그런데 시기마다 앞뒤가 뒤집힌다.
    // 옛 글은 '지역 종류 / 한줄평 가게명', 요즘 글은 '지역 가게명 / 한줄평' 이다.
    // 빗금 앞이 종류나 음식 이름으로 끝나면 거기엔 가게명이 없다는 뜻이라, 그것으로 가른다.
    //
    // 빗금이 없으면 종류 다음이 가게명이다. 종류가 없으면 가게명을 집을 수 없어 버린다.
    read({ title, categoryNo }) {
      if (categoryNo !== EATS) return null
      // 대괄호로 연 옛 글과 편의점·봉지면 같은 제품 글은 갈 가게가 없다.
      if (title.startsWith('[') || GOODS.test(title)) return null

      const parts = title.split('/').map((part) => part.trim()).filter(Boolean)
      if (parts.length > 2) return null

      const [front, note] = parts
      const words = front.split(/\s+/)
      if (MENU.has(words.at(-1))) return null

      if (parts.length === 1) return beyondKind(words)
      if (!KINDS.has(words.at(-1))) {
        const [name, region] = splitShop(words)
        return region ? shop(region.replace(TAIL, ''), name, note) : null
      }

      // 빗금 뒤는 '한줄평 가게명' 이다. 가게명만 있으면 어느 쪽인지 알 수 없어 버린다.
      const rest = note.split(/\s+/)
      if (rest.length < 2) return null

      const [name, said] = splitShop(rest)
      return KINDS.has(name) ? null : shop(words.slice(0, -1).join(' '), name, said)
    },
  },
]

/** 꽃씨의 맛집 카테고리. 호텔·반려견·제품 글은 다른 번호에 있다. */
const EATS = '33'

/** 가게가 아니라 메뉴나 물건을 다룬 글. 갈 곳이 없다. */
const GOODS = /(편의점|봉지면|밀키트|택배|레시피|신상|공구)/

/**
 * 가게 종류와 음식 이름. 제목의 이 낱말은 가게명이 아니다.
 * 꽃씨는 가게명을 앞에 두기도 뒤에 두기도 해서, 이 낱말이 그 자리를 가른다.
 */
const KINDS = new Set([
  '맛집', '카페', '술집', '밥집', '고기집', '분식', '분식집', '빵집', '베이커리', '디저트',
  '중국집', '횟집', '이자카야', '포차', '주점', '식당', '기사식당', '전문점', '치킨집',
  '국밥집', '먹거리', '간식', '야식', '점심', '저녁', '브런치', '회식장소', '한정식', '뷔페',
  '위스키바', '와인바', '호프', '바', '도시락', '배달', '포장',
  '떡볶이', '치킨', '만두', '칼국수', '김밥', '돈까스', '김치찌개', '순대국', '돼지국밥',
  '국수', '막국수', '갈비', '떡갈비', '곱창', '소곱창', '밀면', '케이크', '초밥', '팥빙수',
  '족발', '두부', '닭강정', '냉면', '평양냉면', '콩국수', '두루치기', '짬뽕', '삼겹살',
  '우동', '라면', '피자', '수제비', '보쌈', '빙수', '커피', '도넛', '호떡',
])

/** 가게가 아니라 차림표를 훑은 글. '이삭토스트 메뉴 / 모짜올리구마 햄치즈토스트' */
const MENU = new Set(['메뉴', '신메뉴', '메뉴추천', '후기', '리뷰', '모음', '할인'])

/** 가게명 앞에 끼워 넣는 꾸밈말. 건너뛰고 그 뒤를 가게명으로 본다. */
const FLUFF = new Set(['추천', '핫플', '노포', '원조', '유명', '베스트'])

/** '본점', '2호점', '강남점'. 가게명에 붙인다. */
const BRANCH = /^(본점|본관|\d+호점|.+점)$/

const shop = (region, name, note) => ({
  region, name, note, rating: null, level: null, levelBy: null,
})

/**
 * 낱말 뒤에서 가게명을 떼어낸다. 지점명은 가게명에 붙는다.
 * '웨스트진 베이커리 본점' 처럼 종류가 상호에 든 집이 있어, 지점명 앞이 종류면 하나 더 받는다.
 * 앞이 꾸밈말이면 지점명까지가 상호다. '노포 송림반점'
 */
function splitShop(words) {
  const before = words.at(-2)
  const size = words.length >= 2 && BRANCH.test(words.at(-1))
    ? (KINDS.has(before) ? 3 : FLUFF.has(before) ? 1 : 2)
    : 1

  return [words.slice(-size).join(' '), words.slice(0, -size).join(' ')]
}

/** 빗금이 없는 글. 종류가 지역과 가게명을 가른다. '안산 고잔동 맛집 제주화로집 참숯화로' */
function beyondKind(words) {
  const at = words.findIndex((word) => KINDS.has(word))
  if (at < 1) return null

  // 종류와 꾸밈말이 이어 붙기도 한다. '아현 디저트 카페 푸링', '청량리 밥집 추천 왕엄마돈가스김밥'
  let head = at + 1
  while (KINDS.has(words[head]) || FLUFF.has(words[head])) head++
  if (head >= words.length - 1) return null

  // '행신 웨스트진 베이커리 본점 엘리게이터 파이' — 지점명이 먼저 오면 상호가 종류를 안고 앞에 있다.
  if (BRANCH.test(words[head])) {
    return shop(
      words.slice(0, at - 1).join(' '),
      words.slice(at - 1, head + 1).join(' '),
      words.slice(head + 1).join(' '),
    )
  }

  const size = BRANCH.test(words[head + 1] ?? '') ? 2 : 1
  return shop(
    words.slice(0, at).join(' ').replace(TAIL, ''),
    words.slice(head, head + size).join(' '),
    words.slice(head + size).join(' '),
  )
}

/** 홍아의 맛집 카테고리. 하위 카테고리(떡동여지도)까지 부모 번호가 같다. */
const EAT = '10'

/** '떡동여지도 200.' 처럼 떡볶이집에 붙는 순번. */
const SERIES = /^떡동여지도\s*\d+(?:탄)?\s*[.:]?\s*/

/** 지역 뒤에 붙는 말. '안양일번가맛집' 과 '안양일번가' 가 따로 세지 않게 뗀다. */
const TAIL = /\s*(맛집|술집|카페|분식|떡볶이|식당)$/

/** 가게명 앞에 남은 말에서 지역을 집는다. 대괄호가 있으면 그 안이, 없으면 첫 낱말이 지역이다. */
function regionOf(head) {
  const bracket = head.match(/^\[([^\]]+)\]/)
  return bracket ? bracket[1] : head.trim().split(/\s+/)[0]
}

/** '마포 을밀대 본점' 처럼 지점명이 붙은 경우 가게명 쪽에 남긴다. */
function splitRegion(head) {
  const words = head.split(/\s+/)
  const size = /(^본점$|점$)/.test(words.at(-1)) ? 2 : 1
  return [words.slice(0, -size).join(' '), words.slice(-size).join(' ')]
}

/** 글 목록에서 픽을 뽑는다. 원문 본문은 옮기지 않고 출처만 남긴다. */
export function collect(picker, posts) {
  return posts.flatMap((post) => {
    const pick = picker.read(post)
    return pick ? { picker: picker.id, ...pick, link: post.link } : []
  })
}
