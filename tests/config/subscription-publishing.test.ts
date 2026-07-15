import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('subscription publishing deployment contract', () => {
  it('runs the daily publishing endpoint on a Shanghai calendar schedule', () => {
    const script = fs.readFileSync('scripts/crawl-subscriptions.mjs', 'utf8');
    const compose = fs.readFileSync('docker-compose.nas.yml', 'utf8');

    expect(script).toContain('/api/subscriptions/daily');
    expect(script).toContain('SUBSCRIPTION_DAILY_HOUR');
    expect(compose).toContain('TZ: Asia/Shanghai');
  });

  it('persists generated posts in app data and Claude session state', () => {
    const compose = fs.readFileSync('docker-compose.nas.yml', 'utf8');
    expect(compose).toContain('app-data:/app/data');
    expect(compose).toContain('SITE_POSTS_DIR: /app/data/posts');
    expect(compose).toContain('SITE_BUNDLED_POSTS_DIR: /app/content/posts');
    expect(compose).toContain('claude-state:/home/claude/.claude');
  });
});
