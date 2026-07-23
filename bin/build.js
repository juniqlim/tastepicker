import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS, collect } from '../src/pickers.js'
import { fetchAllPosts, fetchPost } from '../src/naver.js'
import { parsePlace } from '../src/place.js'
import { myPicks } from '../src/mine.js'
import { openDb, savePick, placeOf, dropOthers, digest } from '../src/db.js'

const data = join(import.meta.dirname, '../data')
const show = (text) => process.stdout.write(`\r\x1b[K${text}`)

const db = openDb(join(data, 'picks.db'))

// 블로그 픽커를 먼저 훑는다. 내 평가는 그들이 다녀간 가게에 붙는다.
for (const picker of PICKERS.filter((picker) => picker.mine)) {
  const mine = JSON.parse(readFileSync(join(data, picker.mine), 'utf-8'))
  const picks = myPicks(db, mine)

  for (const pick of picks) savePick(db, pick)
  dropOthers(db, picker.id, picks.map((pick) => pick.link))
  console.log(`${picker.name} 평가 ${mine.length}줄 → 픽 ${picks.length}개`)
}

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
      place = parsePlace(await fetchPost(pick.link))
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
