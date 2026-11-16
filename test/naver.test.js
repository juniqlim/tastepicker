import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fetchAllPosts, postedOn } from '../src/naver.js'

const replyWith = (text) => {
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => text })
}

test('글 목록을 읽는다', async () => {
  replyWith(String.raw`{"totalCount":"1","postList":[{"logNo":"7","title":"it\'s+%EB%B0%A5","parentCategoryNo":"3","addDate":"2026. 11. 5."}]}`)

  const posts = await fetchAllPosts('someone')

  assert.deepEqual(posts, [
    { title: "it's 밥", link: 'https://blog.naver.com/someone/7', categoryNo: '3', posted: '2026-11-05' },
  ])
})

test('닫힌 블로그는 목록 대신 안내문이 온다. 어느 블로그인지 알린다', async () => {
  replyWith('<!DOCTYPE HTML><script>alert("게시물이 삭제되었거나 다른 페이지로 변경되었습니다.")</script>')

  await assert.rejects(fetchAllPosts('someone'), /someone: 글 목록이 오지 않는다/)
})

// 한국 시각 11월 16일 새벽 2시
const 지금 = new Date('2026-11-15T17:00:00Z')

test('글 날짜를 읽는다', () => {
  assert.equal(postedOn('2026. 11. 5.', 지금), '2026-11-05')
})

test('하루가 안 된 글은 몇 시간 전이라고 온다. 한국 날짜로 옮긴다', () => {
  assert.equal(postedOn('1시간 전', 지금), '2026-11-16')
  assert.equal(postedOn('3시간 전', 지금), '2026-11-15')
  assert.equal(postedOn('10분 전', 지금), '2026-11-16')
})

test('모르는 표기는 날짜로 짐작하지 않는다', () => {
  assert.equal(postedOn('어제', 지금), null)
  assert.equal(postedOn(undefined, 지금), null)
})
