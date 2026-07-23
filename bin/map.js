import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS } from '../src/pickers.js'

const data = join(import.meta.dirname, '../data')
const picks = JSON.parse(readFileSync(join(data, 'picks.json'), 'utf-8')).filter((p) => p.place)

const COLORS = ['#e8590c', '#1971c2']
const nameOf = Object.fromEntries(PICKERS.map((p) => [p.id, p.name]))
const colorOf = Object.fromEntries(PICKERS.map((p, i) => [p.id, COLORS[i % COLORS.length]]))

const legend = PICKERS.map(
  (p) => `<a href="${p.url}" target="_blank" style="color:${colorOf[p.id]}">● ${p.name}</a>`,
).join(' ')

const html = `<!doctype html>
<meta charset="utf-8">
<title>tastepicker</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  body { margin:0; font:14px/1.5 system-ui, sans-serif }
  #map { height:100vh }
  #bar { position:absolute; z-index:500; top:10px; left:60px; padding:8px 14px;
         background:#fff; border-radius:6px; box-shadow:0 1px 6px rgba(0,0,0,.3) }
  #bar a { text-decoration:none; margin-right:10px; font-weight:600 }
  .note { color:#555 }
  .addr { color:#888; font-size:12px }
</style>
<div id="bar">픽 ${picks.length}개 &nbsp; ${legend}</div>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const picks = ${JSON.stringify(picks)}
const pickerName = ${JSON.stringify(nameOf)}
const pickerColor = ${JSON.stringify(colorOf)}

const map = L.map('map')
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map)

for (const pick of picks) {
  const rating = pick.rating ? '[' + pick.rating + '] ' : ''
  L.circleMarker([pick.place.lat, pick.place.lng], {
    radius: 7, weight: 2, color: '#fff', fillColor: pickerColor[pick.picker], fillOpacity: 1
  }).addTo(map).bindPopup(
    '<b>' + pick.name + '</b><br>' +
    '<span class="note">' + rating + pick.note + '</span><br>' +
    '<span class="addr">' + pick.place.address + '</span><br><br>' +
    pickerName[pick.picker] + ' — <a href="' + pick.link + '" target="_blank">원문</a> · ' +
    '<a href="https://map.naver.com/p/entry/place/' + pick.place.placeId + '" target="_blank">네이버 지도</a>'
  )
}

map.fitBounds(picks.map(p => [p.place.lat, p.place.lng]), { padding: [40, 40] })
</script>
`

const site = join(import.meta.dirname, '../public')
mkdirSync(site, { recursive: true })

const path = join(site, 'index.html')
writeFileSync(path, html)
console.log(`픽 ${picks.length}개 → ${path}`)
