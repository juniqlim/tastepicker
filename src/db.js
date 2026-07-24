import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

/**
 * 한 줄은 한 번의 방문이다. 같은 가게를 여러 번 가면 여러 줄이 된다.
 * 블로그 픽커는 글 하나가 한 방문이라 글 주소가 그대로 열쇠가 된다.
 */
const COLUMNS = `
  id         TEXT PRIMARY KEY,
  link       TEXT,
  visited    TEXT,
  picker     TEXT NOT NULL,
  region     TEXT,
  name       TEXT NOT NULL,
  note       TEXT,
  rating     TEXT,
  level      INTEGER,
  level_by   TEXT,
  place_id   TEXT,
  place_name TEXT,
  address    TEXT,
  lat        REAL,
  lng        REAL,
  tel        TEXT
`

const FIELDS = COLUMNS.trim()
  .split('\n')
  .map((line) => line.trim().split(/\s+/)[0])

const columnsOf = (db) =>
  new Set(db.prepare('PRAGMA table_info(pick)').all().map((column) => column.name))

/** 모아둔 데이터를 버리지 않고 지금 스키마로 옮긴다. */
function migrate(db) {
  const had = columnsOf(db)
  if (had.has('id')) return

  const carry = FIELDS.filter((field) => had.has(field)).join(', ')
  db.exec(`
    ALTER TABLE pick RENAME TO pick_old;
    CREATE TABLE pick (${COLUMNS});
    INSERT INTO pick (id, ${carry}) SELECT link, ${carry} FROM pick_old;
    DROP TABLE pick_old;
  `)
}

export function openDb(path) {
  const db = new DatabaseSync(path)
  db.exec(`CREATE TABLE IF NOT EXISTS pick (${COLUMNS})`)
  migrate(db)
  return db
}

const marks = FIELDS.map(() => '?').join(', ')
const updates = FIELDS.filter((field) => field !== 'id')
  .map((field) => `${field} = excluded.${field}`)
  .join(', ')

/** 같은 방문을 다시 넣으면 갱신한다. 픽커가 글을 고칠 수 있다. */
export function savePick(db, pick) {
  const place = pick.place ?? {}
  const row = {
    id: pick.id ?? pick.link,
    link: pick.link ?? null,
    visited: pick.visited ?? null,
    picker: pick.picker,
    region: pick.region ?? null,
    name: pick.name,
    note: pick.note ?? null,
    rating: pick.rating ?? null,
    level: pick.level ?? null,
    level_by: pick.levelBy ?? null,
    place_id: place.placeId ?? null,
    place_name: place.name ?? null,
    address: place.address ?? null,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    tel: place.tel ?? null,
  }

  db.prepare(
    `INSERT INTO pick (${FIELDS.join(', ')}) VALUES (${marks})
     ON CONFLICT(id) DO UPDATE SET ${updates}`,
  ).run(...FIELDS.map((field) => row[field]))
}

/** 이미 받아둔 글. 이어서 받을 때 건너뛴다. */
export function savedLinks(db) {
  return new Set(db.prepare('SELECT link FROM pick').all().map((row) => row.link))
}

/** 이미 받아둔 장소. 규칙을 고쳐 다시 해석할 때 본문을 또 받지 않으려고 쓴다. */
export function placeOf(db, link) {
  const row = db
    .prepare('SELECT place_id, place_name, address, lat, lng, tel FROM pick WHERE link = ?')
    .get(link)
  // 구형 지도 위젯과 구글맵은 좌표만 준다. 장소 ID가 없어도 받아둔 것이다.
  if (!row || row.lat === null) return undefined

  return {
    placeId: row.place_id,
    name: row.place_name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    tel: row.tel,
  }
}

/** 규칙이 바뀌어 더는 픽이 아닌 글을 지운다. */
export function dropOthers(db, picker, ids) {
  const keep = new Set(ids)
  for (const { id } of db.prepare('SELECT id FROM pick WHERE picker = ?').all(picker)) {
    if (!keep.has(id)) db.prepare('DELETE FROM pick WHERE id = ?').run(id)
  }
}

export function allPicks(db) {
  return db.prepare('SELECT * FROM pick ORDER BY visited DESC').all().map((row) => ({
    id: row.id,
    picker: row.picker,
    region: row.region,
    name: row.name,
    note: row.note,
    rating: row.rating,
    level: row.level,
    levelBy: row.level_by,
    visited: row.visited,
    link: row.link,
    place: row.lat === null ? null : {
      placeId: row.place_id,
      name: row.place_name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      tel: row.tel,
    },
  }))
}

/**
 * 담긴 픽의 지문. 새 글이 있는지 이걸로 본다.
 * SQLite 파일은 내용이 같아도 바이트가 달라져서 파일로는 알 수 없다.
 */
export function digest(db) {
  const picks = allPicks(db).sort((one, other) => (one.id < other.id ? -1 : 1))
  return createHash('sha256').update(JSON.stringify(picks)).digest('hex')
}
