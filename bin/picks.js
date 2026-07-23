import { PICKERS, collect } from '../src/pickers.js'
import { fetchPosts } from '../src/naver.js'

const width = (text, size) => text + ' '.repeat(Math.max(0, size - [...text].length * 1.7))

for (const picker of PICKERS) {
  const posts = await fetchPosts(picker.id)
  const picks = collect(picker, posts)

  console.log(`\n${picker.name}  ${picker.url}`)
  console.log(`글 ${posts.length}개 → 픽 ${picks.length}개\n`)

  for (const pick of picks) {
    const rating = pick.rating ? `[${pick.rating}] ` : ''
    console.log(`  ${width(pick.region, 22)}${width(pick.name, 26)}${rating}${pick.note}`)
    console.log(`  ${' '.repeat(48)}${pick.link}`)
  }
}
