import { regionOf } from './region.js'

/**
 * 한 줄은 한 번의 방문이다. 가게 하나에 방문이 여럿 붙는다.
 * 지도는 핀 하나로, 목록은 줄 하나로 보여준다. 묶는 방법은 같아야 해서 여기 둔다.
 */

// 장소 ID로 묶는다. 구형 지도 위젯과 구글맵은 ID를 안 줘서 그때는 좌표로 묶는다.
const keyOf = (place) => place.placeId ?? `${place.lat},${place.lng}`

export function toSpots(picks) {
  const places = new Map()

  for (const pick of picks) {
    const key = keyOf(pick.place)
    // 가게 이름은 네이버 상호로 통일한다. 픽커마다 다르게 적어서 같은 집이 여러 곳처럼 보인다.
    const spot = places.get(key) ?? {
      ...pick.place,
      name: pick.place.name ?? pick.name,
      region: regionOf(pick.place.address),
      picks: [],
    }

    spot.picks.push(pick)
    places.set(key, spot)
  }

  return [...places.values()]
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
