/**
 * 없어진 가게를 가려낸다.
 *
 * 네이버는 문 닫은 가게를 '폐업' 이라 적어 두지 않고 장소를 통째로 지운다.
 * 그래서 물어볼 것은 하나다 — 이 장소 번호가 아직 있는가.
 *
 * 범용 주소로 물으면 있는 장소는 업종 페이지로 넘기고(302), 없으면 그냥 빈 껍데기를 준다(200).
 * 그 빈 껍데기는 있지도 않았던 번호로 물었을 때와 바이트까지 같다.
 *
 * 업종 경로(`/restaurant/…`)로 물으면 안 된다. 없는 가게에도 페이지를 내주어 둘이 구별되지 않는다.
 */

export const checkUrl = (placeId) => `https://m.place.naver.com/place/${placeId}/home`

/**
 * 넘김(302)은 있다는 뜻, 빈 껍데기(200)는 없다는 뜻이다.
 * 그 밖의 답은 네이버가 흔들린 것이라 판정하지 않는다.
 * 막힌 응답을 없어진 것으로 보면 살아있는 가게가 지도에서 사라진다.
 */
export function isGone(status) {
  if (status === 302) return false
  if (status === 200) return true

  return null
}

/** 네이버 장소 번호는 숫자다. 구글맵을 붙인 글의 ID는 네이버에 물어봐야 늘 없다고 나온다. */
export const checkable = (placeId) => /^\d+$/.test(placeId ?? '')
