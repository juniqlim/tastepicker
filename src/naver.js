import { parseRss } from './rss.js'

/** 네이버 블로그 RSS를 받아 글 목록으로 읽는다. */
export async function fetchPosts(pickerId) {
  const response = await fetch(`https://rss.blog.naver.com/${pickerId}.xml`)
  if (!response.ok) throw new Error(`${pickerId}: RSS를 못 받았다 (${response.status})`)

  return parseRss(await response.text())
}
