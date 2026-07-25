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

import { execFile } from 'node:child_process'

export const checkUrl = (placeId) => `https://m.place.naver.com/place/${placeId}/home`

/** 브라우저처럼 묻지 않으면 막는다(429). 이름만 대충 대서는 안 통한다. */
const MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' +
  ' (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

/**
 * 장소가 아직 있는지 묻고 답의 번호만 받는다. 못 물었으면 비운다.
 *
 * 여기만 Node 로 부르지 않고 `curl` 을 쓴다.
 * 많이 물으면 막히는데(429), 같은 자리에서 같은 순간에 `fetch` 는 여덟에 둘만 통과하고
 * `curl` 은 여덟을 다 통과했다. IP 만 세는 게 아니라 연결의 모양도 같이 본다.
 * 무엇을 보는지는 네이버만 안다. 오래 버티는 쪽을 쓴다.
 *
 * 넘김은 따라가지 않는다. 넘긴다는 것 자체가 답이라 그 뒤는 볼 것이 없다.
 * 본문도 받지 않는다(`-I`). 한 곳에 0.2초면 된다.
 */
export function askPlace(placeId) {
  return new Promise((done) => {
    execFile(
      'curl',
      ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-I', '-A', MOBILE, checkUrl(placeId)],
      (broken, answer) => done(broken ? null : Number(answer) || null),
    )
  })
}

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
