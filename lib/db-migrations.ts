interface SqliteMigrationDatabase {
  exec(sql: string): unknown;
}

export function migrateSubscriptionItemObservationColumns(db: SqliteMigrationDatabase) {
  try {
    db.exec("ALTER TABLE subscription_items ADD COLUMN external_id TEXT NOT NULL DEFAULT ''");
  } catch {
    // column already exists, ignore
  }

  try {
    db.exec('ALTER TABLE subscription_items ADD COLUMN published_at TEXT');
  } catch {
    // column already exists, ignore
  }

  try {
    // SQLite ALTER TABLE accepts only constant defaults. Add the legacy column
    // without an expression, then backfill from the original first-seen time.
    db.exec('ALTER TABLE subscription_items ADD COLUMN last_seen_at TEXT');
  } catch {
    // Fresh databases and already-migrated legacy databases already have it.
  }

  db.exec(`
    UPDATE subscription_items
    SET external_id = CASE
      WHEN trim(url) <> '' THEN url || '#legacy-' || id
      ELSE 'legacy-' || id
    END
    WHERE external_id = '';

    UPDATE subscription_items
    SET last_seen_at = COALESCE(NULLIF(last_seen_at, ''), fetched_at, created_at, datetime('now'))
    WHERE last_seen_at IS NULL OR last_seen_at = ''

    ;

    DROP INDEX IF EXISTS idx_subscription_items_source_external;
    CREATE UNIQUE INDEX idx_subscription_items_source_external
      ON subscription_items(source_id, external_id);
  `);
}
