import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function service(compose: string, name: string) {
  const match = compose.match(
    new RegExp(`^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [a-z][a-z0-9-]+:\\r?$|^volumes:\\r?$)`, 'm'),
  );
  if (!match) throw new Error(`Missing ${name} service`);
  return match[1];
}

describe('security service isolation contract', () => {
  for (const composeFile of ['docker-compose.yml', 'docker-compose.nas.yml']) {
    it(`${composeFile} keeps cc-web independent from the security platform`, () => {
      const compose = read(composeFile);
      const app = service(compose, 'app');

      expect(app).toContain('SECURITY_API_URL: ${SECURITY_API_URL:-}');
      expect(app).toContain('SECURITY_API_KEY: ${SECURITY_API_KEY:-}');
      expect(compose).not.toMatch(/^  sec-ai:\r?$/m);
      expect(compose).not.toContain('security-control');
      expect(compose).not.toContain('sec-ai-egress');
      expect(compose).not.toContain('security-artifacts:');
      expect(compose).not.toContain('security-state:');
      expect(compose).not.toContain('profiles: ["security"]');
    });
  }

  it('does not build or package the sibling security repository', () => {
    const deploy = read('deploy-to-nas.sh');
    expect(deploy).not.toContain('sec_ai_tool');
    expect(deploy).toContain('docker-compose.nas.yml');
  });

  it('documents the separate security platform deployment contract', () => {
    const english = read('README.md');
    const chinese = read('README.zh-CN.md');
    const docs = `${english}\n${chinese}`;

    expect(docs).toContain('../sec_ai_tool');
    expect(docs).toContain('SECURITY_API_URL');
    expect(docs).toContain('3001');
    expect(docs).toContain('separate');
    expect(chinese).toContain('SECURITY_API_URL');
  });

  it('does not expose the security service key to the browser', () => {
    const route = read('app/api/security/[...path]/route.ts');
    expect(route).toContain('Authorization');
    expect(route).toContain('process.env.SECURITY_API_KEY');
    expect(route).not.toContain("request.headers.get('authorization')");
  });
});
