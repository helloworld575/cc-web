import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Claude Code worker configuration', () => {
  it('defaults to text output and a personal assistant system prompt', () => {
    const worker = fs.readFileSync(path.join(process.cwd(), 'scripts/claude-worker.mjs'), 'utf8');
    const workerArgs = fs.readFileSync(path.join(process.cwd(), 'scripts/claude-worker-args.mjs'), 'utf8');

    expect(workerArgs).toContain('--output-format');
    expect(workerArgs).toContain('text');
    expect(workerArgs).toContain('--append-system-prompt');
    expect(worker).toContain('DEFAULT_PERSONAL_ASSISTANT_PROMPT');
  });

  it('exposes personal assistant defaults in the worker image', () => {
    const dockerfile = fs.readFileSync(path.join(process.cwd(), 'Dockerfile.claude-worker'), 'utf8');
    const deployScript = fs.readFileSync(path.join(process.cwd(), 'deploy-to-nas.sh'), 'utf8');

    expect(dockerfile).toContain('CLAUDE_WORKER_ROLE=personal-assistant');
    expect(dockerfile).toContain('CLAUDE_SYSTEM_PROMPT');
    expect(dockerfile).toContain('FROM node:22-alpine');
    expect(dockerfile).toContain('COPY scripts/claude-worker-args.mjs ./claude-worker-args.mjs');
    expect(deployScript).toContain('"scripts/claude-worker-args.mjs"');
  });

  it('logs request lifecycle metadata without dumping raw stderr objects', () => {
    const worker = fs.readFileSync(path.join(process.cwd(), 'scripts/claude-worker.mjs'), 'utf8');

    expect(worker).toContain("'request_started'");
    expect(worker).toContain("'request_completed'");
    expect(worker).toContain('duration_ms');
    expect(worker).toContain('request_id');
    expect(worker).not.toContain("console.error('[claude-worker] claude stderr:'");
  });
});
