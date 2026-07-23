import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS } from '../src/pickers.js'
import { openDb, allPicks } from '../src/db.js'

const db = openDb(join(import.meta.dirname, '../data/picks.db'))
const picks = allPicks(db).filter((pick) => pick.place)

/** 지도에서 알고 싶은 건 픽커가 아니라 "갈 만한가"다. 색은 평가로 나눈다. */
const BANDS = [
  { key: 'best', label: '강추', color: '#2b8a3e', grades: ['강추'] },
  { key: 'good', label: '추천', color: '#40c057', grades: ['추천'] },
  { key: 'okay', label: '보통', color: '#868e96', grades: ['괜춘', '쏘쏘', '보통', '평범', '무난'] },
  { key: 'bad', label: '별로', color: '#e03131', grades: ['그닥', '별로'] },
  { key: 'none', label: '등급 없음', color: '#1971c2', grades: [] },
]

const bandOf = Object.fromEntries(
  BANDS.flatMap((band) => band.grades.map((grade) => [grade, band.key])),
)

const nameOf = Object.fromEntries(PICKERS.map((picker) => [picker.id, picker.name]))
const counts = Object.fromEntries(BANDS.map((band) => [band.key, 0]))
for (const pick of picks) counts[bandOf[pick.rating] ?? 'none']++

const legend = BANDS.filter((band) => counts[band.key])
  .map(
    (band) => `<label><input type="checkbox" data-band="${band.key}" checked>
      <b style="color:${band.color}">●</b> ${band.label} <span>${counts[band.key]}</span></label>`,
  )
  .join('')

const pickers = PICKERS.map(
  (picker) => `<a href="${picker.url}" target="_blank">${picker.name}</a>`,
).join(' · ')

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
  #bar label { margin-right:12px; white-space:nowrap; cursor:pointer }
  #bar span { color:#868e96 }
  #who { margin-top:4px; color:#868e96; font-size:12px }
  #who a { color:#495057 }
  .pop b { font-size:15px }
  .pop .note { color:#495057 }
  .pop .addr { color:#868e96; font-size:12px }
</style>
<div id="bar">
  ${legend}
  <div id="who">픽커 ${pickers} — 핀을 누르면 원문으로 갑니다</div>
</div>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const picks = ${JSON.stringify(picks)}
const bandOf = ${JSON.stringify(bandOf)}
const color = ${JSON.stringify(Object.fromEntries(BANDS.map((b) => [b.key, b.color])))}
const pickerName = ${JSON.stringify(nameOf)}

const map = L.map('map')
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map)

const layers = {}
for (const pick of picks) {
  const band = bandOf[pick.rating] || 'none'
  const marker = L.circleMarker([pick.place.lat, pick.place.lng], {
    radius: 6, weight: 1.5, color: '#fff', fillColor: color[band], fillOpacity: .95
  }).bindPopup(
    '<div class="pop"><b>' + pick.name + '</b>' + (pick.rating ? ' · ' + pick.rating : '') +
    '<br><span class="note">' + pick.note + '</span>' +
    '<br><span class="addr">' + (pick.place.address || '') + '</span><br><br>' +
    pickerName[pick.picker] + ' — ' +
    '<a href="' + pick.link + '" target="_blank">원문</a> · ' +
    '<a href="https://map.naver.com/p/entry/place/' + pick.place.placeId + '" target="_blank">네이버 지도</a></div>'
  )
  ;(layers[band] ||= L.layerGroup().addTo(map)).addLayer(marker)
}

for (const box of document.querySelectorAll('#bar input')) {
  box.onchange = () => {
    const layer = layers[box.dataset.band]
    box.checked ? layer.addTo(map) : layer.remove()
  }
}

// 해외 픽이 섞여 있어 전체로 맞추면 세계 지도가 된다. 국내 픽 기준으로 연다.
const home = picks
  .map(p => [p.place.lat, p.place.lng])
  .filter(([lat, lng]) => lat > 33 && lat < 39 && lng > 124 && lng < 132)

map.fitBounds(home.length ? home : picks.map(p => [p.place.lat, p.place.lng]), { padding: [40, 40] })
</script>
`

const site = join(import.meta.dirname, '../public')
mkdirSync(site, { recursive: true })

const path = join(site, 'index.html')
writeFileSync(path, html)
console.log(`픽 ${picks.length}개 → ${path}`)
