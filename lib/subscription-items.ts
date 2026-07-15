import type Database from 'better-sqlite3';

interface SubscriptionItemInput {
  sourceId: number;
  externalId: string;
  title: string;
  url: string;
  content: string;
  contentHash: string;
  publishedAt: string | null;
}

export function upsertSubscriptionItem(
  db: Pick<Database.Database, 'prepare'>,
  input: SubscriptionItemInput,
) {
  const inserted = db.prepare(`
    INSERT INTO subscription_items
      (source_id, external_id, title, url, content, content_hash, published_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(source_id, external_id) DO NOTHING
  `).run(
    input.sourceId,
    input.externalId,
    input.title,
    input.url,
    input.content,
    input.contentHash,
    input.publishedAt,
  );

  if (inserted.changes === 1) return { inserted: true };

  db.prepare(`
    UPDATE subscription_items
    SET title = ?, url = ?, content = ?, content_hash = ?, published_at = ?, last_seen_at = datetime('now')
    WHERE source_id = ? AND external_id = ?
  `).run(
    input.title,
    input.url,
    input.content,
    input.contentHash,
    input.publishedAt,
    input.sourceId,
    input.externalId,
  );
  return { inserted: false };
}
