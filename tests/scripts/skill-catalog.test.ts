import { describe, expect, it } from 'vitest';
import { validateSkillCatalog } from '../../scripts/skill-catalog.mjs';

function skill(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    description: `${id} description`,
    invocable: false,
    orchestration: {
      role: 'leaf',
      mode: 'reference',
      children: [],
    },
    ...overrides,
  };
}

describe('validateSkillCatalog', () => {
  it('accepts a valid router tree', () => {
    const catalog = [
      skill('root', {
        orchestration: {
          role: 'root',
          mode: 'route',
          children: [{ skill: 'router', when: 'Choose a branch', mode: 'route' }],
        },
      }),
      skill('router', {
        orchestration: {
          role: 'router',
          mode: 'route',
          children: [{ skill: 'leaf', when: 'Run the task', mode: 'direct' }],
        },
      }),
      skill('leaf'),
    ];

    expect(validateSkillCatalog(catalog)).toEqual([]);
  });

  it('reports missing skill references and duplicate child routes', () => {
    const catalog = [
      skill('root', {
        orchestration: {
          role: 'root',
          mode: 'route',
          children: [
            { skill: 'missing', when: 'Missing target', mode: 'direct' },
            { skill: 'missing', when: 'Duplicate target', mode: 'direct' },
          ],
        },
      }),
    ];

    expect(validateSkillCatalog(catalog)).toEqual(expect.arrayContaining([
      'root: references missing skill "missing".',
      'root: routes to "missing" more than once.',
    ]));
  });

  it('rejects route edges that lead to leaves', () => {
    const catalog = [
      skill('router', {
        orchestration: {
          role: 'router',
          mode: 'route',
          children: [{ skill: 'leaf', when: 'Choose a workflow', mode: 'route' }],
        },
      }),
      skill('leaf'),
    ];

    expect(validateSkillCatalog(catalog)).toContain(
      'router: route target "leaf" has no child routes.',
    );
  });

  it('reports orchestration cycles and invalid invocable contracts', () => {
    const catalog = [
      skill('root', {
        orchestration: {
          role: 'root',
          mode: 'route',
          children: [{ skill: 'leaf', when: 'Continue', mode: 'direct' }],
        },
      }),
      skill('leaf', {
        invocable: true,
        orchestration: {
          role: 'leaf',
          mode: 'direct',
          children: [{ skill: 'root', when: 'Return', mode: 'direct' }],
        },
      }),
    ];

    expect(validateSkillCatalog(catalog)).toEqual(expect.arrayContaining([
      'root: orchestration cycle detected: root -> leaf -> root.',
      'leaf: invocable skills must define non-empty prompt and output values.',
    ]));
  });

  it('requires non-empty skill names and descriptions', () => {
    expect(validateSkillCatalog([
      skill('broken', { name: '', description: '  ' }),
    ])).toEqual(expect.arrayContaining([
      'broken: name must be a non-empty string.',
      'broken: description must be a non-empty string.',
    ]));
  });
});
