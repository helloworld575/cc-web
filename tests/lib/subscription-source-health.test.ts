import { afterEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import {
  recordSubscriptionSourceFailure,
  recordSubscriptionSourceSuccess,
} from '@/lib/subscription-source-health';

describe('subscription source health', () => {
  let db: Database.Database;

  afterEach(() => db?.close());

  async function createDb() {
    const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
    db = new actual.default(':memory:');
    db.exec(`
      CREATE TABLE subscription_sources (
        id INTEGER PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_error_code TEXT,
        last_failed_at TEXT
      );
      INSERT INTO subscription_sources (id) VALUES (1);
    `);
  }

  it('records safe error codes and disables a source on the third consecutive failure', async () => {
    await createDb();
    recordSubscriptionSourceFailure(db, 1, 'connect timeout <html>');
    recordSubscriptionSourceFailure(db, 1, 'connect timeout <html>');
    const third = recordSubscriptionSourceFailure(db, 1, 'connect timeout <html>');

    expect(third).toMatchObject({ failureCount: 3, enabled: 0, errorCode: 'CONNECT_TIMEOUT_HTML' });
    expect(db.prepare('SELECT failure_count, enabled, last_error_code, last_failed_at FROM subscription_sources WHERE id = 1').get())
      .toMatchObject({ failure_count: 3, enabled: 0, last_error_code: 'CONNECT_TIMEOUT_HTML' });
    expect((db.prepare('SELECT last_error_code FROM subscription_sources WHERE id = 1').get() as { last_error_code: string }).last_error_code)
      .not.toContain('<');
  });

  it('clears the consecutive failure count after a successful crawl', async () => {
    await createDb();
    recordSubscriptionSourceFailure(db, 1, 'HTTP 503');
    recordSubscriptionSourceFailure(db, 1, 'HTTP 503');
    db.prepare('UPDATE subscription_sources SET enabled = 1').run();

    recordSubscriptionSourceSuccess(db, 1);
    expect(db.prepare('SELECT failure_count, enabled FROM subscription_sources WHERE id = 1').get())
      .toEqual({ failure_count: 0, enabled: 1 });
  });
});
