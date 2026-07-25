/**
 * 대가를 받고 쓴 글을 가려낸다.
 *
 * 네이버가 주는 값이 없다. 목록 API 의 협찬 칸(`greenReviewBannerYn`)은 비어 있고,
 * 공식 배너도 쓰지 않는다. 글 안에 픽커가 남긴 자취가 유일한 근거다.
 *
 * 자취는 두 가지고 서로 겹치지 않는다. 손으로 적은 한 줄, 아니면 체험단이 준 배너 그림이다.
 * 둘 중 하나만 보면 절반을 놓친다.
 */

/**
 * 손으로 적는 문구. 체험단마다 달라도 '무엇을 받아서 썼다' 는 짜임은 하나다.
 * 그래서 받은 말과 썼다는 말이 한 문장 안에 함께 있을 때만 대가로 본다.
 *
 * '받아' 만 보면 가게가 서비스로 내준 음식이 걸리고,
 * '협찬' 만 보면 가게가 드라마에 협찬한 이야기가 걸린다.
 */
const PAID = /(제공\s*받아|협찬\s*받아|지원\s*받아)[^가-힣]*[가-힣\s]{0,20}?(작성|포스팅|후기)/

/**
 * 체험단이 준 배너 그림. `alt` 가 비어 있어 글자로는 잡히지 않고, 주소로만 알 수 있다.
 * 픽커의 사진은 네이버(`pstatic`)에 올라가므로 이들 주소에서 오는 그림은 배너뿐이다.
 *
 * 한글 주소는 punycode 로 적힌다. `xn--939au0g4vj8sq.net` 은 `강남맛집.net` 이다.
 * 목록에 없는 체험단은 놓친다. 밝히지 않은 대가와 마찬가지로 알 길이 없다.
 */
const PLATFORMS = [
  'revu.net',
  'reviewnote', // reviewnote.co.kr, reviewnote.cloud, 파이어베이스에 올린 공정위 배너
  'storyn.kr',
  'mrblog.net',
  'ringble.co.kr',
  'dinnerqueen.net',
  'reviewplace.co.kr',
  'blogmall.net',
  'kormedia.co.kr', // 오마이블로그
  'd3i7y4ugnppb9p.cloudfront.net',
  'xn--939au0g4vj8sq.net', // 강남맛집.net
  'xn--o39a04kpnjo4k9hgflp.com', // 가보자체험단.com
]

const BANNER = new RegExp(PLATFORMS.map((host) => host.replace(/\./g, '\\.')).join('|'))

/**
 * 태그만 걷어낸다. 태그는 영문자나 `/` 로 열린다.
 * `<힐링체험단을 통해 …후기입니다>` 처럼 부등호로 감싼 문장을 태그로 보면 문구째 사라진다.
 */
const textOf = (html) =>
  html
    .replace(/<\/?[a-zA-Z!][^<>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')

/** 글이 대가를 밝혔는지 본다. 밝히지 않은 대가는 알 길이 없다. */
export function isSponsored(html) {
  return BANNER.test(html) || PAID.test(textOf(html))
}
