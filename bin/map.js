import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PICKERS } from '../src/pickers.js'
import { toSpots, byWeight } from '../src/spots.js'
import { pickerColors } from '../src/colors.js'
import { themeButton, darkStyle, themeScript } from '../src/theme.js'
import { openDb, allPicks, closedPlaces } from '../src/db.js'

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

/**
 * 지도는 배경만 갈아 끼우는 게 아니라 API가 아예 다르다. 그래서 둘을 어댑터로 감싼다.
 * 네이버 지도는 열쇠가 있어야 부를 수 있다. 없으면 고를 것이 하나뿐이라 고르는 자리도 두지 않는다.
 */
const NAVER_KEY = process.env.NAVER_MAP_KEY ?? ''

const db = openDb(join(import.meta.dirname, '../data/picks.db'))

// 내 평가는 Supabase에 산다. 블로그 픽만 HTML에 박는다.
const picks = allPicks(db).filter((pick) => pick.place && pick.picker !== 'juniqlim')

/**
 * 핀 하나는 가게 하나다. 픽 하나가 아니다.
 * 한 가게를 여러 픽커가, 또 같은 픽커가 여러 번 쓰기 때문에
 * 픽마다 핀을 찍으면 같은 자리에 겹쳐서 하나만 눌린다.
 */
// 겹치는 집이 먼저 오게 미리 정렬해 둔다. 브라우저는 걸러내기만 하면 순서가 지켜진다.
const spots = toSpots(picks).sort(byWeight)

/**
 * 문 닫은 가게. 갈 수 없는 집이라 기본으로 감추고, 켜야 보인다.
 * 픽커의 글은 지우지 않는다. 그때 그 집에 다녀온 것은 사실이다.
 */
const gone = closedPlaces(db)
for (const spot of spots) spot.closed = gone.has(spot.placeId) || undefined

/**
 * 등급은 픽커마다 다르다. RockHer는 아홉 단계를 쓰고 정직한 청년은 매기지 않는다.
 * 그래서 색은 모든 픽이 가진 픽커로 나누고, 등급은 진하기로만 보인다.
 */
// 내 평가는 픽커와 다른 축이다. 픽커의 색을 하나 뺏어 쓸 자리가 아니라 검정으로 둔다.
const MINE = '#343a40'

const blogs = PICKERS.filter((picker) => picker.id !== 'juniqlim')
const palette = pickerColors(blogs.length)
const colorOf = {
  juniqlim: MINE,
  ...Object.fromEntries(blogs.map((picker, index) => [picker.id, palette[index]])),
}

const BANDS = [
  { key: 'best', label: '강추', fade: 1, grades: ['강추'] },
  { key: 'good', label: '추천', fade: 0.8, grades: ['추천'] },
  { key: 'okay', label: '보통', fade: 0.55, grades: ['괜춘', '쏘쏘', '보통', '평범', '무난'] },
  { key: 'bad', label: '별로', fade: 0.3, grades: ['그닥', '별로'] },
  { key: 'plain', label: '', fade: 0.9, grades: [] },
  // 대가를 받고 쓴 글. 등급과는 다른 축이지만 칸을 셋으로 늘리면 조합이 불어난다.
  // 협찬 글의 등급은 근거가 약해서, 등급 칸 대신 이 칸에 넣고 따로 켜고 끈다.
  { key: 'paid', label: '협찬', fade: 0.35, grades: [] },
]

const bandOf = Object.fromEntries(
  BANDS.flatMap((band) => band.grades.map((grade) => [grade, band.key])),
)
const fadeOf = Object.fromEntries(BANDS.map((band) => [band.key, band.fade]))
const layerOf = (pick) =>
  `${pick.picker}:${pick.sponsored ? 'paid' : bandOf[pick.rating] ?? 'plain'}`

/**
 * 없어진 가게는 픽커별로 가르지 않고 한 묶음으로 둔다.
 * 어느 픽커가 갔든 지금은 갈 수 없다는 사실이 먼저다. 색도 픽커를 벗고 회색이 된다.
 */
const GONE = { key: 'gone', color: '#adb5bd', fade: 0.55 }

// 범례 숫자는 가게 수로 센다. 재방문이 많다고 많아 보이면 안 된다.
const counts = { gone: spots.filter((spot) => spot.closed).length }
for (const spot of spots) {
  if (spot.closed) continue
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

  return `<div class="row"><b style="color:${colorOf[picker.id]}">●</b> ${who} ${boxes}</div>`
}).join('')

// 켜지 않은 채로 둔다. 갈 수 없는 집이 지도를 채우면 갈 수 있는 집이 가려진다.
const goneRow = counts.gone
  ? `<div class="row"><b style="color:${GONE.color}">●</b><a>없어진 곳</a>
      <label><input type="checkbox" data-layer="gone"><span>${counts.gone}</span></label></div>`
  : ''

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tastepicker</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  /**
   * 밤에 지도를 열면 흰 상자가 눈을 찌른다. 색은 이름으로만 쓰고 두 벌을 여기서 갈아 끼운다.
   * 기기 설정을 따르되, 눌러서 바꾼 것은 그 위에 선다.
   */
  :root {
    --box:#fff; --ink:#212529; --ink2:#495057; --dim:#868e96; --dim2:#adb5bd;
    --line:#dee2e6; --line2:#f1f3f5; --hover:#f8f9fa; --link:#1971c2;
  }
  ${darkStyle(`
    --box:#212529; --ink:#e9ecef; --ink2:#ced4da; --dim:#adb5bd; --dim2:#868e96;
    --line:#495057; --line2:#343a40; --hover:#2b3035; --link:#74c0fc;
  `)}

  body { margin:0; font:14px/1.5 system-ui, sans-serif; color-scheme:light dark }
  #map { height:100vh; background:var(--box) }
  /* 범례도 담긴 줄에 맞춘다. 픽커가 적을 때 화면을 가로로 다 먹을 이유가 없다. */
  #bar { position:absolute; z-index:500; top:10px; left:60px;
         width:max-content; max-width:calc(100vw - 80px);
         padding:8px 12px; background:var(--box); border-radius:8px; box-shadow:0 1px 8px rgba(0,0,0,.25) }
  #bar .row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin:2px 0 }
  #bar .row > a { color:var(--ink); font-weight:600; margin-right:6px }
  #bar label { white-space:nowrap; cursor:pointer; color:var(--ink2) }
  #bar span { color:var(--dim2) }
  #who { margin-top:4px; color:var(--dim); font-size:12px }
  .pop { max-height:280px; overflow-y:auto }
  .bubble { position:relative; padding:12px 30px 12px 14px; background:var(--box);
            border-radius:12px; box-shadow:0 1px 8px rgba(0,0,0,.25) }
  .bubble .x { position:absolute; top:4px; right:6px; padding:0 4px; border:0;
               background:none; color:var(--dim2); font-size:18px; line-height:1; cursor:pointer }
  .bubble .x:hover { color:var(--ink2) }
  .pop b { font-size:15px }
  .pop ul { margin:8px 0; padding-left:16px }
  .pop li { margin-bottom:6px; color:var(--ink2) }
  .pop i { color:var(--dim2); font-style:normal; font-size:12px }
  .pop em { color:var(--link); font-style:normal; font-weight:600 }
  .pop .addr { color:var(--dim); font-size:12px }
  /* 없어진 집이라는 표시. 이름 옆에 붙되 이름보다 세지 않게 둔다. */
  .gone { padding:0 4px; border-radius:3px; background:var(--line2);
          color:var(--dim); font-size:11px; font-weight:600; vertical-align:1px }
  #bar select { font:inherit; padding:2px 4px; border:1px solid var(--line); border-radius:4px }
  #bar button { width:18px; height:18px; padding:0; border:1px solid var(--line); border-radius:4px;
                background:var(--box); color:var(--dim); font-size:10px; line-height:1; cursor:pointer }
  #pickers.off { display:none }
  /* 접으면 켤 것도 끌 것도 안 보인다. 모두 끄는 단추도 같이 접는다. */
  #bar:has(#pickers.off) #all { display:none }
  /* 폭도 높이도 담긴 줄에 맞춘다. 몇 곳 없을 때 빈자리를 차지할 이유가 없다. */
  /* 좁은 화면에서는 목록이 지도를 다 덮는다. 지도가 반은 남게 잡아 둔다. */
  #list { position:absolute; z-index:500; top:10px; right:10px;
          width:max-content; min-width:180px; max-width:min(320px, 62vw);
          max-height:calc(100vh - 20px);
          background:var(--box); border-radius:8px; box-shadow:0 1px 8px rgba(0,0,0,.25);
          overflow-y:auto; padding:10px 12px }
  /* 접으면 단추만 남는다. 다 숨기면 다시 펼 길이 없다. */
  #list.off { min-width:0; padding:6px }
  #list.off #listBody, #list.off #findbox { display:none }
  /* 접는 단추는 찾는 칸과 한 줄에 선다. 줄을 따로 내주면 그만큼 지도가 줄어든다. */
  #listTop { display:flex; align-items:center; gap:6px; margin-bottom:8px }
  #list.off #listTop { margin:0 }
  #foldList { flex:none; width:18px; height:18px; padding:0;
              border:1px solid var(--line); border-radius:4px; background:var(--box); color:var(--dim);
              font-size:10px; line-height:1; cursor:pointer }
  #list h3 { margin:0 0 8px; font-size:14px }
  #findbox { position:relative; flex:1 }
  #find { width:100%; box-sizing:border-box; font:inherit;
          padding:4px 24px 4px 6px; border:1px solid var(--line); border-radius:4px;
          background:var(--box); color:var(--ink) }
  #bar select { background:var(--box); color:var(--ink) }
  /* 지우는 단추는 적었을 때만 나온다. 빈 칸에 지울 것은 없다. */
  #clear { position:absolute; top:50%; right:4px; transform:translateY(-50%); display:none;
           padding:0 4px; border:0; background:none; color:var(--dim2); font-size:16px;
           line-height:1; cursor:pointer }
  #clear:hover { color:var(--ink2) }
  #clear.on { display:block }
  #list a { display:block; padding:6px 0; border-top:1px solid var(--line2); color:var(--ink);
            text-decoration:none; cursor:pointer }
  #list a:hover { background:var(--hover) }
  #list .note { color:var(--dim); font-size:12px }
</style>
<div id="bar">
  <div class="row"><a>픽커</a>
    <button id="here" type="button" title="내가 있는 데로">◎</button>
    <button id="fold" type="button" title="접기">▾</button>
    <button id="all" type="button" title="모두 끄기">☑</button>
    ${themeButton}
  </div>
  <div id="pickers">
    <div class="row" id="mine"></div>
    ${legend}
    ${goneRow}
    ${NAVER_KEY ? `<div class="row">
      <a>지도</a>
      <select id="engine">
        <option value="osm">OpenStreetMap</option>
        <option value="naver">네이버 지도</option>
      </select>
    </div>` : ''}
    <div id="who"><a href="/list" style="color:#1971c2">목록으로 →</a></div>
  </div>
</div>
<div id="list">
  <div id="listTop">
    <button id="foldList" type="button" title="접기">▸</button>
    <div id="findbox">
      <input id="find" placeholder="가게 이름으로 찾기" autocomplete="off">
      <button id="clear" type="button" title="지우기">×</button>
    </div>
  </div>
  <div id="listBody">
    <h3 id="head"></h3>
    <div id="rows"></div>
  </div>
</div>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
${NAVER_KEY ? `<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_KEY}"></script>` : ''}
<script>
const SUPABASE = ${JSON.stringify(SUPABASE)}
const spots = ${JSON.stringify(spots)}
const bandOf = ${JSON.stringify(bandOf)}
const fadeOf = ${JSON.stringify(fadeOf)}
const GONE = ${JSON.stringify(GONE)}
// 픽이 어느 칸에 드는지 세는 쪽과 그리는 쪽이 달라선 안 된다. 함수를 그대로 옮겨 심는다.
const layerOf = ${layerOf}
const colorOf = ${JSON.stringify(colorOf)}
const pickerName = ${JSON.stringify(Object.fromEntries(PICKERS.map((p) => [p.id, p.name])))}

/**
 * 지도는 배경만 다른 게 아니라 API가 아예 다르다. 쓰는 것만 같은 이름으로 감싼다.
 * 켜고 끄는 단위는 마커 묶음 하나다. 픽커의 등급 하나가 묶음 하나다.
 */
// 말풍선은 핀 위로 열린다. 핀을 화면 가운데 두면 왼쪽 위 상자에 가려서, 그만큼 아래로 내려 둔다.
const LIFT = 220

const dot = (color, fade) =>
  '<div style="width:13px;height:13px;border-radius:50%;border:1.5px solid #fff;' +
  'background:' + color + ';opacity:' + fade + '"></div>'

const maps = {
  osm() {
    const map = L.map('map')

    // 어두울 때는 배경도 어두운 것으로 간다. 밝은 지도 위의 어두운 상자는 더 눈에 띈다.
    const TILES = {
      light: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      dark: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    }
    const tiles = L.tileLayer(TILES.light, {
      attribution: '© OpenStreetMap · 어두운 배경 © CARTO'
    }).addTo(map)

    return {
      theme: dark => tiles.setUrl(dark ? TILES.dark : TILES.light),
      group() {
        const group = L.layerGroup().addTo(map)
        return {
          show: () => group.addTo(map),
          hide: () => group.remove(),
          add(pin) {
            const marker = L.circleMarker([pin.lat, pin.lng], {
              radius: 6, weight: 1.5, color: '#fff',
              fillColor: pin.color, fillOpacity: pin.fade
            }).bindPopup(pin.popup)
            group.addLayer(marker)

            return {
              open() {
                map.setView([pin.lat, pin.lng], 17)
                map.panBy([0, -LIFT], { animate: false })
                marker.openPopup()
              }
            }
          }
        }
      },
      fitBounds: coords => map.fitBounds(coords, { padding: [40, 40] }),
      setView: (lat, lng, zoom) => map.setView([lat, lng], zoom),
      has: (lat, lng) => map.getBounds().contains([lat, lng]),
      onStill: run => map.on('moveend', run)
    }
  },

  naver() {
    const map = new naver.maps.Map('map')

    /**
     * 말풍선은 하나만 두고 내용을 갈아 끼운다. 여럿을 띄우면 겹쳐서 못 읽는다.
     * 네이버가 주는 모양은 각지고 닫을 데도 없어서, 껍데기를 비우고 안을 직접 그린다.
     * 두 지도에서 같은 말풍선으로 보여야 한다. 지도를 바꿨다고 다른 화면처럼 보이면 안 된다.
     */
    const bubble = new naver.maps.InfoWindow({
      maxWidth: 320, backgroundColor: 'transparent', borderWidth: 0,
      anchorColor: '#fff', pixelOffset: new naver.maps.Point(0, -4)
    })
    window.closeBubble = () => bubble.close()

    // 빈 데를 누르면 닫는다. 닫는 단추를 찾아 누르게 할 일이 아니다.
    naver.maps.Event.addListener(map, 'click', () => bubble.close())

    /**
     * 네이버 마커는 하나가 DOM 하나다. 만 개를 붙이면 지도가 버벅인다.
     * 그래서 화면에 든 것만, 그것도 겹치는 집부터 이만큼만 붙이고 나머지는 뗀다.
     * 핀을 지우는 게 아니라 다가가면 다시 붙는다. 옆 목록이 200곳만 세우는 것과 같은 사정이다.
     */
    const LIMIT = 1200
    // 겹치는 집 순으로 쌓인다. 앞이 더 두꺼운 집이라 화면이 붐빌 때 먼저 살아남는다.
    const pins = []

    const attach = (pin) => {
      if (!pin.marker) {
        pin.marker = new naver.maps.Marker({
          position: pin.at,
          icon: { content: dot(pin.color, pin.fade), anchor: new naver.maps.Point(7, 7) }
        })
        naver.maps.Event.addListener(pin.marker, 'click', () => pop(pin))
      }
      pin.marker.getMap() || pin.marker.setMap(map)
    }

    const pop = (pin) => {
      attach(pin)
      bubble.setContent(
        '<div class="bubble"><button class="x" type="button" onclick="closeBubble()">×</button>' +
        pin.popup + '</div>')
      bubble.open(map, pin.marker)
    }

    /**
     * 멀리서 보면 핀이 서로 포개진다. 포개진 핀은 붙여도 보이지 않는데 값은 다 치른다.
     * 그래서 화면을 핀 크기의 칸으로 나눠 한 칸에 하나만 붙인다. 다가가면 칸이 벌어져 다 보인다.
     */
    const GRID = 14

    const draw = () => {
      const box = map.getBounds()
      const sw = box.getSW()
      const ne = box.getNE()
      const size = map.getSize()
      const taken = new Set()
      let drawn = 0

      // 앞이 겹치는 집이라, 한 칸에서 살아남는 것도 그쪽이다.
      const cellOf = (at) =>
        Math.floor((at.lng() - sw.lng()) / (ne.lng() - sw.lng()) * size.width / GRID) + ',' +
        Math.floor((at.lat() - sw.lat()) / (ne.lat() - sw.lat()) * size.height / GRID)

      for (const pin of pins) {
        const cell = pin.on && drawn < LIMIT && box.hasLatLng(pin.at) ? cellOf(pin.at) : null

        if (cell !== null && !taken.has(cell)) {
          taken.add(cell)
          attach(pin)
          drawn++
        } else if (pin.marker) {
          pin.marker.setMap(null)
        }
      }
    }
    naver.maps.Event.addListener(map, 'idle', draw)

    return {
      // 네이버는 어두운 배경을 내주지 않는다. 상자만 어두워진다.
      theme: () => {},
      group() {
        const mine = []

        return {
          show() { for (const pin of mine) pin.on = true; draw() },
          // 끈 자리만큼 상한이 남아서 못 붙던 핀이 붙을 수 있다. 그래서 다시 그린다.
          hide() {
            for (const pin of mine) {
              pin.on = false
              pin.marker && pin.marker.setMap(null)
            }
            draw()
          },
          add(spec) {
            const pin = {
              at: new naver.maps.LatLng(spec.lat, spec.lng),
              color: spec.color, fade: spec.fade, popup: spec.popup,
              on: true, marker: null,
            }
            pins.push(pin)
            mine.push(pin)

            return {
              open() {
                map.setCenter(pin.at)
                map.setZoom(17)
                map.panBy(new naver.maps.Point(0, -LIFT))
                pop(pin)
              }
            }
          }
        }
      },
      fitBounds(coords) {
        const box = new naver.maps.LatLngBounds()
        for (const [lat, lng] of coords) box.extend(new naver.maps.LatLng(lat, lng))
        map.fitBounds(box, { top: 40, right: 40, bottom: 40, left: 40 })
        draw()
      },
      setView(lat, lng, zoom) {
        map.setCenter(new naver.maps.LatLng(lat, lng))
        map.setZoom(zoom)
        draw()
      },
      has: (lat, lng) => map.getBounds().hasLatLng(new naver.maps.LatLng(lat, lng)),
      onStill: run => naver.maps.Event.addListener(map, 'idle', run)
    }
  }
}

// 고른 지도는 이 브라우저에 남는다. 열쇠가 없으면 네이버는 아예 고를 수 없다.
const ENGINES = ${JSON.stringify(NAVER_KEY ? ['osm', 'naver'] : ['osm'])}
const ENGINE = 'tastepicker:engine'
const engine = ENGINES.includes(localStorage.getItem(ENGINE)) ? localStorage.getItem(ENGINE) : 'osm'
const map = maps[engine]()

const pickEngine = document.getElementById('engine')
if (pickEngine) {
  pickEngine.value = engine
  // 지도를 바꾸면 마커도 말풍선도 다 다시 만들어야 해서 그냥 다시 연다.
  pickEngine.onchange = () => {
    localStorage.setItem(ENGINE, pickEngine.value)
    location.reload()
  }
}

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
  // 없어진 집은 먼저 알린다. 한줄평을 다 읽고 찾아갔다가 헛걸음하면 안 된다.
  (spot.closed ? ' <b class="gone">없어짐</b>' : '') +
  '<br><span class="addr">' + (spot.address || '') + '</span>' +
  '<ul>' + spot.picks.map(review).join('') + '</ul>' +
  // 없어진 집은 네이버 지도에도 없다. 눌러 봐야 빈 화면이라 링크를 걸지 않는다.
  (spot.closed ? '' :
    '<a href="https://map.naver.com/p/entry/place/' + spot.placeId + '" target="_blank">네이버 지도</a>') +
  '</div>'

// 목록에서 가게를 고르면 그 핀을 열어야 해서 가게마다 마커를 기억해 둔다.
// 한 가게에 마커가 여럿이다. 어느 픽커를 껐는지에 따라 열 수 있는 마커가 달라진다.
const markersOf = new Map()

for (const spot of spots) {
  const popup = popupOf(spot)

  // 없어진 집은 픽커를 가리지 않고 한 묶음에 넣는다. 누가 갔든 지금은 갈 수 없다.
  const bands = spot.closed
    ? [GONE.key]
    : [...new Set(spot.picks.map(layerOf))]

  // 한 가게를 여러 픽커가 쓰면 마커도 그만큼 겹쳐 둔다. 필터를 켜고 끌 수 있어야 한다.
  for (const band of bands) {
    const [picker, level] = band.split(':')
    const marker = (layers[band] ||= map.group()).add({
      lat: spot.lat, lng: spot.lng, popup,
      color: spot.closed ? GONE.color : colorOf[picker],
      fade: spot.closed ? GONE.fade : fadeOf[level]
    })
    markersOf.has(spot) || markersOf.set(spot, [])
    markersOf.get(spot).push({ band, marker })
  }
}

/** 꺼진 픽커의 핀은 열어도 말풍선이 안 뜬다. 켜져 있는 핀을 찾아 연다. */
function openSpot(spot) {
  const on = (markersOf.get(spot) || []).find(one => !hidden.has(one.band))
  on && on.marker.open()
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
  const layer = map.group()
  layers['juniqlim:mine'] = layer
  let count = 0

  for (const row of await res.json()) {
    const spot = spotOf.get(row.place_id)
    if (!spot) continue

    spot.picks.unshift({
      picker: 'juniqlim', name: row.place_name, note: row.note,
      rating: row.level + '점', visited: row.visited, link: null
    })
    layer.add({
      lat: spot.lat, lng: spot.lng, popup: popupOf(spot),
      color: colorOf.juniqlim, fade: 1
    })
    count++
  }

  const row = document.getElementById('mine')
  row.innerHTML = '<b style="color:' + colorOf.juniqlim + '">●</b> <a>juniqlim</a>' +
    '<label><input type="checkbox" data-layer="juniqlim:mine" checked> <span>' + count + '</span></label>'
  bindBoxes()
  // 내 평가가 붙으면 목록의 픽커 이름도 달라진다.
  drawList()
}

// 고른 픽커는 이 브라우저에 남는다. 켠 것이 아니라 끈 것을 적는다.
// 그래야 픽커가 새로 들어와도 켜진 채로 보인다.
const HIDDEN = 'tastepicker:hidden'
const hidden = new Set(JSON.parse(localStorage.getItem(HIDDEN) || '[]'))

function bindBoxes() {
  for (const box of document.querySelectorAll('#pickers input')) {
    const key = box.dataset.layer

    // 적어 둔 것이 있으면 그걸 따르고, 없으면 화면이 정한 기본을 적어 둔다.
    // 없어진 곳은 꺼진 채로 나오는데, 적어 두지 않으면 핀만 남고 상자와 어긋난다.
    if (hidden.has(key)) box.checked = false
    else if (!box.checked) hidden.add(key)

    if (!box.checked) layers[key] && layers[key].hide()

    box.onchange = () => {
      const layer = layers[key]
      box.checked ? layer.show() : layer.hide()
      box.checked ? hidden.delete(key) : hidden.add(key)
      localStorage.setItem(HIDDEN, JSON.stringify([...hidden]))
      showAll()
      drawList()
    }
  }
}

/**
 * 픽커가 여덟이라 하나씩 끄면 손이 많이 간다. 한 픽커만 보려면 다 끄고 하나만 켜는 쪽이 빠르다.
 * 단추는 하나만 둔다. 다 켜져 있으면 끄고, 하나라도 꺼져 있으면 다 켠다.
 */
const toggleAll = document.getElementById('all')
const boxes = () => [...document.querySelectorAll('#pickers input')]

// 기호는 지금 상태를 보인다. 누르면 어떻게 되는지는 이름표에 적는다.
function showAll() {
  const on = boxes().every(box => box.checked)
  toggleAll.textContent = on ? '☑' : '☐'
  toggleAll.title = on ? '모두 끄기' : '모두 켜기'
}

const setAll = (on) => {
  for (const box of boxes()) {
    const key = box.dataset.layer
    box.checked = on
    on ? hidden.delete(key) : hidden.add(key)
    layers[key] && (on ? layers[key].show() : layers[key].hide())
  }

  localStorage.setItem(HIDDEN, JSON.stringify([...hidden]))
  showAll()
  drawList()
}

toggleAll.onclick = () => setAll(!boxes().every(box => box.checked))

bindBoxes()
showAll()
// 내 평가는 아직 보이지 않게 둔다. 가게를 더 골라 담은 뒤에 켠다.
// loadMine()

/**
 * 목록은 지금 화면에 찍힌 핀을 그대로 옮긴다. 지도를 옮기면 목록도 따라온다.
 * 핀을 끈 픽커의 가게는 목록에서도 뺀다. 핀은 없는데 목록에 남으면 두 화면이 어긋난다.
 */
const listBox = document.getElementById('list')
const head = document.getElementById('head')
const rows = document.getElementById('rows')
const find = document.getElementById('find')

// 없어진 집은 픽커가 아니라 한 묶음으로 켜고 끈다. 핀과 목록이 어긋나면 안 된다.
const onMap = spot => spot.closed
  ? !hidden.has(GONE.key)
  : spot.picks.some(pick => pick.picker !== 'juniqlim' && !hidden.has(layerOf(pick)))

// 픽커마다 가게를 달리 적는다. 어느 표기로 찾아도 걸리게 다 본다.
const namesOf = spot => [spot.name, ...spot.picks.map(pick => pick.name)].join(' ').toLowerCase()

function drawList() {
  if (listBox.classList.contains('off')) return

  const query = find.value.trim().toLowerCase()

  /**
   * 이름으로 찾을 때는 화면에 매이지 않는다. 이름을 아는 사람은 그 집이 어디 있는지 모른다.
   * spots 는 겹치는 집 순으로 이미 정렬돼 있다. 걸러내도 순서는 지켜진다.
   */
  const found = spots.filter(spot => onMap(spot) &&
    (query ? namesOf(spot).includes(query) : map.has(spot.lat, spot.lng)))

  head.innerHTML = (query ? '찾은 가게' : '이 화면') +
    ' <span style="color:#adb5bd">' + found.length + '곳</span>'
  rows.innerHTML = ''

  for (const spot of found.slice(0, 200)) {
    const item = document.createElement('a')
    item.innerHTML = '<b>' + (spot.name || spot.picks[0].name) + '</b>' +
      (spot.closed ? ' <b class="gone">없어짐</b>' : '') +
      '<div class="note">' + [...new Set(spot.picks.map(p => pickerName[p.picker]))].join(', ') +
      (spot.picks.length > 1 ? ' · ' + spot.picks.length + '번' : '') + '</div>'
    item.onclick = () => openSpot(spot)
    rows.append(item)
  }

  // 다 그리면 무겁다. 겹치는 집부터 보여주고 나머지는 좁혀서 보게 둔다.
  if (found.length > 200) {
    rows.insertAdjacentHTML('beforeend',
      '<div class="note" style="padding:8px 0">겹치는 집부터 200곳만 보입니다. ' +
      (query ? '이름을 더 적어 보세요.' : '더 다가가면 다 보입니다.') + '</div>')
  }
}

const clear = document.getElementById('clear')

find.oninput = () => {
  clear.classList.toggle('on', !!find.value)
  drawList()
}

// 지우면 다시 이 화면의 가게로 돌아온다.
clear.onclick = () => {
  find.value = ''
  clear.classList.remove('on')
  drawList()
  find.focus()
}

/**
 * 두 상자가 화면을 많이 먹는다. 접어 두고 쓸 수 있게 한다.
 * 폰은 상자 둘이 지도를 거의 다 덮어서, 처음 열 때는 접어 둔다.
 * 접었는지는 브라우저에 남는다. 매번 접게 하면 접는 뜻이 없다.
 */
const PHONE = matchMedia('(max-width: 640px)').matches
const foldedAt = (key) => {
  const kept = localStorage.getItem(key)
  return kept === null ? PHONE : kept === 'on'
}

// 화살표만 둔다. 어느 쪽으로 열리는지 보이면 글자는 없어도 안다.
const foldable = (key, box, button, arrows) => {
  const show = (folded) => {
    box.classList.toggle('off', folded)
    button.textContent = folded ? arrows[1] : arrows[0]
    button.title = folded ? '펴기' : '접기'
  }

  button.onclick = () => {
    const folded = !box.classList.contains('off')
    localStorage.setItem(key, folded ? 'on' : 'off')
    show(folded)
    drawList()
  }

  show(foldedAt(key))
}

${themeScript('map.theme(dark)')}

foldable('tastepicker:fold', document.getElementById('pickers'),
  document.getElementById('fold'), ['▾', '▸'])

foldable('tastepicker:list', listBox,
  document.getElementById('foldList'), ['▸', '◂'])

map.onStill(drawList)

// 해외 픽이 섞여 있어 전체로 맞추면 세계 지도가 된다. 국내 픽 기준으로 연다.
const inHome = (lat, lng) => lat > 33 && lat < 39 && lng > 124 && lng < 132
const home = spots.filter(s => inHome(s.lat, s.lng)).map(s => [s.lat, s.lng])

// 지도를 옮기면 목록도 함께 세운다. 지도가 멈췄다는 기별을 기다리면 첫 화면만 빈 목록으로 남는다.
const fitHome = () => {
  map.fitBounds(home.length ? home : spots.map(s => [s.lat, s.lng]))
  drawList()
}

/**
 * 있는 데서 가까운 집부터 보여준다. 전국을 펼쳐 봐야 어디를 갈지는 정해지지 않는다.
 * 네이버 지도는 핀 하나가 DOM 하나라 전국을 펼치면 천이백 개를 붙이느라 한참 멈춘다.
 * 동네 하나면 백 개 남짓이라 바로 뜬다.
 */
const NEARBY = 16

// 픽이 없는 데서 열면 빈 화면이 된다. 해외에 있으면 그냥 전국을 편다.
const goHere = ({ coords }) => {
  if (!inHome(coords.latitude, coords.longitude)) return fitHome()

  map.setView(coords.latitude, coords.longitude, NEARBY)
  drawList()
}

// 물어보고 답이 없으면 기다리지 않는다. 대답할 마음이 없는 사람을 붙잡아 둘 이유가 없다.
const WAIT = 1500
const askHere = (found, gaveUp) =>
  navigator.geolocation.getCurrentPosition(found, gaveUp, { timeout: WAIT, maximumAge: 600000 })

// 지도를 한참 옮기고 나면 있는 데로 돌아올 길이 필요하다.
document.getElementById('here').onclick = () =>
  navigator.geolocation ? askHere(goHere, () => {}) : fitHome()

if (navigator.geolocation) {
  let answered = false
  const answer = (run) => { answered || (answered = true, run()) }
  const later = setTimeout(() => answer(fitHome), WAIT)

  // 물어보길 거절해도 지도는 떠야 한다.
  askHere(
    (at) => answer(() => { clearTimeout(later); goHere(at) }),
    () => answer(() => { clearTimeout(later); fitHome() }),
  )
} else {
  fitHome()
}
</script>
`

const site = join(import.meta.dirname, '../public')
mkdirSync(site, { recursive: true })

const path = join(site, 'index.html')
writeFileSync(path, html)
console.log(`가게 ${spots.length}곳, 픽 ${picks.length}개 → ${path}`)
