import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseRss } from '../src/rss.js'

const fixture = (id) =>
  readFileSync(join(import.meta.dirname, '../data/fixtures', `${id}.xml`), 'utf-8')

test('글 목록을 읽는다', () => {
  const posts = parseRss(fixture('thddbcjf'))

  assert.equal(posts.length, 50)
})

test('제목, 카테고리, 링크를 읽는다', () => {
  const [post] = parseRss(fixture('thddbcjf'))

  assert.equal(post.title, '안양 평촌학원가 억떡볶이-추억은 현재진행듕')
  assert.equal(post.category, '안양권')
  assert.equal(post.link, 'https://blog.naver.com/thddbcjf/224355010343')
})

test('본문에서 태그와 엔티티를 걷어낸다', () => {
  const [post] = parseRss(fixture('fascinoya'))

  assert.ok(!post.body.includes('<'))
  assert.ok(!post.body.includes('&amp;'))
})
