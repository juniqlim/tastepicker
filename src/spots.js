import { regionOf } from './region.js'

/**
 * 한 줄은 한 번의 방문이다. 가게 하나에 방문이 여럿 붙는다.
 * 지도는 핀 하나로, 목록은 줄 하나로 보여준다. 묶는 방법은 같아야 해서 여기 둔다.
 */

/**
 * 장소 ID로 묶는다. 구형 지도 위젯과 구글맵은 ID를 안 줘서 그때는 이름과 자리로 묶는다.
 * 그 좌표는 글마다 몇십 미터씩 어긋난다. 그대로 두면 같은 집이 열두 곳으로 갈라진다.
 */
const NEAR = 0.0015 // 위도로 약 150m

// 픽커마다 띄어쓰기와 기호가 다르다. 지우고 견준다.
const plainName = (name) => (name ?? '').replace(/[\s·,.()-]/g, '')

// 한쪽이 다른 쪽으로 시작하면 같은 집으로 본다. 구이·본점처럼 뒤에 덧붙는다.
const sameName = (one, other) => !!one && !!other && (one.startsWith(other) || other.startsWith(one))

const near = (spot, place) =>
  Math.abs(spot.lat - place.lat) <= NEAR && Math.abs(spot.lng - place.lng) <= NEAR

export function toSpots(picks) {
  const spots = []
  const byId = new Map()
  const byPoint = new Map()
  // 이름을 다 견주면 느리다. 앞 두 글자로 나눠 후보만 본다.
  const buckets = new Map()

  const bucketOf = (name) => {
    const key = name.slice(0, 2)
    if (!buckets.has(key)) buckets.set(key, [])
    return buckets.get(key)
  }

  // 장소 ID를 가진 픽을 먼저 본다. 상호와 주소가 있는 쪽이 가게의 기준이 된다.
  const ordered = [...picks].sort(
    (one, other) => (other.place.placeId ? 1 : 0) - (one.place.placeId ? 1 : 0),
  )

  for (const pick of ordered) {
    const place = pick.place
    const name = plainName(place.name ?? pick.name)
    const point = `${place.lat},${place.lng}`
    const bucket = bucketOf(name)

    // 가게 이름은 네이버 상호로 통일한다. 픽커마다 다르게 적어서 같은 집이 여러 곳처럼 보인다.
    const spot =
      (place.placeId ? byId.get(place.placeId) : null) ??
      byPoint.get(point) ??
      bucket.find((one) => sameName(one.key, name) && near(one, place)) ?? {
        ...place,
        key: name,
        name: place.name ?? pick.name,
        region: regionOf(place.address),
        picks: [],
      }

    if (!spot.picks.length) spots.push(spot)
    spot.picks.push(pick)

    if (place.placeId) byId.set(place.placeId, spot)
    byPoint.set(point, spot)
    if (!bucket.includes(spot)) bucket.push(spot)
  }

  return spots.map(({ key, ...spot }) => spot)
}

/**
 * 여러 픽커가 겹친 집이 먼저다. 겹칠수록 근거가 두껍다.
 * 한 픽커가 열 번 간 것보다 세 픽커가 한 번씩 간 쪽을 위에 둔다.
 * 혼자 여러 번 가는 건 취향일 수 있어도, 여럿이 가면 취향만은 아니다.
 */
export function byWeight(one, other) {
  const weigh = (spot) => new Set(spot.picks.map((pick) => pick.picker)).size * 100 + spot.picks.length
  return weigh(other) - weigh(one)
}

/** 다녀간 횟수가 많은 집이 먼저다. 누가 갔는지는 보지 않는다. */
export function byVisits(one, other) {
  return other.picks.length - one.picks.length
}

/** 가나다 순. 찾는 이름이 있을 때 쓴다. */
export function byName(one, other) {
  return one.name.localeCompare(other.name, 'ko')
}

/** 시도로 묶은 지역 목록. 묶음도, 묶음 안도 가게가 많은 곳이 먼저다. */
export function toRegions(spots) {
  const counted = new Map()
  for (const spot of spots) {
    if (spot.region) counted.set(spot.region, (counted.get(spot.region) ?? 0) + 1)
  }

  const grouped = new Map()
  for (const [name, count] of [...counted].sort((one, other) => other[1] - one[1])) {
    const [sido] = name.split(' ')
    const group = grouped.get(sido) ?? { total: 0, items: [] }
    group.total += count
    group.items.push([name, count])
    grouped.set(sido, group)
  }

  return [...grouped].sort((one, other) => other[1].total - one[1].total)
}

/**
 * 고를 수 있는 지역 목록.
 * optgroup 의 이름표는 눌리지 않아서, 시도 전체를 묶음 맨 위에 따로 둔다.
 */
export function regionOptions(regions) {
  return regions
    .map(([sido, group]) => {
      // 아래가 하나뿐이면 묶어봐야 같은 말이 두 줄이 된다.
      if (group.items.length === 1) {
        const [name, count] = group.items[0]
        return `<option value="${name}">${name} (${count})</option>`
      }

      const items = group.items
        .map(([name, count]) => `<option value="${name}">${name.slice(sido.length + 1)} (${count})</option>`)
        .join('')

      return `<optgroup label="${sido} (${group.total})">` +
        `<option value="${sido}">${sido} 전체 (${group.total})</option>${items}</optgroup>`
    })
    .join('')
}

/** 고른 지역에 드는가. 시도만 골랐으면 그 아래를 다 받는다. */
export function inRegion(spot, picked) {
  if (!picked) return true

  return spot.region === picked || spot.region.startsWith(`${picked} `)
}
