import Database from 'better-sqlite3';
import { getRuntimePaths } from '@/lib/runtime-paths';
import { migrateSubscriptionItemObservationColumns } from '@/lib/db-migrations';

const isBuildDatabase = process.env.BUILDING_DOCKER_IMAGE === '1'
  || process.env.NEXT_PHASE === 'phase-production-build';

const dbPath = isBuildDatabase ? ':memory:' : getRuntimePaths().dbPath;

const db = new Database(dbPath);
const processForDb = process as NodeJS.Process & {
  __siteDbShutdownRegistered?: boolean;
};

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
    provider_id INTEGER NOT NULL,
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
    topic TEXT NOT NULL DEFAULT 'ai' CHECK (topic IN ('ai', 'security')),
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

  CREATE TABLE IF NOT EXISTS app_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS claude_assistant_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uuid TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    cwd TEXT NOT NULL DEFAULT 'default',
    messages TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscription_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES subscription_sources(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    published_at TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscription_daily_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date TEXT NOT NULL,
    topic TEXT NOT NULL CHECK (topic IN ('ai', 'security')),
    status TEXT NOT NULL CHECK (status IN ('running', 'published', 'failed')),
    slug TEXT NOT NULL,
    entry_count INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (run_date, topic)
  );

  CREATE TABLE IF NOT EXISTS blog_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'visible',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blog_view_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    referrer TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'direct',
    user_agent TEXT NOT NULL DEFAULT '',
    ip_hash TEXT NOT NULL DEFAULT '',
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

// Migrate subscriptions from source-type-only classification to AI/security topics.
try {
  db.exec("ALTER TABLE subscription_sources ADD COLUMN topic TEXT NOT NULL DEFAULT 'ai' CHECK (topic IN ('ai', 'security'))");
} catch {
  // column already exists, ignore
}

migrateSubscriptionItemObservationColumns(db);

// X feeds have been unreliable in production. Disable the currently configured X feeds
// once, while preserving later administrator choices, and add stable RSS/Atom alternatives.
const xSourceMigration = '20260716-disable-unreliable-x-subscriptions';
const xSourceMigrationApplied = db
  .prepare('SELECT name FROM app_migrations WHERE name = ?')
  .get(xSourceMigration);
if (!xSourceMigrationApplied) {
  db.prepare(`
    UPDATE subscription_sources
    SET enabled = 0, updated_at = datetime('now')
    WHERE category = 'x' AND enabled = 1
  `).run();
  db.prepare('INSERT INTO app_migrations (name) VALUES (?)').run(xSourceMigration);
}

const subscriptionTopicMigration = '20260716-classify-security-subscriptions';
const subscriptionTopicMigrationApplied = db
  .prepare('SELECT name FROM app_migrations WHERE name = ?')
  .get(subscriptionTopicMigration);
if (!subscriptionTopicMigrationApplied) {
  db.prepare(`
    UPDATE subscription_sources
    SET topic = 'security'
    WHERE lower(name || ' ' || url) LIKE '%security%'
       OR lower(name || ' ' || url) LIKE '%cisa%'
       OR lower(name || ' ' || url) LIKE '%cve%'
  `).run();
  db.prepare('INSERT INTO app_migrations (name) VALUES (?)').run(subscriptionTopicMigration);
}

db.exec(`
  INSERT INTO subscription_sources (name, url, category, topic, enabled, fetch_interval)
  SELECT 'OpenAI News', 'https://openai.com/news/rss.xml', 'rss', 'ai', 1, 86400
  WHERE NOT EXISTS (SELECT 1 FROM subscription_sources WHERE url = 'https://openai.com/news/rss.xml');

  INSERT INTO subscription_sources (name, url, category, topic, enabled, fetch_interval)
  SELECT 'Google DeepMind Blog', 'https://deepmind.google/blog/rss.xml', 'rss', 'ai', 1, 86400
  WHERE NOT EXISTS (SELECT 1 FROM subscription_sources WHERE url = 'https://deepmind.google/blog/rss.xml');

  INSERT INTO subscription_sources (name, url, category, topic, enabled, fetch_interval)
  SELECT 'arXiv Artificial Intelligence', 'https://export.arxiv.org/rss/cs.AI', 'rss', 'ai', 1, 86400
  WHERE NOT EXISTS (SELECT 1 FROM subscription_sources WHERE url = 'https://export.arxiv.org/rss/cs.AI');

  INSERT INTO subscription_sources (name, url, category, topic, enabled, fetch_interval)
  SELECT 'Google Security Blog', 'https://security.googleblog.com/feeds/posts/default', 'rss', 'security', 1, 86400
  WHERE NOT EXISTS (SELECT 1 FROM subscription_sources WHERE url = 'https://security.googleblog.com/feeds/posts/default');

  INSERT INTO subscription_sources (name, url, category, topic, enabled, fetch_interval)
  SELECT 'Microsoft Security Blog', 'https://www.microsoft.com/en-us/security/blog/feed/', 'rss', 'security', 1, 86400
  WHERE NOT EXISTS (SELECT 1 FROM subscription_sources WHERE url = 'https://www.microsoft.com/en-us/security/blog/feed/');

  INSERT INTO subscription_sources (name, url, category, topic, enabled, fetch_interval)
  SELECT 'GitHub Security', 'https://github.blog/security/feed/', 'rss', 'security', 1, 86400
  WHERE NOT EXISTS (SELECT 1 FROM subscription_sources WHERE url = 'https://github.blog/security/feed/');

  INSERT INTO subscription_sources (name, url, category, topic, enabled, fetch_interval)
  SELECT 'CISA Cybersecurity Advisories', 'https://www.cisa.gov/cybersecurity-advisories/all.xml', 'rss', 'security', 1, 86400
  WHERE NOT EXISTS (SELECT 1 FROM subscription_sources WHERE url = 'https://www.cisa.gov/cybersecurity-advisories/all.xml');
`);

// Migrate: keep chat history when providers are edited/deleted and allow env-backed providers.
try {
  const chatForeignKeys = db.prepare("PRAGMA foreign_key_list('ai_chat_history')").all() as unknown[];
  if (chatForeignKeys.length > 0) {
    db.exec(`
      ALTER TABLE ai_chat_history RENAME TO ai_chat_history_old;
      CREATE TABLE ai_chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        title TEXT NOT NULL DEFAULT 'New Chat',
        messages TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO ai_chat_history (id, provider_id, title, messages, created_at, updated_at)
      SELECT id, provider_id, title, messages, created_at, updated_at FROM ai_chat_history_old;
      DROP TABLE ai_chat_history_old;
    `);
  }
} catch {
  // Best-effort migration; fresh databases already use the current schema.
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
  CREATE INDEX IF NOT EXISTS idx_claude_assistant_updated ON claude_assistant_sessions(updated_at);
  CREATE INDEX IF NOT EXISTS idx_claude_assistant_status ON claude_assistant_sessions(status);
  CREATE INDEX IF NOT EXISTS idx_subscription_sources_enabled ON subscription_sources(enabled);
  CREATE INDEX IF NOT EXISTS idx_subscription_sources_topic_enabled ON subscription_sources(topic, enabled);
  CREATE INDEX IF NOT EXISTS idx_subscription_briefs_source ON subscription_briefs(source_id);
  CREATE INDEX IF NOT EXISTS idx_subscription_briefs_fetched ON subscription_briefs(fetched_at);
  CREATE INDEX IF NOT EXISTS idx_subscription_briefs_hash ON subscription_briefs(content_hash);
  CREATE INDEX IF NOT EXISTS idx_subscription_items_source ON subscription_items(source_id);
  CREATE INDEX IF NOT EXISTS idx_subscription_items_fetched ON subscription_items(fetched_at);
  CREATE INDEX IF NOT EXISTS idx_subscription_items_published ON subscription_items(published_at);
  DROP INDEX IF EXISTS idx_subscription_items_source_hash;
  CREATE INDEX IF NOT EXISTS idx_subscription_items_source_hash ON subscription_items(source_id, content_hash);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_items_source_external
    ON subscription_items(source_id, external_id);
  CREATE INDEX IF NOT EXISTS idx_subscription_daily_status ON subscription_daily_runs(run_date, status);
  CREATE INDEX IF NOT EXISTS idx_blog_comments_slug_created ON blog_comments(slug, created_at);
  CREATE INDEX IF NOT EXISTS idx_blog_comments_status ON blog_comments(status);
  CREATE INDEX IF NOT EXISTS idx_blog_view_events_slug_created ON blog_view_events(slug, created_at);
  CREATE INDEX IF NOT EXISTS idx_blog_view_events_source ON blog_view_events(source);
  CREATE INDEX IF NOT EXISTS idx_blog_view_events_created ON blog_view_events(created_at);
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
if (!processForDb.__siteDbShutdownRegistered) {
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  processForDb.__siteDbShutdownRegistered = true;
}

export default db;
