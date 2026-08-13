const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

const isDev = !app.isPackaged;

let db = null;
let currentDbPath = null;

function getDefaultDataDir() {
  return isDev ? path.join(__dirname, '../data') : app.getPath('userData');
}

function initDb(dataDir) {
  if (db) {
    try { db.close(); } catch(e) {}
    db = null;
  }

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  currentDbPath = path.join(dataDir, 'bandaid.db');

  db = new Database(currentDbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, artist TEXT, composer TEXT, conductor TEXT,
      orchestra TEXT, catalogue_no TEXT, period TEXT, year INTEGER,
      genre TEXT, subgenre TEXT, is_classical INTEGER DEFAULT 0,
      country_code TEXT, label_country TEXT, mbid TEXT UNIQUE,
      cover_url TEXT, duration_sec INTEGER, track_count INTEGER,
      added_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_data (
      album_id INTEGER PRIMARY KEY, status TEXT DEFAULT 'unheard',
      rating INTEGER, notes TEXT, date_heard TEXT,
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS blocked_regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region_name TEXT UNIQUE, country_codes TEXT
    );
    CREATE TABLE IF NOT EXISTS import_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_line TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      parsed_artist TEXT,
      parsed_title TEXT,
      parsed_year INTEGER,
      parsed_genre TEXT,
      parsed_status TEXT DEFAULT 'unheard',
      parsed_notes TEXT,
      error TEXT,
      added_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // MIGRATIONS
  try { db.exec("ALTER TABLE import_queue ADD COLUMN parsed_status TEXT DEFAULT 'unheard'"); } catch (e) {}
  try { db.exec("ALTER TABLE import_queue ADD COLUMN parsed_notes TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE albums ADD COLUMN format TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE albums ADD COLUMN label TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE albums ADD COLUMN discogs_url TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE import_queue ADD COLUMN next_retry_at TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE import_queue ADD COLUMN parsed_conductor TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE import_queue ADD COLUMN parsed_orchestra TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE user_data ADD COLUMN play_count INTEGER DEFAULT 0"); } catch(e) {}
  try { db.exec("ALTER TABLE albums ADD COLUMN discogs_master_id INTEGER"); } catch(e) {}
  try { db.exec("ALTER TABLE albums ADD COLUMN cover_url_custom TEXT"); } catch(e) {}

  return currentDbPath;
}

function getDb() {
  if (!db) initDb(getDefaultDataDir());
  return db;
}

function getCurrentDbPath() {
  return currentDbPath;
}

function getDefaultDataDirExport() {
  return getDefaultDataDir();
}

// Migrate existing DB to a new directory
function migrateToDir(newDir) {
  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
  const newDbPath = path.join(newDir, 'bandaid.db');

  // If current DB exists, copy it to the new location
  if (currentDbPath && fs.existsSync(currentDbPath) && currentDbPath !== newDbPath) {
    if (db) { try { db.close(); } catch(e) {} db = null; }
    fs.copyFileSync(currentDbPath, newDbPath);
    // Remove old db only if it was in default userData location (not dev data dir)
    if (!isDev && currentDbPath.includes(app.getPath('userData'))) {
      try { fs.unlinkSync(currentDbPath); } catch(e) {}
    }
  }

  initDb(newDir);
  return newDbPath;
}

// Boot: check if user has chosen a custom data dir, use it if so
function boot() {
  // We need to init with default first to read the setting
  initDb(getDefaultDataDir());
  const customDir = db.prepare("SELECT value FROM app_settings WHERE key = 'data_dir'").get()?.value;
  if (customDir && fs.existsSync(customDir) && customDir !== getDefaultDataDir()) {
    // Re-init at custom location
    const customDbPath = path.join(customDir, 'bandaid.db');
    if (fs.existsSync(customDbPath)) {
      initDb(customDir);
    }
  }
}

boot();

module.exports = {
  getDb,
  getCurrentDbPath,
  getDefaultDataDir: getDefaultDataDirExport,
  initDb,
  migrateToDir,

  getAllAlbums: () => getDb().prepare(`SELECT a.*, u.status, u.rating, u.notes, u.date_heard, u.play_count FROM albums a LEFT JOIN user_data u ON a.id = u.album_id ORDER BY a.added_at DESC`).all(),
  searchAlbums: (query) => { const q = `%${query}%`; return getDb().prepare(`SELECT a.*, u.status, u.rating, u.notes, u.date_heard, u.play_count FROM albums a LEFT JOIN user_data u ON a.id = u.album_id WHERE a.title LIKE ? OR a.artist LIKE ? ORDER BY a.added_at DESC`).all(q, q); },
  getGenres: () => getDb().prepare("SELECT DISTINCT genre, subgenre FROM albums WHERE genre IS NOT NULL AND genre != '' ORDER BY genre, subgenre").all(),
  getArtists: () => getDb().prepare("SELECT DISTINCT artist FROM albums WHERE artist IS NOT NULL ORDER BY artist").all().map(r => r.artist),
  getDecades: () => getDb().prepare("SELECT DISTINCT (year / 10) * 10 as decade FROM albums WHERE year IS NOT NULL ORDER BY decade").all().map(r => r.decade),

  updateStatus: (id, status) => {
    getDb().prepare("INSERT INTO user_data (album_id, status) VALUES (?, ?) ON CONFLICT(album_id) DO UPDATE SET status = ?").run(id, status, status);
    if (status === 'heard') {
      getDb().prepare("UPDATE user_data SET play_count = COALESCE(play_count, 0) + 1 WHERE album_id = ?").run(id);
    }
  },
  updateRating: (id, rating) => getDb().prepare("INSERT INTO user_data (album_id, rating) VALUES (?, ?) ON CONFLICT(album_id) DO UPDATE SET rating = ?").run(id, rating, rating),
  updateNotes: (id, notes) => getDb().prepare("INSERT INTO user_data (album_id, notes) VALUES (?, ?) ON CONFLICT(album_id) DO UPDATE SET notes = ?").run(id, notes, notes),
  updateDateHeard: (id, dateHeard) => getDb().prepare("INSERT INTO user_data (album_id, date_heard) VALUES (?, ?) ON CONFLICT(album_id) DO UPDATE SET date_heard = ?").run(id, dateHeard, dateHeard),

  getPlayCount: (albumId) => {
    const row = getDb().prepare("SELECT play_count FROM user_data WHERE album_id = ?").get(albumId);
    return row ? (row.play_count || 0) : 0;
  },
  resetPlayCount: (albumId) => getDb().prepare("UPDATE user_data SET play_count = 0 WHERE album_id = ?").run(albumId),
  incrementPlayCount: (albumId) => getDb().prepare("UPDATE user_data SET play_count = COALESCE(play_count, 0) + 1 WHERE album_id = ?").run(albumId),

  insertAlbum: (album, initialStatus = 'unheard', initialNotes = null) => {
    const result = getDb().prepare(`INSERT INTO albums (title, artist, composer, conductor, orchestra, catalogue_no, period, year, genre, subgenre, is_classical, country_code, label_country, mbid, cover_url, duration_sec, track_count, format, label, discogs_url, discogs_master_id) VALUES (@title, @artist, @composer, @conductor, @orchestra, @catalogue_no, @period, @year, @genre, @subgenre, @is_classical, @country_code, @label_country, @mbid, @cover_url, @duration_sec, @track_count, @format, @label, @discogs_url, @discogs_master_id)`).run({
      ...album,
      composer: album.composer||null, conductor: album.conductor||null, orchestra: album.orchestra||null,
      catalogue_no: album.catalogue_no||null, period: album.period||null, genre: album.genre||null,
      subgenre: album.subgenre||null, is_classical: album.is_classical?1:0, country_code: album.country_code||null,
      label_country: album.label_country||null, mbid: null, cover_url: album.cover_url||null,
      duration_sec: album.duration_sec||null, track_count: album.track_count||null,
      format: album.format||null, label: album.label||null, discogs_url: album.discogs_url||null,
      discogs_master_id: album.discogs_master_id||null
    });
    getDb().prepare("INSERT INTO user_data (album_id, status, notes) VALUES (?, ?, ?)").run(result.lastInsertRowid, initialStatus || 'unheard', initialNotes || null);
    return result.lastInsertRowid;
  },

  deleteAlbum: (id) => getDb().prepare("DELETE FROM albums WHERE id = ?").run(id),
  deleteAlbums: (ids) => {
    const del = getDb().prepare("DELETE FROM albums WHERE id = ?");
    const tx = getDb().transaction((rows) => { for (const id of rows) del.run(id); });
    tx(ids);
    return true;
  },

  checkDiscogsIdExists: (discogsId) => {
    if (!discogsId) return false;
    return getDb().prepare("SELECT 1 FROM albums WHERE discogs_master_id = ?").get(discogsId) !== undefined;
  },

  getStats: () => ({
    total: getDb().prepare("SELECT COUNT(*) as count FROM albums").get().count,
    heard: getDb().prepare("SELECT COUNT(*) as count FROM user_data WHERE status = 'heard'").get().count,
    genres: getDb().prepare("SELECT genre, COUNT(*) as count FROM albums GROUP BY genre").all(),
    statuses: getDb().prepare("SELECT status, COUNT(*) as count FROM user_data GROUP BY status").all(),
    decades: getDb().prepare("SELECT (year / 10) * 10 as decade, COUNT(*) as count FROM albums WHERE year IS NOT NULL GROUP BY decade").all(),
    totalDurationSec: getDb().prepare("SELECT SUM(duration_sec) as s FROM albums WHERE duration_sec IS NOT NULL").get().s || 0,
    topArtists: getDb().prepare("SELECT artist, COUNT(*) as count FROM albums GROUP BY artist ORDER BY count DESC LIMIT 10").all(),
    ratingDist: getDb().prepare("SELECT rating, COUNT(*) as count FROM user_data WHERE rating IS NOT NULL GROUP BY rating ORDER BY rating").all(),
    formats: getDb().prepare("SELECT format, COUNT(*) as count FROM albums WHERE format IS NOT NULL GROUP BY format ORDER BY count DESC").all(),
    listenedByMonth: getDb().prepare("SELECT strftime('%Y-%m', date_heard) as month, COUNT(*) as count FROM user_data WHERE date_heard IS NOT NULL GROUP BY month ORDER BY month DESC LIMIT 12").all(),
    heardByDate: getDb().prepare("SELECT date_heard as date, COUNT(*) as count FROM user_data WHERE date_heard IS NOT NULL AND date_heard != '' GROUP BY date_heard").all(),
    avgRatingByGenre: getDb().prepare("SELECT a.genre, AVG(u.rating) as avg, COUNT(u.rating) as rated FROM albums a JOIN user_data u ON a.id = u.album_id WHERE u.rating IS NOT NULL AND a.genre IS NOT NULL GROUP BY a.genre ORDER BY avg DESC").all(),
  }),

  getBlockedRegions: () => getDb().prepare("SELECT * FROM blocked_regions").all(),
  addBlockedRegion: (name, codes) => getDb().prepare("INSERT OR IGNORE INTO blocked_regions (region_name, country_codes) VALUES (?, ?)").run(name, codes),
  removeBlockedRegion: (name) => getDb().prepare("DELETE FROM blocked_regions WHERE region_name = ?").run(name),
  checkMbidExists: (mbid) => { if (!mbid) return false; return getDb().prepare("SELECT 1 FROM albums WHERE mbid = ?").get(mbid) !== undefined; },
  checkTitleArtistExists: (title, artist) => { if (!title || !artist) return false; return getDb().prepare("SELECT 1 FROM albums WHERE LOWER(title) = LOWER(?) AND LOWER(artist) = LOWER(?)").get(title, artist) !== undefined; },

  queueInsertBatch: (items) => {
    const insert = getDb().prepare(`INSERT INTO import_queue (raw_line, parsed_artist, parsed_title, parsed_year, parsed_genre, parsed_status, parsed_notes, parsed_conductor, parsed_orchestra) VALUES (@raw_line, @parsed_artist, @parsed_title, @parsed_year, @parsed_genre, @parsed_status, @parsed_notes, @parsed_conductor, @parsed_orchestra)`);
    const insertMany = getDb().transaction((rows) => { for (const row of rows) insert.run({ ...row, parsed_conductor: row.parsed_conductor || null, parsed_orchestra: row.parsed_orchestra || null }); });
    insertMany(items);
  },

  queueGetPending: () => getDb().prepare(`SELECT * FROM import_queue WHERE status = 'pending' ORDER BY id ASC`).all(),
  queueGetAll: () => getDb().prepare(`SELECT * FROM import_queue ORDER BY id DESC LIMIT 200`).all(),
  queueSetStatus: (id, status, error) => getDb().prepare(`UPDATE import_queue SET status = ?, error = ?, processed_at = datetime('now') WHERE id = ?`).run(status, error || null, id),
  queueSetRateLimited: (id, nextRetryAt) => getDb().prepare(`UPDATE import_queue SET status = 'rate_limited', next_retry_at = ?, processed_at = datetime('now') WHERE id = ?`).run(nextRetryAt, id),
  queueResetRateLimited: () => getDb().prepare(`UPDATE import_queue SET status = 'pending', next_retry_at = NULL WHERE status = 'rate_limited' AND datetime('now') >= datetime(next_retry_at)`).run(),
  queueRetryFailed: () => getDb().prepare(`UPDATE import_queue SET status = 'pending', error = NULL, processed_at = NULL WHERE status = 'failed'`).run(),
  queueClear: () => getDb().prepare(`DELETE FROM import_queue`).run(),

  queueGetStats: () => ({
    pending: getDb().prepare(`SELECT COUNT(*) as c FROM import_queue WHERE status = 'pending'`).get().c,
    done: getDb().prepare(`SELECT COUNT(*) as c FROM import_queue WHERE status = 'done'`).get().c,
    failed: getDb().prepare(`SELECT COUNT(*) as c FROM import_queue WHERE status = 'failed'`).get().c,
    duplicate: getDb().prepare(`SELECT COUNT(*) as c FROM import_queue WHERE status = 'duplicate'`).get().c,
    blocked: getDb().prepare(`SELECT COUNT(*) as c FROM import_queue WHERE status = 'blocked'`).get().c,
    rate_limited: getDb().prepare(`SELECT COUNT(*) as c FROM import_queue WHERE status = 'rate_limited'`).get().c,
    total: getDb().prepare(`SELECT COUNT(*) as c FROM import_queue`).get().c,
    nextRetry: getDb().prepare(`SELECT next_retry_at FROM import_queue WHERE status = 'rate_limited' ORDER BY next_retry_at ASC LIMIT 1`).get()?.next_retry_at || null
  }),

  getSetting: (key) => getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key)?.value ?? null,
  setSetting: (key, value) => getDb().prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(key, value, value),

  restoreAlbums: (albums) => {
    const check = getDb().prepare("SELECT 1 FROM albums WHERE LOWER(title) = LOWER(?) AND LOWER(artist) = LOWER(?)");
    const insert = getDb().prepare(`INSERT INTO albums (title, artist, year, genre, subgenre, mbid, country_code, track_count, duration_sec) VALUES (@title, @artist, @year, @genre, @subgenre, @mbid, @country_code, @track_count, @duration_sec)`);
    const update = getDb().prepare("INSERT INTO user_data (album_id, status, rating, notes, date_heard) VALUES (?, ?, ?, ?, ?) ON CONFLICT(album_id) DO UPDATE SET status = ?, rating = ?, notes = ?, date_heard = ?");

    getDb().transaction((rows) => {
      for (const a of rows) {
        if (check.get(a.title, a.artist) !== undefined) continue;
        const r = insert.run({ ...a, mbid: null });
        if (a.status || a.rating || a.notes) {
          update.run(r.lastInsertRowid, a.status||'unheard', a.rating||null, a.notes||null, a.date_heard||null, a.status||'unheard', a.rating||null, a.notes||null, a.date_heard||null);
        } else {
          getDb().prepare("INSERT INTO user_data (album_id, status) VALUES (?, ?)").run(r.lastInsertRowid, 'unheard');
        }
      }
    })(albums);
  },

  restoreProgress: (entries) => {
    const find = getDb().prepare("SELECT id FROM albums WHERE LOWER(title) = LOWER(?) AND LOWER(artist) = LOWER(?)");
    const update = getDb().prepare("INSERT INTO user_data (album_id, status, rating, notes, date_heard) VALUES (?, ?, ?, ?, ?) ON CONFLICT(album_id) DO UPDATE SET status = ?, rating = ?, notes = ?, date_heard = ?");

    getDb().transaction((rows) => {
      for (const e of rows) {
        const a = find.get(e.title, e.artist);
        if (a) update.run(a.id, e.status||'unheard', e.rating||null, e.notes||null, e.date_heard||null, e.status||'unheard', e.rating||null, e.notes||null, e.date_heard||null);
      }
    })(entries);
  }
};
