import type Database from 'better-sqlite3';

interface SubscriptionSourceSeed {
  name: string;
  url: string;
  category: 'rss' | 'json' | 'x';
  topic: 'security';
  enabled?: 0 | 1;
  lastErrorCode?: string;
}

export const CHINESE_SECURITY_RSS_SOURCES: readonly SubscriptionSourceSeed[] = [
  { name: 'FreeBuf', url: 'https://www.freebuf.com/feed', category: 'rss', topic: 'security' },
  { name: '安全客', url: 'https://api.anquanke.com/data/v1/rss', category: 'rss', topic: 'security' },
  { name: '先知社区', url: 'https://xz.aliyun.com/feed', category: 'rss', topic: 'security' },
  { name: '360 Netlab', url: 'https://blog.netlab.360.com/rss/', category: 'rss', topic: 'security' },
  { name: '绿盟科技', url: 'https://blog.nsfocus.net/feed/', category: 'rss', topic: 'security' },
  { name: '离别歌', url: 'https://www.leavesongs.com/rss/', category: 'rss', topic: 'security' },
  { name: 'SQLSEC', url: 'https://www.sqlsec.com/atom.xml', category: 'rss', topic: 'security' },
  { name: 'ChaBug', url: 'https://www.chabug.org/feed/', category: 'rss', topic: 'security' },
  { name: '嘶吼', url: 'https://www.4hou.com/feed', category: 'rss', topic: 'security' },
  { name: '安全脉搏', url: 'https://www.secpulse.com/feed', category: 'rss', topic: 'security' },
  { name: '奇安信攻防社区', url: 'https://forum.butian.net/Rss', category: 'rss', topic: 'security' },
];

export const SECURITY_SOURCE_ADDITIONS: readonly SubscriptionSourceSeed[] = [
  {
    name: '长亭应急响应中心',
    url: 'https://rivers.chaitin.cn/',
    category: 'json',
    topic: 'security',
    enabled: 0,
    lastErrorCode: 'WAF_CHALLENGE',
  },
  { name: '360漏洞研究院', url: 'https://vul.360.net/feed/', category: 'rss', topic: 'security' },
  { name: '微步在线技术博客', url: 'https://www.threatbook.cn/techblog', category: 'json', topic: 'security' },
  {
    name: 'Kirill Firsov (@k_firsov)',
    url: 'https://x.com/k_firsov',
    category: 'x',
    topic: 'security',
    enabled: 0,
    lastErrorCode: 'X_UPSTREAM_UNAVAILABLE',
  },
];

const CHINESE_SECURITY_SEED_MIGRATION = '20260716-seed-chinese-security-rss-v1';
const SECURITY_SOURCE_ADDITIONS_MIGRATION = '20260724-seed-security-sources-v2';
const KNOWN_FAILURES_MIGRATION = '20260716-disable-known-subscription-failures-v1';

const KNOWN_UNRELIABLE_SOURCES = [
  ['https://github.com/openai/openai-cookbook', 'github'],
  ['https://github.com/anthropics/anthropic-cookbook', 'github'],
  ['https://github.com/langchain-ai/langchain', 'github'],
  ['https://github.com/huggingface/transformers', 'github'],
  ['https://github.com/ollama/ollama', 'github'],
  ['https://github.com/vllm-project/vllm', 'github'],
  ['https://lilianweng.github.io/', 'rss'],
  ['https://security.googleblog.com/feeds/posts/default', 'rss'],
  ['https://github.blog/security/feed/', 'rss'],
] as const;

function migrationApplied(db: Database.Database, name: string) {
  return Boolean(db.prepare('SELECT name FROM app_migrations WHERE name = ?').get(name));
}

export function seedChineseSecuritySources(db: Database.Database) {
  if (migrationApplied(db, CHINESE_SECURITY_SEED_MIGRATION)) return;

  const insert = db.prepare(`
    INSERT INTO subscription_sources
      (name, url, category, topic, enabled, fetch_interval)
    SELECT ?, ?, ?, ?, 1, 86400
    WHERE NOT EXISTS (SELECT 1 FROM subscription_sources WHERE url = ?)
  `);
  for (const source of CHINESE_SECURITY_RSS_SOURCES) {
    insert.run(source.name, source.url, source.category, source.topic, source.url);
  }
  db.prepare('INSERT INTO app_migrations (name) VALUES (?)').run(CHINESE_SECURITY_SEED_MIGRATION);
}

export function seedSecuritySourceAdditions(db: Database.Database) {
  if (migrationApplied(db, SECURITY_SOURCE_ADDITIONS_MIGRATION)) return;

  const insert = db.prepare(`
    INSERT INTO subscription_sources
      (name, url, category, topic, enabled, fetch_interval, last_error_code, last_failed_at)
    SELECT ?, ?, ?, ?, ?, 86400, ?, CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END
    WHERE NOT EXISTS (SELECT 1 FROM subscription_sources WHERE url = ?)
  `);
  for (const source of SECURITY_SOURCE_ADDITIONS) {
    insert.run(
      source.name,
      source.url,
      source.category,
      source.topic,
      source.enabled ?? 1,
      source.lastErrorCode ?? null,
      source.lastErrorCode ?? null,
      source.url,
    );
  }
  db.prepare('INSERT INTO app_migrations (name) VALUES (?)').run(SECURITY_SOURCE_ADDITIONS_MIGRATION);
}

export function disableKnownUnreliableSourcesOnce(db: Database.Database) {
  if (migrationApplied(db, KNOWN_FAILURES_MIGRATION)) return;

    const disable = db.prepare(`
      UPDATE subscription_sources
      SET enabled = 0,
          last_error_code = 'KNOWN_UNRELIABLE_SOURCE',
          last_failed_at = datetime('now')
      WHERE url = ? AND category = ? AND enabled = 1
    `);
  for (const [url, category] of KNOWN_UNRELIABLE_SOURCES) disable.run(url, category);
  db.prepare('INSERT INTO app_migrations (name) VALUES (?)').run(KNOWN_FAILURES_MIGRATION);
}
