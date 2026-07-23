import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS pick (
    link       TEXT PRIMARY KEY,
    picker     TEXT NOT NULL,
    region     TEXT,
    name       TEXT NOT NULL,
    note       TEXT,
    rating     TEXT,
    place_id   TEXT,
    place_name TEXT,
    address    TEXT,
    lat        REAL,
    lng        REAL,
    tel        TEXT
  )
`

/** 컬럼이 늘어도 모아둔 데이터를 버리지 않는다. */
const LATER = { level: 'INTEGER', level_by: 'TEXT' }

export function openDb(path) {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)

  const has = new Set(db.prepare('PRAGMA table_info(pick)').all().map((column) => column.name))
  for (const [column, type] of Object.entries(LATER)) {
    if (!has.has(column)) db.exec(`ALTER TABLE pick ADD COLUMN ${column} ${type}`)
  }

  return db
}

/** 같은 글을 다시 넣으면 갱신한다. 픽커가 글을 고칠 수 있다. */
export function savePick(db, pick) {
  const place = pick.place ?? {}
  db.prepare(
    `INSERT INTO pick (link, picker, region, name, note, rating, level, level_by,
                       place_id, place_name, address, lat, lng, tel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(link) DO UPDATE SET
       picker = excluded.picker, region = excluded.region, name = excluded.name,
       note = excluded.note, rating = excluded.rating,
       level = excluded.level, level_by = excluded.level_by,
       place_id = excluded.place_id, place_name = excluded.place_name,
       address = excluded.address, lat = excluded.lat, lng = excluded.lng, tel = excluded.tel`,
  ).run(
    pick.link, pick.picker, pick.region, pick.name, pick.note, pick.rating,
    pick.level ?? null, pick.levelBy ?? null,
    place.placeId ?? null, place.name ?? null, place.address ?? null,
    place.lat ?? null, place.lng ?? null, place.tel ?? null,
  )
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
  if (!row || row.place_id === null) return undefined

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
export function dropOthers(db, picker, links) {
  const keep = new Set(links)
  for (const { link } of db.prepare('SELECT link FROM pick WHERE picker = ?').all(picker)) {
    if (!keep.has(link)) db.prepare('DELETE FROM pick WHERE link = ?').run(link)
  }
}

export function allPicks(db) {
  return db.prepare('SELECT * FROM pick').all().map((row) => ({
    picker: row.picker,
    region: row.region,
    name: row.name,
    note: row.note,
    rating: row.rating,
    level: row.level,
    levelBy: row.level_by,
    link: row.link,
    place: row.place_id === null ? null : {
      placeId: row.place_id,
      name: row.place_name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      tel: row.tel,
    },
  }))
}
