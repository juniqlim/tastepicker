import { parseRss } from './rss.js'
import { request } from './request.js'

/** 네이버 블로그 RSS를 받아 글 목록으로 읽는다. 최근 50글까지만 실린다. */
export async function fetchPosts(pickerId) {
  const response = await request(`https://rss.blog.naver.com/${pickerId}.xml`)

  return parseRss(await response.text())
}

const PER_PAGE = 30

/** 목록 API는 작은따옴표를 잘못 이스케이프해서 보낸다. */
const readJson = (text) => JSON.parse(text.replace(/\\'/g, "'"))

async function fetchListPage(blogId, page) {
  const response = await request(
    `https://blog.naver.com/PostTitleListAsync.naver` +
      `?blogId=${blogId}&viewdate=&currentPage=${page}&categoryNo=&parentCategoryNo=&countPerPage=${PER_PAGE}`,
  )

  const { totalCount, postList } = readJson(await response.text())
  return {
    total: Number(totalCount),
    posts: postList.map((post) => ({
      title: decodeURIComponent(post.title.replaceAll('+', ' ')),
      link: `https://blog.naver.com/${blogId}/${post.logNo}`,
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
  const response = await request(
    `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`,
  )

  return response.text()
}
