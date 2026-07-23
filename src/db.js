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

export function openDb(path) {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)
  return db
}

/** 같은 글을 다시 넣으면 갱신한다. 픽커가 글을 고칠 수 있다. */
export function savePick(db, pick) {
  const place = pick.place ?? {}
  db.prepare(
    `INSERT INTO pick (link, picker, region, name, note, rating,
                       place_id, place_name, address, lat, lng, tel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(link) DO UPDATE SET
       picker = excluded.picker, region = excluded.region, name = excluded.name,
       note = excluded.note, rating = excluded.rating,
       place_id = excluded.place_id, place_name = excluded.place_name,
       address = excluded.address, lat = excluded.lat, lng = excluded.lng, tel = excluded.tel`,
  ).run(
    pick.link, pick.picker, pick.region, pick.name, pick.note, pick.rating,
    place.placeId ?? null, place.name ?? null, place.address ?? null,
    place.lat ?? null, place.lng ?? null, place.tel ?? null,
  )
}

/** 이미 받아둔 글. 이어서 받을 때 건너뛴다. */
export function savedLinks(db) {
  return new Set(db.prepare('SELECT link FROM pick').all().map((row) => row.link))
}

export function allPicks(db) {
  return db.prepare('SELECT * FROM pick').all().map((row) => ({
    picker: row.picker,
    region: row.region,
    name: row.name,
    note: row.note,
    rating: row.rating,
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
