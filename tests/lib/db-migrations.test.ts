import { describe, expect, it, vi } from 'vitest';
import { migrateSubscriptionItemObservationColumns } from '@/lib/db-migrations';

describe('subscription database migrations', () => {
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
});
