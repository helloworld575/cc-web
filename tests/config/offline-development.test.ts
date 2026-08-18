import fs from 'node:fs';

describe('offline security development documentation contract', () => {
  it('documents the local entry point and optional external integration in both languages', () => {
    const english = fs.readFileSync('README.md', 'utf8');
    const chinese = fs.readFileSync('README.zh-CN.md', 'utf8');
    const docs = `${english}\n${chinese}`;

    expect(english).toContain('### Local/offline development without NAS');
    expect(chinese).toContain('### NAS 不可用时的本地/离线开发');
    expect(docs).toContain('npm run dev');
    expect(docs).toContain('npm test');
    expect(docs).toContain('SECURITY_API_URL');
    expect(docs).toContain('Docker daemon');
    expect(docs).toContain('SECURITY_NOT_CONFIGURED');
    expect(docs).toContain('docker compose config');
  });
});
