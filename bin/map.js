import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS } from '../src/pickers.js'
import { openDb, allPicks } from '../src/db.js'

try {
  process.loadEnvFile(join(import.meta.dirname, '../.env'))
} catch {
  // 배포할 때는 파일 대신 환경변수로 들어온다.
}

const SUPABASE = {
  url: process.env.SUPABASE_URL ?? '',
  key: process.env.SUPABASE_ANON_KEY ?? '',
}
if (!SUPABASE.url || !SUPABASE.key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY 가 없다')

const db = openDb(join(import.meta.dirname, '../data/picks.db'))

// 내 평가는 Supabase에 산다. 블로그 픽만 HTML에 박는다.
const picks = allPicks(db).filter((pick) => pick.place && pick.picker !== 'juniqlim')

/**
 * 핀 하나는 가게 하나다. 픽 하나가 아니다.
 * 한 가게를 여러 픽커가, 또 같은 픽커가 여러 번 쓰기 때문에
 * 픽마다 핀을 찍으면 같은 자리에 겹쳐서 하나만 눌린다.
 */
// 장소 ID로 묶는다. 구형 지도 위젯과 구글맵은 ID를 안 줘서 그때는 좌표로 묶는다.
const keyOf = (place) => place.placeId ?? `${place.lat},${place.lng}`

const places = new Map()
for (const pick of picks) {
  const key = keyOf(pick.place)
  const place = places.get(key) ?? { ...pick.place, picks: [] }
  place.picks.push(pick)
  places.set(key, place)
}

const spots = [...places.values()]

/**
 * 등급은 픽커마다 다르다. RockHer는 아홉 단계를 쓰고 정직한 청년은 매기지 않는다.
 * 그래서 색은 모든 픽이 가진 픽커로 나누고, 등급은 진하기로만 보인다.
 */
const COLORS = ['#d6336c', '#e8590c', '#1971c2', '#2f9e44', '#7048e8', '#0c8599']

const BANDS = [
  { key: 'best', label: '강추', fade: 1, grades: ['강추'] },
  { key: 'good', label: '추천', fade: 0.8, grades: ['추천'] },
  { key: 'okay', label: '보통', fade: 0.55, grades: ['괜춘', '쏘쏘', '보통', '평범', '무난'] },
  { key: 'bad', label: '별로', fade: 0.3, grades: ['그닥', '별로'] },
  { key: 'plain', label: '', fade: 0.9, grades: [] },
]

const bandOf = Object.fromEntries(
  BANDS.flatMap((band) => band.grades.map((grade) => [grade, band.key])),
)
const fadeOf = Object.fromEntries(BANDS.map((band) => [band.key, band.fade]))
const layerOf = (pick) => `${pick.picker}:${bandOf[pick.rating] ?? 'plain'}`

// 범례 숫자는 가게 수로 센다. 재방문이 많다고 많아 보이면 안 된다.
const counts = {}
for (const spot of spots) {
  for (const key of new Set(spot.picks.map(layerOf))) counts[key] = (counts[key] ?? 0) + 1
}

const legend = PICKERS.map((picker, index) => {
  const boxes = BANDS.filter((band) => counts[`${picker.id}:${band.key}`])
    .map((band) => {
      const key = `${picker.id}:${band.key}`
      return `<label><input type="checkbox" data-layer="${key}" checked>${band.label}
        <span>${counts[key]}</span></label>`
    })
    .join('')

  if (!boxes) return ''

  // 블로그가 없는 픽커는 걸 링크가 없다.
  const who = picker.url
    ? `<a href="${picker.url}" target="_blank">${picker.name}</a>`
    : `<a>${picker.name}</a>`

  return `<div class="row"><b style="color:${COLORS[index % COLORS.length]}">●</b> ${who} ${boxes}</div>`
}).join('')

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tastepicker</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  body { margin:0; font:14px/1.5 system-ui, sans-serif }
  #map { height:100vh }
  #bar { position:absolute; z-index:500; top:10px; left:60px; right:10px; max-width:640px;
         padding:8px 12px; background:#fff; border-radius:8px; box-shadow:0 1px 8px rgba(0,0,0,.25) }
  #bar .row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin:2px 0 }
  #bar .row > a { color:#212529; font-weight:600; margin-right:6px }
  #bar label { white-space:nowrap; cursor:pointer; color:#495057 }
  #bar span { color:#adb5bd }
  #who { margin-top:4px; color:#868e96; font-size:12px }
  .pop { max-height:280px; overflow-y:auto }
  .pop b { font-size:15px }
  .pop ul { margin:8px 0; padding-left:16px }
  .pop li { margin-bottom:6px; color:#495057 }
  .pop i { color:#adb5bd; font-style:normal; font-size:12px }
  .pop em { color:#1971c2; font-style:normal; font-weight:600 }
  .pop .addr { color:#868e96; font-size:12px }
</style>
<div id="bar">
  <div class="row" id="mine"></div>
  ${legend}
  <div id="who">핀을 누르면 원문으로 갑니다. 등급은 픽커마다 다릅니다.</div>
</div>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const SUPABASE = ${JSON.stringify(SUPABASE)}
const spots = ${JSON.stringify(spots)}
const bandOf = ${JSON.stringify(bandOf)}
const fadeOf = ${JSON.stringify(fadeOf)}
const colorOf = ${JSON.stringify(Object.fromEntries(PICKERS.map((p, i) => [p.id, COLORS[i % COLORS.length]])))}
const pickerName = ${JSON.stringify(Object.fromEntries(PICKERS.map((p) => [p.id, p.name])))}

const map = L.map('map')
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map)

const layers = {}
const review = pick =>
  '<li><b>' + pickerName[pick.picker] + '</b>' +
  (pick.visited ? ' <i>' + pick.visited + '</i>' : '') +
  (pick.rating ? ' <em>' + pick.rating + '</em>' : '') +
  '<br>' + (pick.note || '') +
  (pick.link ? ' <a href="' + pick.link + '" target="_blank">원문</a>' : '') + '</li>'

// 가게 이름은 픽커의 표기가 아니라 네이버 상호로 통일한다.
// 픽커마다 다르게 적어서 같은 집이 여러 곳처럼 보인다.
const popupOf = spot =>
  '<div class="pop"><b>' + (spot.name || spot.picks[0].name) + '</b>' +
  '<br><span class="addr">' + (spot.address || '') + '</span>' +
  '<ul>' + spot.picks.map(review).join('') + '</ul>' +
  '<a href="https://map.naver.com/p/entry/place/' + spot.placeId + '" target="_blank">네이버 지도</a></div>'

for (const spot of spots) {
  const popup = popupOf(spot)

  // 한 가게를 여러 픽커가 쓰면 마커도 그만큼 겹쳐 둔다. 필터를 켜고 끌 수 있어야 한다.
  for (const band of new Set(spot.picks.map(p => p.picker + ':' + (bandOf[p.rating] || 'plain')))) {
    const [picker, level] = band.split(':')
    const marker = L.circleMarker([spot.lat, spot.lng], {
      radius: 6, weight: 1.5, color: '#fff',
      fillColor: colorOf[picker], fillOpacity: fadeOf[level]
    }).bindPopup(popup)
    ;(layers[band] ||= L.layerGroup().addTo(map)).addLayer(marker)
  }
}

/**
 * 내 평가는 자주 바뀌어서 HTML에 박지 않고 열 때 받아온다.
 * 받아오기 전에도 블로그 픽은 이미 보인다. Supabase가 멈춰도 지도는 뜬다.
 */
async function loadMine() {
  const res = await fetch(SUPABASE.url + '/rest/v1/rating?select=*&order=visited.desc', {
    headers: { apikey: SUPABASE.key }
  })
  if (!res.ok) return

  const spotOf = new Map(spots.map(s => [s.placeId, s]))
  const layer = L.layerGroup().addTo(map)
  layers['juniqlim:mine'] = layer
  let count = 0

  for (const row of await res.json()) {
    const spot = spotOf.get(row.place_id)
    if (!spot) continue

    spot.picks.unshift({
      picker: 'juniqlim', name: row.place_name, note: row.note,
      rating: row.level + '점', visited: row.visited, link: null
    })
    layer.addLayer(L.circleMarker([spot.lat, spot.lng], {
      radius: 6, weight: 1.5, color: '#fff', fillColor: colorOf.juniqlim, fillOpacity: 1
    }).bindPopup(popupOf(spot)))
    count++
  }

  const row = document.getElementById('mine')
  row.innerHTML = '<b style="color:' + colorOf.juniqlim + '">●</b> <a>juniqlim</a>' +
    '<label><input type="checkbox" data-layer="juniqlim:mine" checked> <span>' + count + '</span></label>'
  bindBoxes()
}

// 고른 픽커는 이 브라우저에 남는다. 켠 것이 아니라 끈 것을 적는다.
// 그래야 픽커가 새로 들어와도 켜진 채로 보인다.
const HIDDEN = 'tastepicker:hidden'
const hidden = new Set(JSON.parse(localStorage.getItem(HIDDEN) || '[]'))

function bindBoxes() {
  for (const box of document.querySelectorAll('#bar input')) {
    const key = box.dataset.layer

    if (hidden.has(key)) {
      box.checked = false
      layers[key] && layers[key].remove()
    }

    box.onchange = () => {
      const layer = layers[key]
      box.checked ? layer.addTo(map) : layer.remove()
      box.checked ? hidden.delete(key) : hidden.add(key)
      localStorage.setItem(HIDDEN, JSON.stringify([...hidden]))
    }
  }
}

bindBoxes()
loadMine()

// 해외 픽이 섞여 있어 전체로 맞추면 세계 지도가 된다. 국내 픽 기준으로 연다.
const home = spots
  .map(s => [s.lat, s.lng])
  .filter(([lat, lng]) => lat > 33 && lat < 39 && lng > 124 && lng < 132)

map.fitBounds(home.length ? home : spots.map(s => [s.lat, s.lng]), { padding: [40, 40] })
</script>
`

const site = join(import.meta.dirname, '../public')
mkdirSync(site, { recursive: true })

const path = join(site, 'index.html')
writeFileSync(path, html)
console.log(`가게 ${spots.length}곳, 픽 ${picks.length}개 → ${path}`)
