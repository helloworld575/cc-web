import { describe, expect, it, vi } from 'vitest';
import {
  migrateAiChatHistoryColumns,
  migrateSubscriptionItemObservationColumns,
  migrateSubscriptionSourceHealthColumns,
  retireLegacyAiProviders,
  retireSubscriptionDailyRuns,
} from '@/lib/db-migrations';

describe('subscription database migrations', () => {
  it('drops the retired daily run table', async () => {
    const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
    const legacyDb = new actual.default(':memory:');
    legacyDb.exec('CREATE TABLE subscription_daily_runs (id INTEGER PRIMARY KEY, run_date TEXT NOT NULL)');

    retireSubscriptionDailyRuns(legacyDb);

    expect(legacyDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'subscription_daily_runs'").get()).toBeUndefined();
    legacyDb.close();
  });

  it('adds and backfills last_seen_at on a real legacy SQLite table', async () => {
    const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
    const legacyDb = new actual.default(':memory:');
    legacyDb.exec(`
      CREATE TABLE subscription_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO subscription_items
        (source_id, title, url, content, content_hash, fetched_at)
      VALUES
        (1, 'Legacy', 'https://example.com/item', 'Facts', 'hash', '2026-07-15 01:02:03');
    `);

    migrateSubscriptionItemObservationColumns(legacyDb);

    const columns = legacyDb.prepare("PRAGMA table_info('subscription_items')").all() as Array<{ name: string }>;
    const row = legacyDb.prepare('SELECT last_seen_at FROM subscription_items WHERE id = 1').get() as { last_seen_at: string };
    expect(columns.map(column => column.name)).toContain('last_seen_at');
    expect(row.last_seen_at).toBe('2026-07-15 01:02:03');
    legacyDb.close();
  });

  it('adds subscription source health columns to a real legacy SQLite table', async () => {
    const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
    const legacyDb = new actual.default(':memory:');
    legacyDb.exec(`
      CREATE TABLE subscription_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        category TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO subscription_sources (name, url, category)
      VALUES ('Legacy', 'https://example.com/feed.xml', 'rss');
    `);

    migrateSubscriptionSourceHealthColumns(legacyDb);

    const columns = legacyDb.prepare("PRAGMA table_info('subscription_sources')").all() as Array<{ name: string }>;
    const row = legacyDb.prepare(`
      SELECT failure_count, last_error_code, last_failed_at
      FROM subscription_sources WHERE id = 1
    `).get();
    expect(columns.map(column => column.name)).toEqual(expect.arrayContaining([
      'failure_count', 'last_error_code', 'last_failed_at',
    ]));
    expect(row).toEqual({ failure_count: 0, last_error_code: null, last_failed_at: null });
    legacyDb.close();
  });
});

describe('AI chat database migration', () => {
  it('adds agent metadata and execution state to a legacy chat table', () => {
    const Database = require('better-sqlite3') as typeof import('better-sqlite3').default;
    const legacyDb = new Database(':memory:');
    legacyDb.exec(`
      CREATE TABLE ai_chat_history (
        id INTEGER PRIMARY KEY,
        provider_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        messages TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO ai_chat_history (provider_id, title, messages) VALUES (7, 'Legacy chat', '[]');
    `);

    migrateAiChatHistoryColumns(legacyDb);

    const columns = legacyDb.prepare("PRAGMA table_info('ai_chat_history')").all() as Array<{ name: string }>;
    const row = legacyDb.prepare('SELECT skill_id, provider_name, provider_model, status FROM ai_chat_history WHERE id = 1').get();
    expect(columns.map(column => column.name)).toEqual(expect.arrayContaining([
      'skill_id', 'provider_name', 'provider_model', 'status',
    ]));
    expect(row).toEqual({ skill_id: null, provider_name: '', provider_model: '', status: 'idle' });
    legacyDb.close();
  });
});

describe('legacy AI provider migration', () => {
  it('removes the obsolete database provider store and its credentials', async () => {
    const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
    const legacyDb = new actual.default(':memory:');
    legacyDb.exec(`
      CREATE TABLE ai_providers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        api_key TEXT NOT NULL
      );
      INSERT INTO ai_providers (name, api_key) VALUES ('Legacy', 'secret');
    `);

    retireLegacyAiProviders(legacyDb);

    expect(legacyDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_providers'").get()).toBeUndefined();
    legacyDb.close();
  });
});
