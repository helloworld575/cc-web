import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('subscription skill contract', () => {
  const skill = fs.readFileSync('.codex/skills/subscription/SKILL.md', 'utf8');

  it('passes the AI/security topic to the prompt and requires Chinese output', () => {
    expect(skill).toContain('Topic: {{topic}}');
    expect(skill).toContain('所有摘要必须使用中文');
  });

  it('requires factual security fields without inventing missing facts', () => {
    for (const phrase of ['漏洞编号', '漏洞类型', '涉及的软件或服务', '受影响版本', '修复或缓解措施', '未发现', '不得编造']) {
      expect(skill).toContain(phrase);
    }
    expect(skill).toContain('主观判断只能出现在片头');
  });
});
