import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeOpenAiYaml } from '../../scripts/normalize-codex-skills.mjs';

describe('writeOpenAiYaml', () => {
  it('preserves existing skill-specific Codex metadata', () => {
    const skillDir = mkdtempSync(path.join(tmpdir(), 'codex-skill-'));
    const agentsDir = path.join(skillDir, 'agents');
    const file = path.join(agentsDir, 'openai.yaml');
    const existing = [
      'interface:',
      '  display_name: "API Blog Image Publisher"',
      '  short_description: "Prepare blog and image API calls"',
      '  default_prompt: "Use the specialized publishing prompt"',
      '',
    ].join('\n');

    try {
      mkdirSync(agentsDir);
      writeFileSync(file, existing);
      writeOpenAiYaml(skillDir, 'api-blog-image-publisher');

      expect(readFileSync(file, 'utf8')).toBe(existing);
    } finally {
      rmSync(skillDir, { recursive: true, force: true });
    }
  });

  it('generates an acronym-correct display name when metadata is missing', () => {
    const skillDir = mkdtempSync(path.join(tmpdir(), 'codex-skill-'));
    const file = path.join(skillDir, 'agents', 'openai.yaml');

    try {
      writeOpenAiYaml(skillDir, 'api-blog-image-publisher');

      expect(readFileSync(file, 'utf8')).toContain('display_name: "API Blog Image Publisher"');
    } finally {
      rmSync(skillDir, { recursive: true, force: true });
    }
  });
});
