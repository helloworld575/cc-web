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

  CREATE TABLE IF NOT EXISTS ai_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_type TEXT NOT NULL DEFAULT 'openai',
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model TEXT NOT NULL,
    system_prompt TEXT NOT NULL DEFAULT '',
    max_tokens INTEGER NOT NULL DEFAULT 4096,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    messages TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscription_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    enabled INTEGER NOT NULL DEFAULT 1,
    fetch_interval INTEGER NOT NULL DEFAULT 3600,
    last_fetched_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscription_briefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES subscription_sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    brief TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  CREATE INDEX IF NOT EXISTS idx_ai_chat_history_provider ON ai_chat_history(provider_id);
  CREATE INDEX IF NOT EXISTS idx_ai_chat_history_updated ON ai_chat_history(updated_at);
  CREATE INDEX IF NOT EXISTS idx_subscription_sources_enabled ON subscription_sources(enabled);
  CREATE INDEX IF NOT EXISTS idx_subscription_briefs_source ON subscription_briefs(source_id);
  CREATE INDEX IF NOT EXISTS idx_subscription_briefs_fetched ON subscription_briefs(fetched_at);
  CREATE INDEX IF NOT EXISTS idx_subscription_briefs_hash ON subscription_briefs(content_hash);
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

  // ai_providers
  listProviders: db.prepare('SELECT * FROM ai_providers ORDER BY is_default DESC, created_at DESC'),
  getProvider: db.prepare('SELECT * FROM ai_providers WHERE id = ?'),
  insertProvider: db.prepare('INSERT INTO ai_providers (name, api_type, api_url, api_key, model, system_prompt, max_tokens, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  updateProvider: db.prepare('UPDATE ai_providers SET name=?, api_type=?, api_url=?, api_key=?, model=?, system_prompt=?, max_tokens=?, is_default=?, updated_at=datetime(\'now\') WHERE id=?'),
  deleteProvider: db.prepare('DELETE FROM ai_providers WHERE id = ?'),
  clearDefaultProvider: db.prepare('UPDATE ai_providers SET is_default = 0 WHERE is_default = 1'),

  // ai_chat_history
  listChats: db.prepare('SELECT id, provider_id, title, created_at, updated_at FROM ai_chat_history ORDER BY updated_at DESC LIMIT 50'),
  listChatsByProvider: db.prepare('SELECT id, provider_id, title, created_at, updated_at FROM ai_chat_history WHERE provider_id = ? ORDER BY updated_at DESC LIMIT 50'),
  getChat: db.prepare('SELECT * FROM ai_chat_history WHERE id = ?'),
  insertChat: db.prepare('INSERT INTO ai_chat_history (provider_id, title, messages) VALUES (?, ?, ?)'),
  updateChat: db.prepare('UPDATE ai_chat_history SET title=?, messages=?, updated_at=datetime(\'now\') WHERE id=?'),
  deleteChat: db.prepare('DELETE FROM ai_chat_history WHERE id = ?'),
};

// Graceful shutdown
const shutdown = () => { try { db.close(); } catch {} };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default db;
