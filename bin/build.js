import { join } from 'node:path'

import { PICKERS, collect } from '../src/pickers.js'
import { fetchAllPosts, fetchPost } from '../src/naver.js'
import { parsePlace } from '../src/place.js'
import { openDb, savePick, placeOf, dropOthers } from '../src/db.js'

const show = (text) => process.stdout.write(`\r\x1b[K${text}`)

const db = openDb(join(import.meta.dirname, '../data/picks.db'))

for (const picker of PICKERS) {
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
