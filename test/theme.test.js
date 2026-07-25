import { test } from 'node:test'
import assert from 'node:assert/strict'

import { THEME_KEY, themeButton, darkStyle, themeScript } from '../src/theme.js'

test('두 화면이 같은 자리에 밝기를 적는다', () => {
  assert.equal(THEME_KEY, 'tastepicker:theme')
  assert.ok(themeScript().includes(THEME_KEY))
})

test('단추와 코드가 같은 것을 가리킨다', () => {
  assert.match(themeButton, /id="theme"/)
  assert.ok(themeScript().includes("getElementById('theme')"))
})

test('기기 설정과 골라 둔 것을 둘 다 받는다', () => {
  const css = darkStyle('--box:#000')

  assert.match(css, /prefers-color-scheme: dark/)
  assert.match(css, /:root\[data-theme="dark"\]/)
  // 밝게 골라 두면 기기가 어두워도 밝게 남는다
  assert.match(css, /:root:not\(\[data-theme="light"\]\)/)
})

test('밝기가 바뀔 때 할 일을 덧붙인다', () => {
  assert.ok(themeScript('map.theme(dark)').includes('map.theme(dark)'))
  assert.ok(!themeScript().includes('map.theme'))
})
