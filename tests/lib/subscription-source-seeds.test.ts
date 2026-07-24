import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import {
  CHINESE_SECURITY_RSS_SOURCES,
  SECURITY_SOURCE_ADDITIONS,
  disableKnownUnreliableSourcesOnce,
  seedSecuritySourceAdditions,
  seedChineseSecuritySources,
} from '@/lib/subscription-source-seeds';

async function createDb() {
  const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
  const db = new actual.default(':memory:');
  db.exec(`
    CREATE TABLE app_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE subscription_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT NOT NULL,
      topic TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      fetch_interval INTEGER NOT NULL DEFAULT 86400,
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_error_code TEXT,
      last_failed_at TEXT
    );
  `);
  return db;
}

describe('subscription source seeds', () => {
  let db: Database.Database;

  afterEach(() => db?.close());

  it('defines eleven Chinese security RSS sources with public HTTPS URLs', () => {
    expect(CHINESE_SECURITY_RSS_SOURCES).toHaveLength(11);
    expect(CHINESE_SECURITY_RSS_SOURCES.map(source => source.name)).toEqual([
      'FreeBuf', '安全客', '先知社区', '360 Netlab', '绿盟科技', '离别歌',
      'SQLSEC', 'ChaBug', '嘶吼', '安全脉搏', '奇安信攻防社区',
    ]);
    for (const source of CHINESE_SECURITY_RSS_SOURCES) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.category).toBe('rss');
      expect(source.topic).toBe('security');
    }
    expect(CHINESE_SECURITY_RSS_SOURCES).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '安全客', url: 'https://api.anquanke.com/data/v1/rss' }),
      expect.objectContaining({ name: '离别歌', url: 'https://www.leavesongs.com/rss/' }),
    ]));
  });

  it('defines the requested official security sources with explicit fetch strategies', () => {
    expect(SECURITY_SOURCE_ADDITIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '长亭应急响应中心', url: 'https://rivers.chaitin.cn/', category: 'json', topic: 'security', enabled: 0, lastErrorCode: 'WAF_CHALLENGE' }),
      expect.objectContaining({ name: '360漏洞研究院', url: 'https://vul.360.net/feed/', category: 'rss', topic: 'security' }),
      expect.objectContaining({ name: '微步在线技术博客', url: 'https://www.threatbook.cn/techblog', category: 'json', topic: 'security' }),
      expect.objectContaining({ name: 'Kirill Firsov (@k_firsov)', url: 'https://x.com/k_firsov', category: 'x', topic: 'security', enabled: 0, lastErrorCode: 'X_UPSTREAM_UNAVAILABLE' }),
    ]));
  });

  it('seeds source additions even when the original v1 migration already exists', async () => {
    db = await createDb();
    db.prepare('INSERT INTO app_migrations (name) VALUES (?)').run('20260716-seed-chinese-security-rss-v1');
    seedSecuritySourceAdditions(db);
    seedSecuritySourceAdditions(db);

    expect(db.prepare('SELECT COUNT(*) AS count FROM subscription_sources').get()).toEqual({ count: 4 });
    expect(db.prepare('SELECT category, topic FROM subscription_sources WHERE name = ?').get('微步在线技术博客'))
      .toEqual({ category: 'json', topic: 'security' });
    expect(db.prepare('SELECT enabled, last_error_code FROM subscription_sources WHERE name = ?').get('长亭应急响应中心'))
      .toEqual({ enabled: 0, last_error_code: 'WAF_CHALLENGE' });
    expect(db.prepare('SELECT enabled, last_error_code FROM subscription_sources WHERE name = ?').get('Kirill Firsov (@k_firsov)'))
      .toEqual({ enabled: 0, last_error_code: 'X_UPSTREAM_UNAVAILABLE' });
  });

  it('does not recreate the exact production failures from the persistent default seed block', () => {
    const dbSource = fs.readFileSync('lib/db.ts', 'utf8');
    expect(dbSource).not.toContain('https://security.googleblog.com/feeds/posts/default');
    expect(dbSource).not.toContain('https://github.blog/security/feed/');
  });

  it('seeds idempotently without overwriting an administrator edit', async () => {
    db = await createDb();
    const existing = CHINESE_SECURITY_RSS_SOURCES[0];
    db.prepare(
      'INSERT INTO subscription_sources (name, url, category, topic, enabled) VALUES (?, ?, ?, ?, ?)',
    ).run('管理员自定义名称', existing.url, 'rss', 'security', 0);

    seedChineseSecuritySources(db);
    seedChineseSecuritySources(db);

    expect(db.prepare('SELECT COUNT(*) AS count FROM subscription_sources').get()).toEqual({ count: 11 });
    expect(db.prepare('SELECT name, enabled FROM subscription_sources WHERE url = ?').get(existing.url))
      .toEqual({ name: '管理员自定义名称', enabled: 0 });
  });

  it('does not recreate a source that an administrator deletes after the one-time seed', async () => {
    db = await createDb();
    seedChineseSecuritySources(db);
    const deletedUrl = CHINESE_SECURITY_RSS_SOURCES[1].url;
    db.prepare('DELETE FROM subscription_sources WHERE url = ?').run(deletedUrl);

    seedChineseSecuritySources(db);

    expect(db.prepare('SELECT COUNT(*) AS count FROM subscription_sources').get()).toEqual({ count: 10 });
    expect(db.prepare('SELECT id FROM subscription_sources WHERE url = ?').get(deletedUrl)).toBeUndefined();
  });

  it('disables known production failures once, then preserves manual re-enabling', async () => {
    db = await createDb();
    const failures = [
      ['OpenAI Cookbook', 'https://github.com/openai/openai-cookbook', 'github'],
      ['Anthropic Cookbook', 'https://github.com/anthropics/anthropic-cookbook', 'github'],
      ['LangChain', 'https://github.com/langchain-ai/langchain', 'github'],
      ['Hugging Face Transformers', 'https://github.com/huggingface/transformers', 'github'],
      ['Ollama', 'https://github.com/ollama/ollama', 'github'],
      ['vLLM', 'https://github.com/vllm-project/vllm', 'github'],
      ['Lilian Weng Blog', 'https://lilianweng.github.io/', 'rss'],
      ['Google Security Blog', 'https://security.googleblog.com/feeds/posts/default', 'rss'],
      ['GitHub Security', 'https://github.blog/security/feed/', 'rss'],
    ];
    const insert = db.prepare(
      'INSERT INTO subscription_sources (name, url, category, topic, enabled) VALUES (?, ?, ?, ?, 1)',
    );
    for (const source of failures) insert.run(...source, 'security');

    disableKnownUnreliableSourcesOnce(db);
    expect(db.prepare('SELECT COUNT(*) AS count FROM subscription_sources WHERE enabled = 0').get()).toEqual({ count: 9 });
    const disabledHealth = db.prepare(
      'SELECT last_error_code, last_failed_at FROM subscription_sources WHERE url = ?',
    ).get(failures[0][1]) as { last_error_code: string; last_failed_at: string };
    expect(disabledHealth.last_error_code).toBe('KNOWN_UNRELIABLE_SOURCE');
    expect(disabledHealth.last_failed_at).toMatch(/^\d{4}-\d{2}-\d{2} /);

    db.prepare('UPDATE subscription_sources SET enabled = 1').run();
    disableKnownUnreliableSourcesOnce(db);
    expect(db.prepare('SELECT COUNT(*) AS count FROM subscription_sources WHERE enabled = 1').get()).toEqual({ count: 9 });
  });
});
