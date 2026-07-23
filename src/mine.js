/**
 * 내 평가. 블로그가 없으니 긁어올 것이 없고 data/juniqlim.json 에 직접 적는다.
 * 가게는 이미 픽커들이 다녀간 곳에서 고른다. 그래야 겹치는 가게가 생겨 견줄 수 있다.
 *
 * 한 줄이 한 번의 방문이다. 같은 가게를 다시 가면 날짜를 달리해 한 줄 더 적는다.
 * 갈 때마다 점수와 한줄평이 달라질 수 있다.
 */
export function myPicks(db, mine) {
  const picks = []

  for (const { placeId, visited, level, note } of mine) {
    if (!level || !visited) continue

    const seen = db
      .prepare('SELECT region, place_name, address, lat, lng, tel FROM pick WHERE place_id = ? LIMIT 1')
      .get(placeId)
    if (!seen) continue

    picks.push({
      id: `juniqlim:${placeId}:${visited}`,
      picker: 'juniqlim',
      region: seen.region,
      name: seen.place_name,
      note: note ?? '',
      rating: String(level),
      level,
      levelBy: '픽커',
      visited,
      link: `https://map.naver.com/p/entry/place/${placeId}`,
      place: {
        placeId,
        name: seen.place_name,
        address: seen.address,
        lat: seen.lat,
        lng: seen.lng,
        tel: seen.tel,
      },
    })
  }

  return picks
}
