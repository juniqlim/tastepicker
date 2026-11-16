import { parseRss, decode } from './rss.js'
import { request } from './request.js'

/** 네이버 블로그 RSS를 받아 글 목록으로 읽는다. 최근 50글까지만 실린다. */
export async function fetchPosts(pickerId) {
  return parseRss(await request(`https://rss.blog.naver.com/${pickerId}.xml`))
}

const PER_PAGE = 30

/**
 * 목록 API는 작은따옴표를 잘못 이스케이프해서 보낸다.
 * 블로그가 닫히면 200 으로 안내문(HTML)이 온다. 어느 블로그인지 알린다.
 */
function readList(blogId, text) {
  try {
    return JSON.parse(text.replace(/\\'/g, "'"))
  } catch {
    throw new Error(`${blogId}: 글 목록이 오지 않는다. 블로그가 닫혔거나 주소가 바뀌었다`)
  }
}

/**
 * 목록이 주는 글 날짜. '2026. 11. 5.' 로 오고, 하루가 안 된 글은 '3시간 전' 으로 온다.
 * 한국 날짜로 옮긴다. 모르는 표기는 짐작하지 않고 비운다.
 */
export function postedOn(addDate = '', now = new Date()) {
  const date = addDate.match(/^(\d+)\. (\d+)\. (\d+)\.$/)
  if (date) return `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`

  const ago = addDate.match(/^(\d+)(시간|분) 전$/)
  if (!ago) return null

  const past = ago[1] * (ago[2] === '시간' ? 3_600_000 : 60_000)
  return new Date(now - past + 9 * 3_600_000).toISOString().slice(0, 10)
}

async function fetchListPage(blogId, page) {
  const text = await request(
    `https://blog.naver.com/PostTitleListAsync.naver` +
      `?blogId=${blogId}&viewdate=&currentPage=${page}&categoryNo=&parentCategoryNo=&countPerPage=${PER_PAGE}`,
  )

  const { totalCount, postList } = readList(blogId, text)
  return {
    total: Number(totalCount),
    posts: postList.map((post) => ({
      title: decode(decodeURIComponent(post.title.replaceAll('+', ' '))),
      link: `https://blog.naver.com/${blogId}/${post.logNo}`,
      // 하위 카테고리로 잘게 나눈 픽커가 있어 묶음인 부모 번호를 쓴다.
      categoryNo: post.parentCategoryNo,
      posted: postedOn(post.addDate),
    })),
  }
}

/** 블로그의 모든 글. RSS는 최근 50글뿐이라 목록 API로 받는다. */
export async function fetchAllPosts(blogId, onPage = () => {}) {
  const first = await fetchListPage(blogId, 1)
  const pages = Math.ceil(first.total / PER_PAGE)
  const posts = [...first.posts]
  onPage(posts.length, first.total)

  for (let page = 2; page <= pages; page++) {
    posts.push(...(await fetchListPage(blogId, page)).posts)
    onPage(posts.length, first.total)
  }

  return posts
}

/** 글 본문을 받는다. 목록 페이지는 껍데기라 본문 주소로 따로 받아야 한다. */
export async function fetchPost(link) {
  const [, blogId, logNo] = link.match(/blog\.naver\.com\/(\w+)\/(\d+)/)
  return request(`https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`)
}
