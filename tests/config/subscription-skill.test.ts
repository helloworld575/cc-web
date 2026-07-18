import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

describe('subscription skill contracts', () => {
  const router = fs.readFileSync('.codex/skills/subscription/SKILL.md', 'utf8');
  const security = fs.readFileSync('.codex/skills/subscription-security/SKILL.md', 'utf8');
  const ai = fs.readFileSync('.codex/skills/subscription-ai/SKILL.md', 'utf8');

  it('routes subscription generation to dedicated AI and security leaf skills', () => {
    expect(router).toContain('invocable: false');
    expect(router).toContain('role: router');
    expect(router).toContain('mode: route');
    expect(router).toContain('skill: subscription-security');
    expect(router).toContain('skill: subscription-ai');

    for (const leaf of [security, ai]) {
      expect(leaf).toContain('invocable: true');
      expect(leaf).toContain('role: leaf');
      expect(leaf).toContain('mode: direct');
      expect(leaf).toContain('所有输出必须使用中文');
      expect(leaf).toContain('主观判断只能出现在片头');
      expect(leaf).toContain('不得编造');
    }
  });

  it('loads the router and both leaves through the runtime skill loader', async () => {
    const { getSkill } = await vi.importActual<typeof import('@/lib/skills')>('@/lib/skills');
    const loadedRouter = getSkill('subscription');
    const loadedSecurity = getSkill('subscription-security');
    const loadedAi = getSkill('subscription-ai');

    expect(loadedRouter).toMatchObject({
      invocable: false,
      orchestration: {
        role: 'router',
        mode: 'route',
        children: [
          expect.objectContaining({ skill: 'subscription-ai', mode: 'direct' }),
          expect.objectContaining({ skill: 'subscription-security', mode: 'direct' }),
        ],
      },
    });
    for (const leaf of [loadedSecurity, loadedAi]) {
      expect(leaf).toMatchObject({
        invocable: true,
        output: 'content',
        orchestration: { role: 'leaf', mode: 'direct', children: [] },
      });
      expect(leaf?.prompt).toContain('{{content}}');
      expect(leaf?.system).toContain('所有输出必须使用中文');
    }
    expect(loadedSecurity?.lookup.invoke).not.toBe(loadedAi?.lookup.invoke);
  });

  it('defines category-specific security filtering and display fields', () => {
    for (const category of ['漏洞通告', '威胁情报', '安全事件', '防御研究']) {
      expect(security).toContain(category);
    }
    for (const field of ['漏洞来源', '漏洞级别', '涉及的软件或服务', '信息来源', '信息总结']) {
      expect(security).toContain(field);
    }
    expect(security).toContain('已知遭利用');
    expect(security).toContain('IOC/TTP');
    expect(security).toContain('原文摘要未明确披露');
    expect(security).toContain('不得把威胁情报、安全事件或防御研究强行套用漏洞字段');
  });

  it('defines category-specific AI filtering and display fields', () => {
    for (const category of ['模型与产品', '研究与评测', '开源工程', '行业与治理']) {
      expect(ai).toContain(category);
    }
    for (const field of [
      '模型或产品', 'API/价格/可用范围/限制', '研究主题', '基准结果',
      '项目/版本', '兼容性/迁移要求', '事件或政策', '适用范围',
    ]) expect(ai).toContain(field);
    expect(ai).toContain('官方发布');
    expect(ai).toContain('方法、数据或基准结果');
    expect(ai).toContain('原文摘要未明确披露');
  });

  it('keeps executable eval cases for both generation leaves', () => {
    for (const file of [
      '.codex/skills/subscription-security/evals/evals.json',
      '.codex/skills/subscription-ai/evals/evals.json',
    ]) {
      const evals = JSON.parse(fs.readFileSync(file, 'utf8')) as { evals?: unknown[] };
      expect(evals.evals?.length).toBeGreaterThanOrEqual(3);
    }
  });
});
