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
]

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
