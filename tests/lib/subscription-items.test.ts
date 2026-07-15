import { describe, expect, it, vi } from 'vitest';
import { upsertSubscriptionItem } from '@/lib/subscription-items';

describe('subscription item persistence', () => {
  it('atomically updates a stable external id without creating a duplicate', async () => {
    const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
    const db = new actual.default(':memory:');
    db.exec(`
      CREATE TABLE subscription_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        published_at TEXT,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (source_id, external_id)
      );
    `);

    const first = upsertSubscriptionItem(db, {
      sourceId: 1,
      externalId: 'stable-guid',
      title: 'Original',
      url: 'https://example.com/original',
      content: 'Original facts',
      contentHash: 'hash-1',
      publishedAt: '2026-07-16T01:00:00.000Z',
    });
    const second = upsertSubscriptionItem(db, {
      sourceId: 1,
      externalId: 'stable-guid',
      title: 'Corrected',
      url: 'https://example.com/corrected',
      content: 'Corrected facts',
      contentHash: 'hash-2',
      publishedAt: '2026-07-16T02:00:00.000Z',
    });

    const row = db.prepare('SELECT COUNT(*) AS count, MAX(title) AS title FROM subscription_items').get() as {
      count: number;
      title: string;
    };
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(row).toEqual({ count: 1, title: 'Corrected' });
    db.close();
  });
});
