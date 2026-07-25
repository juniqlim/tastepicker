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
]

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
