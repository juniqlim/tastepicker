import { parseRss } from './rss.js'

/** 네이버 블로그 RSS를 받아 글 목록으로 읽는다. */
export async function fetchPosts(pickerId) {
  const response = await fetch(`https://rss.blog.naver.com/${pickerId}.xml`)
  if (!response.ok) throw new Error(`${pickerId}: RSS를 못 받았다 (${response.status})`)

  return parseRss(await response.text())
}

/** 글 본문을 받는다. 목록 페이지는 껍데기라 본문 주소로 따로 받아야 한다. */
export async function fetchPost(link) {
  const [, blogId, logNo] = link.match(/blog\.naver\.com\/(\w+)\/(\d+)/)
  const response = await fetch(
    `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  )
  if (!response.ok) throw new Error(`${link}: 본문을 못 받았다 (${response.status})`)

  return response.text()
}
