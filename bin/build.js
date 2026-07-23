import { join } from 'node:path'

import { PICKERS, collect } from '../src/pickers.js'
import { fetchAllPosts, fetchPost } from '../src/naver.js'
import { parsePlace } from '../src/place.js'
import { openDb, savePick, savedLinks } from '../src/db.js'

const show = (text) => process.stdout.write(`\r\x1b[K${text}`)

const db = openDb(join(import.meta.dirname, '../data/picks.db'))
const already = savedLinks(db)

for (const picker of PICKERS) {
  const posts = await fetchAllPosts(picker.id, (read, total) =>
    show(`${picker.name} 목록 ${read}/${total}`),
  )

  const picks = collect(picker, posts).filter((pick) => !already.has(pick.link))
  show(`${picker.name} 글 ${posts.length}개 중 새 픽 ${picks.length}개\n`)

  let located = 0
  for (const [index, pick] of picks.entries()) {
    const place = parsePlace(await fetchPost(pick.link))
    savePick(db, { ...pick, place })
    if (place) located++

    show(`  ${index + 1}/${picks.length}  좌표 ${located}  ${pick.name}`)
  }
  show(`  받은 픽 ${picks.length}개, 좌표 ${located}개\n`)
}

const { count, located } = db
  .prepare('SELECT COUNT(*) AS count, COUNT(lat) AS located FROM pick')
  .get()
console.log(`\nDB에 픽 ${count}개, 좌표 ${located}개`)
