import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS } from '../src/pickers.js'
import { openDb, allPicks } from '../src/db.js'

const db = openDb(join(import.meta.dirname, '../data/picks.db'))
const picks = allPicks(db).filter((pick) => pick.place)

/**
 * 등급은 픽커마다 다르다. RockHer는 아홉 단계를 쓰고 정직한 청년은 매기지 않는다.
 * 그래서 색은 모든 픽이 가진 픽커로 나누고, 등급은 진하기로만 보인다.
 */
const COLORS = ['#e8590c', '#1971c2']

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

const counts = {}
for (const pick of picks) counts[layerOf(pick)] = (counts[layerOf(pick)] ?? 0) + 1

const legend = PICKERS.map((picker, index) => {
  const boxes = BANDS.filter((band) => counts[`${picker.id}:${band.key}`])
    .map((band) => {
      const key = `${picker.id}:${band.key}`
      return `<label><input type="checkbox" data-layer="${key}" checked>${band.label}
        <span>${counts[key]}</span></label>`
    })
    .join('')

  return `<div class="row"><b style="color:${COLORS[index % COLORS.length]}">●</b>
    <a href="${picker.url}" target="_blank">${picker.name}</a> ${boxes}</div>`
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
  .pop b { font-size:15px }
  .pop .note { color:#495057 }
  .pop .addr { color:#868e96; font-size:12px }
</style>
<div id="bar">
  ${legend}
  <div id="who">핀을 누르면 원문으로 갑니다. 등급은 픽커마다 다릅니다.</div>
</div>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const picks = ${JSON.stringify(picks)}
const bandOf = ${JSON.stringify(bandOf)}
const fadeOf = ${JSON.stringify(fadeOf)}
const colorOf = ${JSON.stringify(Object.fromEntries(PICKERS.map((p, i) => [p.id, COLORS[i % COLORS.length]])))}
const pickerName = ${JSON.stringify(Object.fromEntries(PICKERS.map((p) => [p.id, p.name])))}

const map = L.map('map')
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map)

const layers = {}
for (const pick of picks) {
  const band = bandOf[pick.rating] || 'plain'
  const marker = L.circleMarker([pick.place.lat, pick.place.lng], {
    radius: 6, weight: 1.5, color: '#fff',
    fillColor: colorOf[pick.picker], fillOpacity: fadeOf[band]
  }).bindPopup(
    '<div class="pop"><b>' + pick.name + '</b>' + (pick.rating ? ' · ' + pick.rating : '') +
    '<br><span class="note">' + pick.note + '</span>' +
    '<br><span class="addr">' + (pick.place.address || '') + '</span><br><br>' +
    pickerName[pick.picker] + ' — ' +
    '<a href="' + pick.link + '" target="_blank">원문</a> · ' +
    '<a href="https://map.naver.com/p/entry/place/' + pick.place.placeId + '" target="_blank">네이버 지도</a></div>'
  )
  const key = pick.picker + ':' + band
  ;(layers[key] ||= L.layerGroup().addTo(map)).addLayer(marker)
}

for (const box of document.querySelectorAll('#bar input')) {
  box.onchange = () => {
    const layer = layers[box.dataset.layer]
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
