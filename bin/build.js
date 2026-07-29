import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS, collect } from '../src/pickers.js'
import { fetchAllPosts, fetchPost } from '../src/naver.js'
import {
  parsePlace, googleMapUrl, coordsFromGoogle, naverMapMid, coordsFromMashup,
} from '../src/place.js'
import { isSponsored } from '../src/sponsor.js'
import { askPlace, isGone } from '../src/closed.js'
import {
  openDb, savePick, placeOf, dropOthers, digest, saveClosed, placesToCheck,
} from '../src/db.js'

const data = join(import.meta.dirname, '../data')
const show = (text) => process.stdout.write(`\r\x1b[K${text}`)

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
 * 이백 몇 십 곳을 물으면 막힌다(429). 십 분쯤 쉬면 다시 통한다.
 * 그래서 두 번까지 쉬었다 잇고, 세 번째 막히면 오늘 몫은 거기서 끝낸다.
 * 남은 곳은 내일 이어서 묻는다. 가게가 문을 닫는 건 하루 이틀 다투는 일이 아니다.
 *
 * 픽커를 지정해 돌릴 때는 건너뛴다. 픽커 하나 붙이려고 장소를 다 물을 이유가 없다.
 */
// 세 번째 막힘이 늘 700대에서 온다. 1,200 은 닿을 수 없는 수라 적어봐야 거짓말이 된다.
const DAY = 800
const REST = 600_000
const RESTS = 2
// 잇달아 이만큼 막히면 회복될 때까지 쉰다. 계속 두드리면 회복보다 빨리 쓴다.
const GIVE_UP = 20

if (only.length === 0) {
  const today = new Date().toISOString().slice(0, 10)
  const places = placesToCheck(db, DAY)
  let gone = 0
  let missed = 0
  let blocked = 0
  let rested = 0

  for (const [index, placeId] of places.entries()) {
    // 하나씩 차례로 묻는다. 한꺼번에 부르면 열에 여덟이 막힌다(429).
    const closed = isGone(await askPlace(placeId))

    // 막히거나 흔들린 답은 담지 않는다. 다음에 다시 묻는다.
    if (closed === null) {
      missed++
      if (++blocked < GIVE_UP) continue
      if (rested++ === RESTS) {
        show(`  ${index + 1}번째에서 막혔다. 오늘은 여기까지 한다\n`)
        break
      }

      show(`  ${index + 1}번째에서 막혔다. 10분 쉰다\n`)
      await new Promise((done) => setTimeout(done, REST))
      blocked = 0
      continue
    }

    blocked = 0
    saveClosed(db, placeId, closed, today)
    if (closed) gone++

    show(`  장소 ${index + 1}/${places.length}  없어진 곳 ${gone}`)
  }

  show(`  없어진 곳 ${gone}곳, 못 물은 곳 ${missed}곳\n`)
}

const { count, located } = db
  .prepare('SELECT COUNT(*) AS count, COUNT(lat) AS located FROM pick')
  .get()
const { closed } = db.prepare('SELECT COUNT(*) AS closed FROM place WHERE closed = 1').get()
console.log(`\nDB에 픽 ${count}개, 좌표 ${located}개, 없어진 가게 ${closed}곳`)

// 매일 돌리므로 새 글이 있을 때만 남기려고 지문을 곁에 둔다.
writeFileSync(join(data, 'picks.sha'), `${digest(db)}\n`)
