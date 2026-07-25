import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isSponsored } from '../src/sponsor.js'

const post = (line) =>
  `<div class="se-module se-module-text"><p class="se-text-paragraph">
     <span style="color:#c2c2c2;" class="se-fs-fs11">${line}</span></p></div>`

test('대가를 밝힌 글을 가려낸다', () => {
  const lines = [
    '업체에서 식사권을 제공받아 솔직하게 작성한 글입니다',
    '이 글은 스토리앤미디어를 통해 본 업체에서 제품 또는 서비스를 제공받아 작성된 글 입니다.',
    '이 글은 리뷰노트를 통하여 본 업체에서 제품 또는 서비스를 제공받아 작성된 글 입니다',
    '걸작떡볶이치킨으로부터 식사권을 제공받아 작성된 포스팅입니다.',
    '위포스팅은 포블로그에서 협찬받아 작성했습니다.',
    '힐링체험단을 통해 상품만을 제공받아 솔직하게작성한 후기입니다',
  ]

  for (const line of lines) assert.equal(isSponsored(post(line)), true, line)
})

test('낱말이 태그로 갈려도 읽는다', () => {
  const html = '<p>업체에서 식사권을 제공<b>받아</b> 솔직하게 작성한 글입니다</p>'

  assert.equal(isSponsored(html), true)
})

test('가게가 남에게 한 협찬은 대가가 아니다', () => {
  const html = post('드라마 태양을 삼킨 여자에 공식협찬을 해줬다고 한다!')

  assert.equal(isSponsored(html), false)
})

test('대가가 없다고 밝힌 글도 대가가 아니다', () => {
  const html = post('유료광고 미포함 영상은 모두 제돈제산입니다')

  assert.equal(isSponsored(html), false)
})

test('가게가 서비스로 내준 음식은 대가가 아니다', () => {
  const html = post('사장님이 서비스로 제공받아 먹은 계란찜이 별미였다')

  assert.equal(isSponsored(html), false)
})

test('아무 말 없는 글은 대가가 아니다', () => {
  assert.equal(isSponsored(post('짬뽕이 맛있었다. 다음에 또 오고 싶다')), false)
})

test('부등호로 감싼 문장을 태그로 보지 않는다', () => {
  const html = '<p><span>&lt;힐링체험단을 통해 상품만을 제공받아 솔직하게 작성한 후기입니다&gt;</span></p>'

  // 픽커가 부등호로 감싸 두기도 한다. 태그로 보고 지우면 문구째 사라진다.
  assert.equal(isSponsored(html.replace(/&lt;/g, '<').replace(/&gt;/g, '>')), true)
})
