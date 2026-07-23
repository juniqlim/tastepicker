const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

const decode = (text) =>
  text.replace(/&(#39|amp|lt|gt|quot|apos);/g, (whole, name) => ENTITIES[name] ?? whole)

const field = (name, json) => {
  const found = json.match(new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`))
  return found ? decode(found[1]) : null
}

/**
 * 픽커가 글에 붙인 네이버 장소를 읽는다.
 * 검색으로 추측하지 않고 픽커가 지정한 곳을 그대로 쓴다.
 */
export function parsePlace(html) {
  const found = decode(html).match(/data-linkdata='([^']*"latitude"[^']*)'/)
  if (!found) return null

  const [json] = found.slice(1)
  return {
    placeId: field('placeId', json),
    name: field('name', json),
    address: field('address', json),
    lat: Number(field('latitude', json)),
    lng: Number(field('longitude', json)),
    tel: field('tel', json),
  }
}
