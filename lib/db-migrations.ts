interface SqliteMigrationDatabase {
  exec(sql: string): unknown;
}

/** Remove the retired database-backed provider store after moving to env-only providers. */
export function retireLegacyAiProviders(db: SqliteMigrationDatabase) {
  db.exec('DROP TABLE IF EXISTS ai_providers');
}

export function migrateAiChatHistoryColumns(db: SqliteMigrationDatabase) {
  for (const statement of [
    "ALTER TABLE ai_chat_history ADD COLUMN skill_id TEXT",
    "ALTER TABLE ai_chat_history ADD COLUMN provider_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ai_chat_history ADD COLUMN provider_model TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE ai_chat_history ADD COLUMN status TEXT NOT NULL DEFAULT 'idle'",
  ]) {
    try {
      db.exec(statement);
    } catch {
      // Fresh databases and already-migrated databases already have the column.
    }
  }

  db.exec(`
    UPDATE ai_chat_history SET status = 'idle'
    WHERE status IS NULL OR status NOT IN ('idle', 'running');
  `);
}

/** Remove state owned by the retired automatic subscription publisher. */
export function retireSubscriptionDailyRuns(db: SqliteMigrationDatabase) {
  db.exec('DROP TABLE IF EXISTS subscription_daily_runs');
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

export function migrateSubscriptionSourceHealthColumns(db: SqliteMigrationDatabase) {
  try {
    db.exec('ALTER TABLE subscription_sources ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0');
  } catch {
    // column already exists, ignore
  }

  try {
    db.exec('ALTER TABLE subscription_sources ADD COLUMN last_error_code TEXT');
  } catch {
    // column already exists, ignore
  }

  try {
    db.exec('ALTER TABLE subscription_sources ADD COLUMN last_failed_at TEXT');
  } catch {
    // column already exists, ignore
  }
}
