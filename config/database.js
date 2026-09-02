const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'joyboy.db');
const db = new Database(dbPath);

// ── Performance & safety settings ──
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ── Schema initialization ──
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    avatar        TEXT    DEFAULT NULL,
    bio           TEXT    DEFAULT NULL,
    role          TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS videos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    DEFAULT NULL,
    filename    TEXT    NOT NULL,
    thumbnail   TEXT    DEFAULT NULL,
    duration    REAL    DEFAULT NULL,
    file_size   INTEGER NOT NULL,
    mime_type   TEXT    NOT NULL,
    views       INTEGER NOT NULL DEFAULT 0,
    user_id     INTEGER NOT NULL,
    visibility  TEXT    NOT NULL DEFAULT 'public' CHECK(visibility IN ('public', 'private')),
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_videos_user_id    ON videos(user_id);
  CREATE INDEX IF NOT EXISTS idx_videos_created_at  ON videos(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_videos_visibility   ON videos(visibility);
  CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_username       ON users(username);
`);

console.log('  ✅ Database initialized');

module.exports = db;
