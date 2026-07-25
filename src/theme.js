/**
 * 밝기는 기기 설정을 따른다. 밤에 폰을 어둡게 쓰는 사람에게 흰 화면을 내밀 이유가 없다.
 * 눌러서 바꾸면 그것을 적어 두고, 적어 둔 것이 없으면 계속 기기를 따라간다.
 *
 * 지도와 목록이 같은 자리에 적어서, 한 쪽에서 고른 밝기가 다른 쪽에서도 이어진다.
 * 두 화면에 같은 코드를 두 번 쓸 일이 아니라 여기 두고 심는다.
 */
export const THEME_KEY = 'tastepicker:theme'

/** 밝기를 바꾸는 단추. 기호는 지금 상태를 보인다. */
export const themeButton = '<button id="theme" type="button" title="밝기">☀</button>'

/**
 * 어두울 때 갈아 끼울 색.
 * 기기 설정과 눌러서 고른 것 둘 다 받는다. 고른 것이 기기보다 위에 선다.
 */
export const darkStyle = (rules) => `
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {${rules}}
  }
  :root[data-theme="dark"] {${rules}}`

/** 화면에 심을 코드. `also` 는 밝기가 바뀔 때 함께 할 일이다. */
export const themeScript = (also = '') => `
const THEME = '${THEME_KEY}'
const themeButton = document.getElementById('theme')
const systemDark = matchMedia('(prefers-color-scheme: dark)')
const isDark = () => {
  const kept = localStorage.getItem(THEME)
  return kept ? kept === 'dark' : systemDark.matches
}

function showTheme() {
  const kept = localStorage.getItem(THEME)
  const dark = isDark()

  if (kept) document.documentElement.dataset.theme = kept
  else delete document.documentElement.dataset.theme

  themeButton.textContent = dark ? '☾' : '☀'
  themeButton.title = dark ? '밝게' : '어둡게'
  ${also}
}

themeButton.onclick = () => {
  localStorage.setItem(THEME, isDark() ? 'light' : 'dark')
  showTheme()
}

// 적어 둔 것이 없을 때만 기기를 따라간다. 골라 둔 사람의 뜻을 뒤집지 않는다.
systemDark.onchange = () => localStorage.getItem(THEME) || showTheme()

showTheme()`
