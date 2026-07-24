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

/**
 * 픽커가 네이버 장소 대신 구글맵을 붙이기도 한다(맛짱). 그 단축 링크를 뽑는다.
 * 링크는 짧아서 좌표가 없다. 펼쳐야 좌표가 나온다(coordsFromGoogle).
 */
export function googleMapUrl(html) {
  const found = decode(html).match(/https:\/\/maps\.app\.goo\.gl\/\w+/)
  return found ? found[0] : null
}

/**
 * 펼친 구글맵 주소에서 장소 좌표를 읽는다.
 * '!3d위도!4d경도' 가 장소의 좌표다. '@중심,중심' 은 지도 중심이라 덜 정확하다.
 */
export function coordsFromGoogle(url) {
  const point = url.match(/!3d([\d.]+)!4d([\d.]+)/)
  if (!point) return null

  const name = url.match(/\/place\/([^/@]+)/)
  const placeId = url.match(/!1s(0x[\da-f]+:0x[\da-f]+)/)
  return {
    placeId: placeId ? placeId[1] : null,
    name: name ? decodeURIComponent(name[1].replace(/\+/g, ' ')) : null,
    lat: Number(point[1]),
    lng: Number(point[2]),
  }
}
