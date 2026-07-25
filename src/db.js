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
  tel        TEXT,
  sponsored  INTEGER
`

const FIELDS = COLUMNS.trim()
  .split('\n')
  .map((line) => line.trim().split(/\s+/)[0])

const columnsOf = (db) =>
  new Set(db.prepare('PRAGMA table_info(pick)').all().map((column) => column.name))

/** 모아둔 데이터를 버리지 않고 지금 스키마로 옮긴다. */
function migrate(db) {
  const had = columnsOf(db)

  if (!had.has('id')) {
    const carry = FIELDS.filter((field) => had.has(field)).join(', ')
    db.exec(`
      ALTER TABLE pick RENAME TO pick_old;
      CREATE TABLE pick (${COLUMNS});
      INSERT INTO pick (id, ${carry}) SELECT link, ${carry} FROM pick_old;
      DROP TABLE pick_old;
    `)
    return
  }

  // 칸이 늘어나면 붙인다. 갓 붙은 칸은 비어 있고, 글을 다시 받을 때 채워진다.
  for (const field of FIELDS) {
    if (!had.has(field)) db.exec(`ALTER TABLE pick ADD COLUMN ${field}`)
  }
}

export function openDb(path) {
  const db = new DatabaseSync(path)
  // 픽커를 여러 명 따로 돌릴 수 있다. 남이 쓰는 중이면 기다렸다 쓴다.
  // 글 하나 받는 데 몇 초씩 걸려서 겹칠 일은 드물고, 기다리면 지나간다.
  db.exec('PRAGMA busy_timeout = 30000')
  db.exec(`CREATE TABLE IF NOT EXISTS pick (${COLUMNS})`)
  migrate(db)
  return db
}

const marks = FIELDS.map(() => '?').join(', ')
const updates = FIELDS.filter((field) => field !== 'id')
  .map((field) =>
    // 장소를 받아둔 글은 본문을 다시 받지 않아 대가 여부가 비어 온다. 담아둔 판정을 지킨다.
    field === 'sponsored'
      ? 'sponsored = COALESCE(excluded.sponsored, pick.sponsored)'
      : `${field} = excluded.${field}`,
  )
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
    // 아직 본문을 안 살펴본 글은 비워 둔다. 대가가 아니라고 본 것과는 다르다.
    sponsored: pick.sponsored === undefined || pick.sponsored === null
      ? null
      : Number(pick.sponsored),
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
    sponsored: row.sponsored === null ? null : Boolean(row.sponsored),
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
