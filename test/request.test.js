import { test } from 'node:test'
import assert from 'node:assert/strict'

import { request } from '../src/request.js'

const replyWith = (...statuses) => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    return { ok: statuses[calls.length - 1] < 400, status: statuses[calls.length - 1] }
  }
  return calls
}

test('한 번에 되면 그대로 준다', async () => {
  const calls = replyWith(200)

  const response = await request('https://x/1', { wait: 0 })

  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
})

test('막히면 쉬었다 다시 부른다', async () => {
  const calls = replyWith(429, 429, 200)

  const response = await request('https://x/1', { wait: 0 })

  assert.equal(response.status, 200)
  assert.equal(calls.length, 3)
})

test('계속 막히면 알린다', async () => {
  replyWith(429, 429, 429)

  await assert.rejects(request('https://x/1', { wait: 0, tries: 3 }), /429/)
})

test('없는 글은 다시 부르지 않는다', async () => {
  const calls = replyWith(404)

  await assert.rejects(request('https://x/1', { wait: 0 }), /404/)
  assert.equal(calls.length, 1)
})
