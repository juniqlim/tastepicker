import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS, collect } from '../src/pickers.js'
import { fetchPosts, fetchPost } from '../src/naver.js'
import { parsePlace } from '../src/place.js'

const rest = () => new Promise((done) => setTimeout(done, 250))

const picks = []

for (const picker of PICKERS) {
  process.stdout.write(`${picker.name} `)

  for (const pick of collect(picker, await fetchPosts(picker.id))) {
    const place = parsePlace(await fetchPost(pick.link))
    picks.push({ ...pick, place })
    process.stdout.write(place ? '.' : '?')
    await rest()
  }

  process.stdout.write('\n')
}

const path = join(import.meta.dirname, '../data/picks.json')
writeFileSync(path, JSON.stringify(picks, null, 2))

const located = picks.filter((pick) => pick.place).length
console.log(`\n픽 ${picks.length}개, 좌표 ${located}개 → ${path}`)
