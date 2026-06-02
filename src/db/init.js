const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

const dbPath = path.join(__dirname, '../../data/qr-cache.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS qr_cache (
    sku TEXT PRIMARY KEY,
    video_url TEXT NOT NULL,
    qr_png BLOB NOT NULL,
    cached_at INTEGER NOT NULL
  )
`);

function getCache(sku) {
  const row = db.prepare(
    'SELECT * FROM qr_cache WHERE sku = ? AND cached_at > ?'
  ).get(sku, Date.now() - (config.cacheTtl * 1000));
  return row || null;
}

function setCache(sku, videoUrl, pngBuffer) {
  db.prepare(`
    INSERT OR REPLACE INTO qr_cache (sku, video_url, qr_png, cached_at)
    VALUES (?, ?, ?, ?)
  `).run(sku, videoUrl, pngBuffer, Date.now());
}

function clearCache() {
  db.prepare('DELETE FROM qr_cache').run();
}

function clearCacheBySku(sku) {
  db.prepare('DELETE FROM qr_cache WHERE sku = ?').run(sku);
}

module.exports = { getCache, setCache, clearCache, clearCacheBySku };
