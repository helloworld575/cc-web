import { describe, expect, it } from 'vitest';
import { buildClaudeArgs, isValidSessionId } from '../../scripts/claude-worker-args.mjs';
import { getWorkerConfig, getWorkerReadiness, isPlainObject } from '../../scripts/claude-worker-config.mjs';

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

  it('normalizes invalid worker settings to bounded defaults', () => {
    expect(getWorkerConfig({
      CLAUDE_WORKER_PORT: 'NaN',
      CLAUDE_MAX_PROMPT_CHARS: '-1',
      CLAUDE_REQUEST_TIMEOUT_MS: '0',
      CLAUDE_MAX_OUTPUT_BYTES: 'Infinity',
      CLAUDE_MAX_CONCURRENT_RUNS: '99',
    })).toMatchObject({
      port: 8787,
      maxPromptChars: 20000,
      requestTimeoutMs: 480000,
      maxOutputBytes: 1024 * 1024,
      maxConcurrentRuns: 8,
    });
  });

  it('reports readiness requirements without exposing secrets', () => {
    expect(getWorkerReadiness({})).toEqual({
      ok: false,
      missing: ['CLAUDE_WORKER_TOKEN', 'CLAUDE_API_KEY'],
    });
    expect(getWorkerReadiness({ CLAUDE_WORKER_TOKEN: 'token', ANTHROPIC_API_KEY: 'key' })).toEqual({
      ok: true,
      missing: [],
    });
  });

  it('accepts only JSON object bodies', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([])).toBe(false);
  });
});
