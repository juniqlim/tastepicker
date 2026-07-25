import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS, collect } from '../src/pickers.js'
import { fetchAllPosts, fetchPost } from '../src/naver.js'
import {
  parsePlace, googleMapUrl, coordsFromGoogle, naverMapMid, coordsFromMashup,
} from '../src/place.js'
import { isSponsored } from '../src/sponsor.js'
import { checkUrl, isGone } from '../src/closed.js'
import {
  openDb, savePick, placeOf, dropOthers, digest, saveClosed, placesToCheck,
} from '../src/db.js'

const data = join(import.meta.dirname, '../data')
const show = (text) => process.stdout.write(`\r\x1b[K${text}`)

// 네이버 장소는 브라우저처럼 묻지 않으면 막는다(429). 이름만 대충 대서는 안 통한다.
const MOBILE = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' +
    ' (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

// 구글맵 단축 링크는 좌표가 없다. 펼쳐야 나온다. 리다이렉트 주소만 읽고 본문은 안 받는다.
async function expand(url) {
  const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } })
  return response.headers.get('location')
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  return response.text()
}

// 픽커가 붙인 장소를 읽는다. 네이버 장소 → 구글맵 → 구형 지도 위젯 순으로 본다.
async function placeIn(html) {
  const place = parsePlace(html)
  if (place) return place

  const gmap = googleMapUrl(html)
  if (gmap) return coordsFromGoogle(await expand(gmap))

  const mid = naverMapMid(html)
  return mid ? coordsFromMashup(await fetchText(mid)) : null
}

const db = openDb(join(data, 'picks.db'))

// 내 평가는 Supabase 에 있다. 여기서는 블로그 픽커만 훑는다.
// 픽커를 새로 붙일 때는 그 픽커만 돌린다. 남의 서버라 천천히 부르므로 전체를 다시 훑으면 오래 걸린다.
const only = process.argv.slice(2)
const targets = PICKERS.filter(
  (picker) => picker.read && (only.length === 0 || only.includes(picker.id)),
)

for (const picker of targets) {
  const posts = await fetchAllPosts(picker.id, (read, total) =>
    show(`${picker.name} 목록 ${read}/${total}`),
  )

  const picks = collect(picker, posts)
  show(`${picker.name} 글 ${posts.length}개 → 픽 ${picks.length}개\n`)

  let fetched = 0
  for (const [index, pick] of picks.entries()) {
    // 본문은 한 번만 받는다. 규칙을 고쳐 다시 돌려도 본문을 또 받지 않는다.
    // 장소와 대가 여부를 그 한 번에 함께 뽑는다.
    let place = placeOf(db, pick.link)
    let sponsored
    if (place === undefined) {
      const html = await fetchPost(pick.link)
      place = await placeIn(html)
      sponsored = isSponsored(html)
      fetched++
    }

    savePick(db, { ...pick, place, sponsored })
    show(`  ${index + 1}/${picks.length}  새로 받은 글 ${fetched}  ${pick.name}`)
  }

  dropOthers(db, picker.id, picks.map((pick) => pick.link))
  show(`  픽 ${picks.length}개, 새로 받은 글 ${fetched}개\n`)
}

/**
 * 문 닫은 가게를 가려낸다. 픽커의 글은 남지만 가게는 사라진다.
 *
 * 장소가 칠천 곳이라 다 물으면 40분이 걸린다. 하루 몫만 보고 엿새에 한 바퀴 돈다.
 * 가게가 문을 닫는 건 하루 이틀 다투는 일이 아니라 이 정도로 충분하다.
 *
 * 픽커를 지정해 돌릴 때는 건너뛴다. 픽커 하나 붙이려고 장소를 다 물을 이유가 없다.
 */
const DAY = 1200

if (only.length === 0) {
  const today = new Date().toISOString().slice(0, 10)
  const places = placesToCheck(db, DAY)
  let gone = 0
  let missed = 0

  for (const [index, placeId] of places.entries()) {
    // 남의 서버를 두드리는 일이라 천천히 부른다. 넘김만 보면 되니 본문은 받지 않는다.
    const response = await fetch(checkUrl(placeId), { method: 'HEAD', headers: MOBILE, redirect: 'manual' })
      .catch(() => null)

    const closed = response ? isGone(response.status) : null
    // 막히거나 흔들린 답은 담지 않는다. 다음에 다시 묻는다.
    if (closed === null) missed++
    else saveClosed(db, placeId, closed, today)
    if (closed) gone++

    show(`  장소 ${index + 1}/${places.length}  없어진 곳 ${gone}`)
    await new Promise((done) => setTimeout(done, 150))
  }

  show(`  장소 ${places.length}곳 확인, 없어진 곳 ${gone}곳, 못 물은 곳 ${missed}곳\n`)
}

const { count, located } = db
  .prepare('SELECT COUNT(*) AS count, COUNT(lat) AS located FROM pick')
  .get()
const { closed } = db.prepare('SELECT COUNT(*) AS closed FROM place WHERE closed = 1').get()
console.log(`\nDB에 픽 ${count}개, 좌표 ${located}개, 없어진 가게 ${closed}곳`)

// 매일 돌리므로 새 글이 있을 때만 남기려고 지문을 곁에 둔다.
writeFileSync(join(data, 'picks.sha'), `${digest(db)}\n`)
