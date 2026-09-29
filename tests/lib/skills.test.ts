import { describe, expect, it, vi } from 'vitest';
import { isInvocableSkill } from '@/lib/skill-taxonomy';

describe('on-disk skill contracts', () => {
  it('loads the technical blog writer as a usable app skill', async () => {
    const { getSkill } = await vi.importActual<typeof import('@/lib/skills')>('@/lib/skills');
    const skill = getSkill('technical-blog-writer');

    expect(isInvocableSkill(skill)).toBe(true);
    expect(skill?.output).toBe('text');
    expect(skill?.prompt).toContain('{{topic}}');
    expect(skill?.prompt).toContain('{{content}}');
  });
});
