import { test } from 'node:test'
import assert from 'node:assert/strict'

import { request } from '../src/request.js'

const replyWith = (...statuses) => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    const status = statuses[calls.length - 1]
    return { ok: status < 400, status, text: async () => `본문 ${status}` }
  }
  return calls
}

test('한 번에 되면 본문을 준다', async () => {
  const calls = replyWith(200)

  const text = await request('https://x/1', { wait: 0, backoff: 0 })

  assert.equal(text, '본문 200')
  assert.equal(calls.length, 1)
})

test('막히면 쉬었다 다시 부른다', async () => {
  const calls = replyWith(429, 429, 200)

  const text = await request('https://x/1', { wait: 0, backoff: 0 })

  assert.equal(text, '본문 200')
  assert.equal(calls.length, 3)
})

test('계속 막히면 알린다', async () => {
  replyWith(429, 429, 429)

  await assert.rejects(request('https://x/1', { wait: 0, backoff: 0, tries: 3 }), /429/)
})

test('없는 글은 다시 부르지 않는다', async () => {
  const calls = replyWith(404)

  await assert.rejects(request('https://x/1', { wait: 0, backoff: 0 }), /404/)
  assert.equal(calls.length, 1)
})

const failThen = (times, status) => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    if (calls.length <= times) throw new TypeError('fetch failed')
    return { ok: status < 400, status, text: async () => `본문 ${status}` }
  }
  return calls
}

test('연결이 끊기면 다시 부른다', async () => {
  const calls = failThen(2, 200)

  const text = await request('https://x/1', { wait: 0, backoff: 0 })

  assert.equal(text, '본문 200')
  assert.equal(calls.length, 3)
})

test('계속 끊기면 알린다', async () => {
  failThen(3, 200)

  await assert.rejects(request('https://x/1', { wait: 0, backoff: 0, tries: 3 }), /fetch failed/)
})

test('본문을 받다 끊겨도 다시 부른다', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    const broken = calls.length === 1
    return {
      ok: true,
      status: 200,
      text: async () => {
        if (broken) throw new TypeError('terminated')
        return '본문 200'
      },
    }
  }

  const text = await request('https://x/1', { wait: 0, backoff: 0 })

  assert.equal(text, '본문 200')
  assert.equal(calls.length, 2)
})
