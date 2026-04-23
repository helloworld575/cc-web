import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Dockerfile', () => {
  it('copies the codex skills directory into the runtime image', () => {
    const dockerfile = fs.readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8');

    expect(dockerfile).toContain('COPY --from=builder /app/.codex ./.codex');
  });
});
