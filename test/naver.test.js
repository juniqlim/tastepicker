import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fetchAllPosts } from '../src/naver.js'

const replyWith = (text) => {
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => text })
}

test('글 목록을 읽는다', async () => {
  replyWith(String.raw`{"totalCount":"1","postList":[{"logNo":"7","title":"it\'s+%EB%B0%A5","parentCategoryNo":"3"}]}`)

  const posts = await fetchAllPosts('someone')

  assert.deepEqual(posts, [
    { title: "it's 밥", link: 'https://blog.naver.com/someone/7', categoryNo: '3' },
  ])
})

test('닫힌 블로그는 목록 대신 안내문이 온다. 어느 블로그인지 알린다', async () => {
  replyWith('<!DOCTYPE HTML><script>alert("게시물이 삭제되었거나 다른 페이지로 변경되었습니다.")</script>')

  await assert.rejects(fetchAllPosts('someone'), /someone: 글 목록이 오지 않는다/)
})
