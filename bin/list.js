import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS } from '../src/pickers.js'
import { toSpots, byWeight, toRegions, regionOptions } from '../src/spots.js'
import { themeButton, darkStyle, themeScript } from '../src/theme.js'
import { openDb, allPicks, closedPlaces } from '../src/db.js'

const db = openDb(join(import.meta.dirname, '../data/picks.db'))

// 지도를 안 그리니 좌표도 주소도 필요 없다. 목록에 보일 것만 담는다.
const picks = allPicks(db).filter((pick) => pick.place && pick.picker !== 'juniqlim')

// 문 닫은 가게. 지도와 같이 기본으로 감추고, 켜야 보인다.
const gone = closedPlaces(db)

const spots = toSpots(picks)
  .filter((spot) => spot.region)
  .sort(byWeight)
  .map((spot) => ({
    name: spot.name,
    region: spot.region,
    closed: gone.has(spot.placeId) || undefined,
    // 픽커 수는 정렬에 쓴다. 브라우저에서 매번 세지 않도록 여기서 담아 보낸다.
    pickers: new Set(spot.picks.map((pick) => pick.picker)).size,
    picks: spot.picks.map((pick) => ({
      picker: pick.picker,
      rating: pick.rating,
      note: pick.note,
      link: pick.link,
      sponsored: pick.sponsored,
    })),
  }))

// 지역 숫자는 기본으로 보이는 것에 맞춘다. 없어진 곳까지 세면 목록과 어긋난다.
const options = regionOptions(toRegions(toSpots(picks).filter((spot) => !gone.has(spot.placeId))))

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tastepicker — 목록</title>
<style>
  :root { color-scheme: light dark }
  body { margin:0; font:15px/1.6 system-ui, sans-serif; color:#212529; background:#fff }
  header { position:sticky; top:0; background:#fff; border-bottom:1px solid #e9ecef;
           padding:12px 16px; display:flex; gap:10px; align-items:center; flex-wrap:wrap }
  header a.home { color:#212529; font-weight:700; text-decoration:none }
  select, input, #theme { font:inherit; padding:4px 6px; border:1px solid #dee2e6;
                          border-radius:4px; background:#fff; cursor:pointer }
  main { margin:0 auto; padding:0 16px 40px }
  main.list { max-width:760px }
  main.tile { max-width:1400px }

  /* 타일은 벽돌처럼 쌓는다. 집마다 리뷰 줄 수가 달라 높이가 제각각인 게 자연스럽다. */
  .tile #rows { columns:280px; column-gap:10px }
  .tile .spot { break-inside:avoid; border:1px solid #e9ecef; border-radius:8px;
                padding:12px 14px; margin:0 0 10px }
  .list .spot { border-bottom:1px solid #f1f3f5; padding:14px 0 }

  .spot h2 { margin:0; font-size:15px; line-height:1.4 }
  .spot .where { color:#adb5bd; font-size:12px; font-weight:400 }
  .tile .spot .where { display:block; margin-top:2px }
  .spot ol { margin:6px 0 0; padding-left:20px; color:#495057; font-size:13px }
  .spot li { margin:4px 0 }
  .spot em { font-style:normal; font-weight:600; color:#1971c2 }
  .who { font-weight:600 }
  /* 대가를 받은 글이라는 표시. 한줄평보다 앞서 보이되 등급처럼 강하진 않게 둔다. */
  .paid { padding:0 4px; border-radius:3px; background:#f1f3f5;
          color:#868e96; font-size:11px; font-weight:600; vertical-align:1px }
  /* 없어진 집이라는 표시. 이름 옆에 붙되 이름보다 세지 않게 둔다. */
  .gone { padding:0 4px; border-radius:3px; background:#f1f3f5;
          color:#868e96; font-size:11px; font-weight:600; vertical-align:1px }
  #goneBox { color:#868e96; font-size:13px; white-space:nowrap; cursor:pointer }
  .spot a { color:#868e96; font-size:12px; text-decoration:none }
  .spot a:hover { text-decoration:underline }
  nav { display:flex; gap:4px; flex-wrap:wrap; padding:20px 0; justify-content:center }
  nav button { font:inherit; min-width:34px; padding:5px 8px; border:1px solid #dee2e6;
               background:#fff; border-radius:4px; cursor:pointer; color:#495057 }
  nav button.on { background:#212529; color:#fff; border-color:#212529 }
  nav button:disabled { color:#ced4da; cursor:default }
  #empty { padding:40px 0; color:#868e96; text-align:center }
  ${darkStyle(`
    body, header { background:#191a1c; color:#e9ecef }
    header { border-color:#343a40 }
    header a.home { color:#e9ecef }
    select, input, nav button, #theme { background:#212529; color:#e9ecef; border-color:#495057 }
    nav button.on { background:#e9ecef; color:#212529 }
    .spot, .tile .spot { border-color:#2b3035 }
    .spot ol { color:#adb5bd }
    .paid, .gone { background:#2b3035; color:#adb5bd }
  `)}
</style>
<header>
  <a class="home" href="/">tastepicker</a>
  <select id="region"><option value="">지역 전체</option>${options}</select>
  <select id="picker"><option value="">픽커 전체</option>${PICKERS.filter((picker) => picker.read)
    .map((picker) => `<option value="${picker.id}">${picker.name}</option>`)
    .join('')}</select>
  <input id="find" type="search" placeholder="가게 이름" size="12">
  <select id="sort">
    <option value="weight">픽커 겹친 순</option>
    <option value="visits">다녀간 횟수 순</option>
    <option value="name">가나다 순</option>
  </select>
  <select id="view">
    <option value="tile">타일로</option>
    <option value="list">목록으로</option>
  </select>
  ${spots.some((spot) => spot.closed)
    ? '<label id="goneBox"><input type="checkbox" id="showGone"> 없어진 곳</label>' : ''}
  ${themeButton}
  <a class="home" href="/" style="margin-left:auto;font-weight:400;font-size:13px">지도로 →</a>
</header>
<main id="main" class="tile">
  <div id="count" class="where" style="padding:12px 0"></div>
  <div id="rows"></div>
  <nav id="pages"></nav>
</main>
<script>
const spots = ${JSON.stringify(spots)}
const pickerName = ${JSON.stringify(Object.fromEntries(PICKERS.map((picker) => [picker.id, picker.name])))}
const pickerUrl = ${JSON.stringify(Object.fromEntries(PICKERS.map((picker) => [picker.id, picker.url ?? ''])))}
// 타일은 한 화면에 여러 곳이 들어가 더 많이 실어도 넘기는 품이 늘지 않는다.
const PER = { tile: 60, list: 20 }

const $ = id => document.getElementById(id)
const escape = text => (text || '').replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]))

let page = 1

// spots 는 픽커 겹친 순으로 이미 정렬돼 있다. 다르게 세울 때만 다시 세운다.
const SORTS = {
  weight: null,
  visits: (one, other) => other.picks.length - one.picks.length,
  name: (one, other) => one.name.localeCompare(other.name, 'ko'),
}

function shown() {
  const region = $('region').value
  const picker = $('picker').value
  const word = $('find').value.trim().toLowerCase()

  // 시도만 골랐으면 그 아래를 다 받는다. '서울' 은 '서울 마포구' 를 품는다.
  // 문 닫은 가게는 갈 수 없어서 기본으로 감춘다. 픽커의 글은 켜면 그대로 볼 수 있다.
  const withGone = $('showGone') && $('showGone').checked

  const found = spots.filter(spot =>
    (withGone || !spot.closed) &&
    (!region || spot.region === region || spot.region.startsWith(region + ' ')) &&
    (!picker || spot.picks.some(pick => pick.picker === picker)) &&
    (!word || spot.name.toLowerCase().includes(word)))

  const order = SORTS[$('sort').value]
  return order ? found.sort(order) : found
}

function draw() {
  const found = shown()
  const per = PER[$('view').value]
  const last = Math.max(1, Math.ceil(found.length / per))
  if (page > last) page = last

  $('count').textContent = found.length ? found.length + '곳' : ''
  $('rows').innerHTML = found.length
    ? found.slice((page - 1) * per, page * per).map(row).join('')
    : '<div id="empty">찾는 가게가 없습니다.</div>'

  $('pages').innerHTML = found.length > per ? pager(last) : ''
  window.scrollTo(0, 0)
}

// 한 줄이 한 번의 방문이다. 몇 번째 방문인지 번호로 보이고 원문으로 갈 길을 남긴다.
const row = spot => '<div class="spot"><h2>' + escape(spot.name) +
  // 없어진 집은 이름 옆에 바로 알린다. 한줄평을 다 읽고 찾아갔다가 헛걸음하면 안 된다.
  (spot.closed ? ' <b class="gone">없어짐</b>' : '') +
  '<span class="where">' + spot.region +
  (spot.pickers > 1 ? ' · 픽커 ' + spot.pickers + '명' : '') +
  (spot.picks.length > 1 ? ' · ' + spot.picks.length + '번' : '') +
  '</span></h2><ol>' +
  spot.picks.map(pick =>
    '<li><span class="who">' + (pickerName[pick.picker] || pick.picker) + '</span>' +
    (pick.rating ? ' <em>' + escape(pick.rating) + '</em>' : '') +
    // 대가를 받고 쓴 글은 밝힌다. 지도에서 걸러 볼 수 있는 것을 여기서 감출 이유가 없다.
    (pick.sponsored ? ' <b class="paid">협찬</b>' : '') +
    ' ' + escape(pick.note) +
    ' <a href="' + pick.link + '" target="_blank" rel="noopener">원문</a></li>').join('') +
  '</ol></div>'

// 페이지가 많아도 버튼은 몇 개만 둔다. 지금 쪽 둘레만 보이면 넘어가는 데 지장이 없다.
function pager(last) {
  const from = Math.max(1, Math.min(page - 2, last - 4))
  const to = Math.min(last, from + 4)
  let html = '<button data-go="' + (page - 1) + '"' + (page === 1 ? ' disabled' : '') + '>‹</button>'

  if (from > 1) html += '<button data-go="1">1</button><button disabled>…</button>'
  for (let n = from; n <= to; n++) {
    html += '<button data-go="' + n + '"' + (n === page ? ' class="on"' : '') + '>' + n + '</button>'
  }
  if (to < last) html += '<button disabled>…</button><button data-go="' + last + '">' + last + '</button>'

  return html + '<button data-go="' + (page + 1) + '"' + (page === last ? ' disabled' : '') + '>›</button>'
}

$('pages').onclick = event => {
  const go = event.target.dataset.go
  if (!go) return
  page = Number(go)
  draw()
}

for (const id of ['region', 'picker', 'find', 'sort', 'showGone']) {
  // 없어진 곳이 하나도 없으면 그 상자를 두지 않는다.
  $(id) && ($(id).oninput = () => { page = 1; draw() })
}

// 고른 보기는 이 브라우저에 남는다. 볼 때마다 다시 고르게 하지 않는다.
const VIEW = 'tastepicker:view'

function look(mode) {
  $('main').className = mode
  $('view').value = mode
  localStorage.setItem(VIEW, mode)
}

// 보기를 바꾸면 한 쪽에 싣는 수도 달라져서 다시 그린다.
$('view').oninput = () => { look($('view').value); page = 1; draw() }
look(localStorage.getItem(VIEW) || 'tile')

draw()
${themeScript()}
</script>
`

const out = join(import.meta.dirname, '../public')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'list.html'), html)

console.log(`가게 ${spots.length}곳 → ${join(out, 'list.html')}`)
