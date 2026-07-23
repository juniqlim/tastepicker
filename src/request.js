const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/**
 * 남의 서버를 두드리는 일이라 천천히 부르고, 막히면 물러섰다 다시 부른다.
 * 없는 글이나 잘못된 요청은 다시 불러도 소용없으니 바로 알린다.
 */
export async function request(url, { wait = 300, tries = 4 } = {}) {
  for (let attempt = 0; attempt < tries; attempt++) {
    if (wait) await sleep(wait)

    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (response.ok) return response
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`${url}: ${response.status}`)
    }

    await sleep(2000 * 2 ** attempt)
  }

  throw new Error(`${url}: 429 계속 막힌다`)
}
