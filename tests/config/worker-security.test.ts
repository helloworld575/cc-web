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

  it('uses a dedicated worker token in both compose profiles', () => {
    const compose = read('docker-compose.nas.yml');
    expect(compose).toContain('CLAUDE_WORKER_TOKEN: ${CLAUDE_WORKER_TOKEN:?CLAUDE_WORKER_TOKEN is required}');
    expect(compose).not.toContain('CLAUDE_WORKER_TOKEN: ${NEXTAUTH_SECRET');
    expect(read('docker-compose.yml')).toContain('CLAUDE_WORKER_TOKEN: ${CLAUDE_WORKER_TOKEN:?CLAUDE_WORKER_TOKEN is required}');
  });
});
