import { describe, expect, it } from 'vitest';
import {
  toSkillCatalogEntry,
  validateSkillCatalog,
} from '../../scripts/skill-catalog.mjs';

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
  it('rejects an empty skill catalog', () => {
    expect(validateSkillCatalog([])).toContain('catalog: at least one skill is required.');
  });

  it('reports malformed catalog entries without throwing', () => {
    expect(validateSkillCatalog([null, []])).toEqual([
      'catalog: every skill must be an object with a non-empty id.',
      'catalog: every skill must be an object with a non-empty id.',
    ]);
  });

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

  it('rejects root and router skills without children and leaves with children', () => {
    const catalog = [
      skill('empty-root', {
        orchestration: { role: 'root', mode: 'route', children: [] },
      }),
      skill('empty-router', {
        orchestration: { role: 'router', mode: 'route', children: [] },
      }),
      skill('leaf-with-child', {
        orchestration: {
          role: 'leaf',
          mode: 'reference',
          children: [{ skill: 'child', when: 'Continue', mode: 'direct' }],
        },
      }),
      skill('child'),
    ];

    expect(validateSkillCatalog(catalog)).toEqual(expect.arrayContaining([
      'empty-root: root skills must define child routes.',
      'empty-router: router skills must define child routes.',
      'leaf-with-child: leaf skills cannot define child routes.',
    ]));
  });

  it('preserves malformed orchestration values for validation', () => {
    const entry = toSkillCatalogEntry('broken', {
      name: 'broken',
      description: 'broken description',
      invocable: false,
      orchestration: 'bad',
    });

    expect(validateSkillCatalog([entry])).toContain(
      'broken: orchestration must be an object.',
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
