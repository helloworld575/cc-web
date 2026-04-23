import { describe, expect, it } from 'vitest';
import {
  buildSkillOrchestrationForest,
  type SkillSummary,
} from '@/lib/skill-taxonomy';

function makeSkill(
  id: string,
  overrides: Partial<SkillSummary> = {},
): SkillSummary {
  return {
    id,
    name: id,
    description: `${id} description`,
    invocable: false,
    hierarchy: {
      domain: 'agent',
      category: 'skills',
      subcategory: id,
      path: ['agent', 'skills', id],
      order: 100,
    },
    lookup: {
      invoke: `agent/skills/${id}`,
      aliases: [id],
      keywords: [id],
    },
    orchestration: {
      role: 'leaf',
      mode: 'reference',
      children: [],
    },
    ...overrides,
  };
}

describe('buildSkillOrchestrationForest', () => {
  it('builds a routed tree from root skills to nested leaves', () => {
    const forest = buildSkillOrchestrationForest([
      makeSkill('skill-tree-root', {
        orchestration: {
          role: 'root',
          mode: 'route',
          children: [
            { skill: 'content-router', when: 'Need content skill routing', mode: 'route' },
          ],
        },
      }),
      makeSkill('content-router', {
        orchestration: {
          role: 'router',
          mode: 'route',
          children: [
            { skill: 'article-faq', when: 'Generate FAQs for an article', mode: 'direct' },
          ],
        },
      }),
      makeSkill('article-faq', {
        invocable: true,
        output: 'text',
        orchestration: {
          role: 'leaf',
          mode: 'direct',
          children: [],
        },
      }),
    ]);

    expect(forest).toHaveLength(1);
    expect(forest[0].skill.id).toBe('skill-tree-root');
    expect(forest[0].children).toHaveLength(1);
    expect(forest[0].children[0].skill.id).toBe('content-router');
    expect(forest[0].children[0].route.when).toContain('content');
    expect(forest[0].children[0].children[0].skill.id).toBe('article-faq');
    expect(forest[0].children[0].children[0].route.mode).toBe('direct');
  });

  it('returns unassigned skills as standalone roots so every skill remains visible', () => {
    const forest = buildSkillOrchestrationForest([
      makeSkill('standalone-guide'),
      makeSkill('invocable-leaf', {
        invocable: true,
        output: 'content',
        orchestration: {
          role: 'leaf',
          mode: 'direct',
          children: [],
        },
      }),
    ]);

    expect(forest.map(node => node.skill.id)).toEqual(['invocable-leaf', 'standalone-guide']);
  });
});
