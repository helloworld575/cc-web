import type Database from 'better-sqlite3';

const FAILURE_DISABLE_THRESHOLD = 3;
const MAX_ERROR_CODE_LENGTH = 64;

export function normalizeSubscriptionSourceErrorCode(rawCode: unknown) {
  const normalized = String(rawCode || 'FETCH_ERROR')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_ERROR_CODE_LENGTH);
  return normalized || 'FETCH_ERROR';
}

export function recordSubscriptionSourceFailure(
  db: Database.Database,
  sourceId: number,
  rawCode: unknown,
) {
  const errorCode = normalizeSubscriptionSourceErrorCode(rawCode);
  const row = db.prepare(`
    UPDATE subscription_sources
    SET failure_count = failure_count + 1,
        last_error_code = ?,
        last_failed_at = datetime('now'),
        enabled = CASE
          WHEN failure_count + 1 >= ${FAILURE_DISABLE_THRESHOLD} THEN 0
          ELSE enabled
        END
    WHERE id = ?
    RETURNING failure_count, enabled
  `).get(errorCode, sourceId) as { failure_count: number; enabled: number } | undefined;

  return {
    failureCount: row?.failure_count ?? 0,
    enabled: row?.enabled ?? 0,
    errorCode,
  };
}

export function recordSubscriptionSourceSuccess(db: Database.Database, sourceId: number) {
  db.prepare(`
    UPDATE subscription_sources
    SET failure_count = 0
    WHERE id = ?
  `).run(sourceId);
}
