import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS } from '../src/pickers.js'
import { toSpots, byWeight, toRegions } from '../src/spots.js'
import { openDb, allPicks } from '../src/db.js'

const db = openDb(join(import.meta.dirname, '../data/picks.db'))

// 지도를 안 그리니 좌표도 주소도 필요 없다. 목록에 보일 것만 담는다.
const picks = allPicks(db).filter((pick) => pick.place && pick.picker !== 'juniqlim')
const spots = toSpots(picks)
  .filter((spot) => spot.region)
  .sort(byWeight)
  .map((spot) => ({
    name: spot.name,
    region: spot.region,
    picks: spot.picks.map((pick) => ({
      picker: pick.picker,
      rating: pick.rating,
      note: pick.note,
      link: pick.link,
    })),
  }))

const regions = toRegions(toSpots(picks))

const options = regions
  .map(([sido, group]) => {
    if (group.items.length === 1) {
      const [name, count] = group.items[0]
      return `<option value="${name}">${name} (${count})</option>`
    }

    const items = group.items
      .map(([name, count]) => `<option value="${name}">${name.slice(sido.length + 1)} (${count})</option>`)
      .join('')
    return `<optgroup label="${sido} (${group.total})">${items}</optgroup>`
  })
  .join('')

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
  select, input { font:inherit; padding:4px 6px; border:1px solid #dee2e6; border-radius:4px }
  main { max-width:760px; margin:0 auto; padding:0 16px 40px }
  .spot { border-bottom:1px solid #f1f3f5; padding:14px 0 }
  .spot h2 { margin:0; font-size:16px; display:flex; gap:8px; align-items:baseline; flex-wrap:wrap }
  .spot .where { color:#adb5bd; font-size:12px; font-weight:400 }
  .spot ol { margin:8px 0 0; padding-left:22px; color:#495057 }
  .spot li { margin:3px 0 }
  .spot em { font-style:normal; font-weight:600; color:#1971c2 }
  .who { font-weight:600 }
  .spot a { color:#868e96; font-size:12px; text-decoration:none }
  .spot a:hover { text-decoration:underline }
  nav { display:flex; gap:4px; flex-wrap:wrap; padding:20px 0; justify-content:center }
  nav button { font:inherit; min-width:34px; padding:5px 8px; border:1px solid #dee2e6;
               background:#fff; border-radius:4px; cursor:pointer; color:#495057 }
  nav button.on { background:#212529; color:#fff; border-color:#212529 }
  nav button:disabled { color:#ced4da; cursor:default }
  #empty { padding:40px 0; color:#868e96; text-align:center }
  @media (prefers-color-scheme: dark) {
    body, header { background:#191a1c; color:#e9ecef }
    header { border-color:#343a40 }
    header a.home { color:#e9ecef }
    select, input, nav button { background:#212529; color:#e9ecef; border-color:#495057 }
    nav button.on { background:#e9ecef; color:#212529 }
    .spot { border-color:#2b3035 }
    .spot ol { color:#adb5bd }
  }
</style>
<header>
  <a class="home" href="/">tastepicker</a>
  <select id="region"><option value="">지역 전체</option>${options}</select>
  <select id="picker"><option value="">픽커 전체</option>${PICKERS.filter((picker) => picker.read)
    .map((picker) => `<option value="${picker.id}">${picker.name}</option>`)
    .join('')}</select>
  <input id="find" type="search" placeholder="가게 이름" size="12">
  <a class="home" href="/" style="margin-left:auto;font-weight:400;font-size:13px">지도로 →</a>
</header>
<main>
  <div id="count" class="where" style="padding:12px 0"></div>
  <div id="rows"></div>
  <nav id="pages"></nav>
</main>
<script>
const spots = ${JSON.stringify(spots)}
const pickerName = ${JSON.stringify(Object.fromEntries(PICKERS.map((picker) => [picker.id, picker.name])))}
const pickerUrl = ${JSON.stringify(Object.fromEntries(PICKERS.map((picker) => [picker.id, picker.url ?? ''])))}
const PER = 20

const $ = id => document.getElementById(id)
const escape = text => (text || '').replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]))

let page = 1

function shown() {
  const region = $('region').value
  const picker = $('picker').value
  const word = $('find').value.trim().toLowerCase()

  return spots.filter(spot =>
    (!region || spot.region === region) &&
    (!picker || spot.picks.some(pick => pick.picker === picker)) &&
    (!word || spot.name.toLowerCase().includes(word)))
}

function draw() {
  const found = shown()
  const last = Math.max(1, Math.ceil(found.length / PER))
  if (page > last) page = last

  $('count').textContent = found.length ? found.length + '곳' : ''
  $('rows').innerHTML = found.length
    ? found.slice((page - 1) * PER, page * PER).map(row).join('')
    : '<div id="empty">찾는 가게가 없습니다.</div>'

  $('pages').innerHTML = found.length > PER ? pager(last) : ''
  window.scrollTo(0, 0)
}

// 한 줄이 한 번의 방문이다. 몇 번째 방문인지 번호로 보이고 원문으로 갈 길을 남긴다.
const row = spot => '<div class="spot"><h2>' + escape(spot.name) +
  '<span class="where">' + spot.region + '</span></h2><ol>' +
  spot.picks.map(pick =>
    '<li><span class="who">' + (pickerName[pick.picker] || pick.picker) + '</span>' +
    (pick.rating ? ' <em>' + escape(pick.rating) + '</em>' : '') +
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

for (const id of ['region', 'picker', 'find']) {
  $(id).oninput = () => { page = 1; draw() }
}

draw()
</script>
`

const out = join(import.meta.dirname, '../public')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'list.html'), html)

console.log(`가게 ${spots.length}곳 → ${join(out, 'list.html')}`)
