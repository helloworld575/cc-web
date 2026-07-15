import { describe, expect, it } from 'vitest';
import { buildClaudeArgs, isValidSessionId } from '../../scripts/claude-worker-args.mjs';

describe('Claude worker session arguments', () => {
  const sessionId = '8b8a90d2-9413-4c75-8cd5-a817af66c76f';

  it('starts a server-owned session on the first turn', () => {
    const args = buildClaudeArgs({
      prompt: 'First question',
      sessionId,
      resume: false,
      systemPrompt: 'System',
    });

    expect(args).toContain('--session-id');
    expect(args).not.toContain('--resume');
    expect(args[args.indexOf('--session-id') + 1]).toBe(sessionId);
  });

  it('resumes the same session on later turns', () => {
    const args = buildClaudeArgs({
      prompt: 'Follow-up',
      sessionId,
      resume: true,
      systemPrompt: 'System',
    });

    expect(args).toContain('--resume');
    expect(args).not.toContain('--session-id');
    expect(args[args.indexOf('--resume') + 1]).toBe(sessionId);
  });

  it('accepts only UUID session identifiers', () => {
    expect(isValidSessionId(sessionId)).toBe(true);
    expect(isValidSessionId('../../other-session')).toBe(false);
  });
});
