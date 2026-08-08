import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('subscription daily retirement contract', () => {
  it('removes the daily API and scheduler assets', () => {
    expect(fs.existsSync(path.join(root, 'app/api/subscriptions/daily/route.ts'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'lib/subscription-daily.ts'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'scripts/crawl-subscriptions.mjs'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'scripts/subscription-schedule.mjs'))).toBe(false);
  });

  it('removes the daily service from deployment and logging configuration', () => {
    for (const file of ['docker-compose.yml', 'docker-compose.nas.yml', 'Dockerfile', 'deploy-to-nas.sh', 'scripts/nas-logs.py', '.env.example']) {
      const source = read(file);
      expect(source).not.toMatch(/subscription-cron|SUBSCRIPTION_(?:CRON|DAILY|PUBLISH)/i);
      expect(source).not.toContain('crawl-subscriptions.mjs');
      expect(source).not.toContain('subscription-schedule.mjs');
    }
  });

  it('does not initialize or index the retired daily run table', () => {
    expect(read('lib/db.ts')).not.toContain('subscription_daily_runs');
  });

  it('removes subscription generation skills and their route registrations', () => {
    for (const skill of ['subscription', 'subscription-ai', 'subscription-security']) {
      expect(fs.existsSync(path.join(root, '.codex/skills', skill))).toBe(false);
    }
    expect(fs.existsSync(path.join(root, 'app/api/subscriptions/integrate/route.ts'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'app/api/subscriptions/fetch/route.ts'))).toBe(false);
    expect(read('lib/subscription-topics.ts')).not.toContain('getSubscriptionGenerationSkillId');
  });
});
