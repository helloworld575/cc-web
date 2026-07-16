import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('subscription documentation contract', () => {
  it('documents the administrator-only RSSHub/WeChat2RSS requirement', () => {
    const docs = `${fs.readFileSync('README.md', 'utf8')}\n${fs.readFileSync('README.zh-CN.md', 'utf8')}`;
    expect(docs).toContain('RSSHub');
    expect(docs).toContain('WeChat2RSS');
    expect(docs).toMatch(/管理员.{0,80}(合法|HTTPS).{0,80}(RSSHub|WeChat2RSS)/s);
    expect(docs).toMatch(/不.{0,20}(官方|自动).{0,40}(订阅|抓取)/s);
  });
});
