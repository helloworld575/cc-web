import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Claude worker security', () => {
  it('requires an internal token and never streams stderr to users', () => {
    const worker = read('scripts/claude-worker.mjs');
    expect(worker).toContain('CLAUDE_WORKER_TOKEN');
    expect(worker).toContain('X-Claude-Worker-Token');
    expect(worker).not.toContain("res.write(`\\n[worker stderr]");
  });

  it('passes the existing auth secret to the worker container', () => {
    const compose = read('docker-compose.nas.yml');
    expect(compose).toContain('CLAUDE_WORKER_TOKEN: ${NEXTAUTH_SECRET:?NEXTAUTH_SECRET is required}');
  });
});
