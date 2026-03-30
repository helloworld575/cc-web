import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'data', 'site.db'));

// Performance PRAGMAs
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -8000');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 67108864');
db.pragma('page_size = 4096');

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cover_file_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fortune_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL,
    input TEXT NOT NULL DEFAULT '{}',
    preflight TEXT NOT NULL DEFAULT '{}',
    analysis TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate: add deadline column if not exists
try {
  db.exec("ALTER TABLE todos ADD COLUMN deadline TEXT");
} catch {
  // column already exists, ignore
}

// Migrate: add album_id column to files
try {
  db.exec("ALTER TABLE files ADD COLUMN album_id INTEGER REFERENCES albums(id)");
} catch {
  // column already exists, ignore
}

// Indexes for query performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at);
  CREATE INDEX IF NOT EXISTS idx_files_album_id ON files(album_id);
  CREATE INDEX IF NOT EXISTS idx_files_original_name ON files(original_name);
  CREATE INDEX IF NOT EXISTS idx_todos_done_deadline ON todos(done, deadline);
  CREATE INDEX IF NOT EXISTS idx_fortune_history_created_at ON fortune_history(created_at);
  CREATE INDEX IF NOT EXISTS idx_diary_date ON diary(date);
`);

// Prepared statements for hot queries
export const stmts = {
  // files
  countFiles: db.prepare('SELECT COUNT(*) as c FROM files'),
  listFiles: db.prepare('SELECT * FROM files ORDER BY uploaded_at DESC LIMIT ? OFFSET ?'),
  insertFile: db.prepare('INSERT INTO files (filename, original_name, mime_type, size, album_id) VALUES (?, ?, ?, ?, ?)'),

  // fortune_history
  listFortune: db.prepare('SELECT id, method, input, preflight, analysis, created_at FROM fortune_history ORDER BY created_at DESC LIMIT 100'),
  insertFortune: db.prepare('INSERT INTO fortune_history (method, input, preflight, analysis) VALUES (?, ?, ?, ?)'),
  getFortune: db.prepare('SELECT * FROM fortune_history WHERE id = ?'),
  deleteFortune: db.prepare('DELETE FROM fortune_history WHERE id = ?'),
};

// Graceful shutdown
const shutdown = () => { try { db.close(); } catch {} };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default db;
