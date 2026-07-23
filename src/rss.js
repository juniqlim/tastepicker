const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

const decode = (text) =>
  text.replace(/&(#39|amp|lt|gt|quot|apos);/g, (whole, name) => ENTITIES[name] ?? whole)

const stripTags = (text) => text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const tag = (name, xml) => {
  const found = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`))
  return found ? found[1].trim() : ''
}

/** 네이버 블로그 RSS를 글 목록으로 읽는다. 최근 50글까지만 실린다. */
export function parseRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
    title: decode(tag('title', item)),
    category: decode(tag('category', item)),
    link: tag('guid', item),
    body: decode(stripTags(tag('description', item))),
  }))
}
