#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';

const root = process.cwd();
const runtimeRoot = path.join(root, '.tmp', 'e2e-runtime');
const dataDir = path.join(runtimeRoot, 'data');
const contentDir = path.join(runtimeRoot, 'content', 'posts');
const uploadsDir = path.join(runtimeRoot, 'uploads');
const dbPath = path.join(dataDir, 'site.db');
const serverPort = '3001';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetRuntimeRoot() {
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  ensureDir(dataDir);
  ensureDir(contentDir);
  ensureDir(uploadsDir);
}

function seedContent() {
  const seededPost = `---
title: "Seeded Hello"
date: 2026-04-30
brief: "A seeded blog entry for Playwright validation."
---

# Seeded Hello

This post exists so the e2e suite can verify the public blog list and post detail pages.
`;

  fs.writeFileSync(path.join(contentDir, 'seeded-hello.md'), seededPost, 'utf8');

  for (let day = 1; day <= 11; day += 1) {
    const paddedDay = String(day).padStart(2, '0');
    const archivedPost = `---
title: "Seeded Archive ${paddedDay}"
date: 2026-04-${paddedDay}
brief: "Archived post ${paddedDay} for pagination validation."
---

# Seeded Archive ${paddedDay}

This archived post exists so the e2e suite can exercise public blog pagination.
`;
    fs.writeFileSync(path.join(contentDir, `seeded-archive-${paddedDay}.md`), archivedPost, 'utf8');
  }
}

function seedUploads() {
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx7cAAAAASUVORK5CYII=',
    'base64'
  );
  fs.writeFileSync(path.join(uploadsDir, 'seeded.png'), png1x1);
}

function seedDatabase() {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      deadline TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS diary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fortune_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT NOT NULL,
      input TEXT NOT NULL DEFAULT '{}',
      preflight TEXT NOT NULL DEFAULT '{}',
      analysis TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      api_type TEXT NOT NULL DEFAULT 'openai',
      api_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      max_tokens INTEGER NOT NULL DEFAULT 4096,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscription_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      enabled INTEGER NOT NULL DEFAULT 1,
      fetch_interval INTEGER NOT NULL DEFAULT 3600,
      last_fetched_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscription_briefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      brief TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.prepare('INSERT INTO todos (text, done, deadline) VALUES (?, ?, ?)').run('Seeded todo from e2e runtime', 0, '2026-05-01');
  db.prepare('INSERT INTO todos (text, done, deadline) VALUES (?, ?, ?)').run('Completed seeded todo', 1, null);
  db.prepare('INSERT INTO diary (date, content) VALUES (?, ?)').run('2026-04-18', 'E2E diary note with **markdown** support.');
  db.prepare('INSERT INTO ai_providers (name, api_type, api_url, api_key, model, system_prompt, max_tokens, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    'Mock Provider',
    'openai',
    'https://example.invalid',
    'mock-key',
    'mock-model',
    'Respond in markdown',
    1024,
    1
  );
  const source = db.prepare('INSERT INTO subscription_sources (name, url, category, enabled) VALUES (?, ?, ?, ?)').run(
    'Seeded Research Feed',
    'https://example.invalid/feed',
    'research',
    1
  );
  db.prepare('INSERT INTO subscription_briefs (source_id, title, url, brief, content_hash) VALUES (?, ?, ?, ?, ?)').run(
    source.lastInsertRowid,
    'E2E Brief',
    'https://example.invalid/brief',
    '## Seeded brief\n\nThis brief is present for Playwright verification.',
    'seeded-brief-hash'
  );

  db.close();
}

function cleanup() {
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
}

resetRuntimeRoot();
seedContent();
seedUploads();
seedDatabase();

const child = spawn(
  'node',
  ['./node_modules/next/dist/bin/next', 'dev', '-p', serverPort, '-H', '127.0.0.1'],
  {
    cwd: root,
    env: {
      ...process.env,
      ADMIN_PASSWORD: 'e2e-strong-pass-123',
      NEXTAUTH_SECRET: 'e2e-secret-for-playwright',
      NEXTAUTH_URL: `http://localhost:${serverPort}`,
      SITE_DB_PATH: dbPath,
      SITE_POSTS_DIR: contentDir,
      SITE_UPLOADS_DIR: uploadsDir,
      E2E_MOCK_STREAMS: '1',
      TRUST_PROXY_HEADERS: '1',
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || 'e2e-mock-key',
      RIGHT_CODE_GPT_API_KEY: process.env.RIGHT_CODE_GPT_API_KEY || 'e2e-right-code-key',
      RIGHT_CODE_GPT_API_URL: process.env.RIGHT_CODE_GPT_API_URL || 'https://www.rightapi.ai/codex',
      RIGHT_CODE_GPT_MODEL: process.env.RIGHT_CODE_GPT_MODEL || 'gpt-5.5',
      RIGHT_CODE_GPT_API_STYLE: process.env.RIGHT_CODE_GPT_API_STYLE || 'responses',
    },
    stdio: 'inherit',
  }
);

let cleaned = false;

function closeAll(exitCode = 0) {
  if (cleaned) return;
  cleaned = true;
  try {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
    }
  } catch {
    // Ignore shutdown races.
  }
  cleanup();
  process.exit(exitCode);
}

child.on('exit', code => {
  cleanup();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => closeAll(130));
process.on('SIGTERM', () => closeAll(143));
