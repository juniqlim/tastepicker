import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS, collect } from '../src/pickers.js'
import { fetchAllPosts, fetchPost } from '../src/naver.js'
import {
  parsePlace, googleMapUrl, coordsFromGoogle, naverMapMid, coordsFromMashup,
} from '../src/place.js'
import { openDb, savePick, placeOf, dropOthers, digest } from '../src/db.js'

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
for (const picker of PICKERS.filter((picker) => picker.read)) {
  const posts = await fetchAllPosts(picker.id, (read, total) =>
    show(`${picker.name} 목록 ${read}/${total}`),
  )

  const picks = collect(picker, posts)
  show(`${picker.name} 글 ${posts.length}개 → 픽 ${picks.length}개\n`)

  let fetched = 0
  for (const [index, pick] of picks.entries()) {
    // 장소는 한 번만 받는다. 규칙을 고쳐 다시 돌려도 본문을 또 받지 않는다.
    let place = placeOf(db, pick.link)
    if (place === undefined) {
      place = await placeIn(await fetchPost(pick.link))
      fetched++
    }

    savePick(db, { ...pick, place })
    show(`  ${index + 1}/${picks.length}  새로 받은 글 ${fetched}  ${pick.name}`)
  }

  dropOthers(db, picker.id, picks.map((pick) => pick.link))
  show(`  픽 ${picks.length}개, 새로 받은 글 ${fetched}개\n`)
}

const { count, located } = db
  .prepare('SELECT COUNT(*) AS count, COUNT(lat) AS located FROM pick')
  .get()
console.log(`\nDB에 픽 ${count}개, 좌표 ${located}개`)

// 매일 돌리므로 새 글이 있을 때만 남기려고 지문을 곁에 둔다.
writeFileSync(join(data, 'picks.sha'), `${digest(db)}\n`)
