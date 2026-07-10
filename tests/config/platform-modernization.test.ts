import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

interface PackageLock {
  packages: Record<string, { version?: string }>;
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('platform modernization', () => {
  it('uses the secure Next.js and transitive dependency baseline', () => {
    const pkg = JSON.parse(read('package.json')) as {
      engines?: { node?: string };
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      overrides?: Record<string, string>;
    };
    const lock = JSON.parse(read('package-lock.json')) as PackageLock;

    expect(pkg.engines?.node).toBe('>=20.19.0');
    expect(pkg.dependencies.next).toBe('16.2.10');
    expect(pkg.dependencies.react).toBe('19.2.7');
    expect(pkg.dependencies['react-dom']).toBe('19.2.7');
    expect(pkg.overrides).toMatchObject({
      dompurify: '^3.4.11',
      'js-yaml': '^3.15.0',
      postcss: '^8.5.16',
      uuid: '^11.1.1',
    });
    expect(lock.packages['node_modules/next']?.version).toBe('16.2.10');
    expect(lock.packages['node_modules/js-yaml']?.version).toBe('3.15.0');
    expect(lock.packages['node_modules/postcss']?.version).toBe('8.5.16');
    expect(lock.packages['node_modules/uuid']?.version).toBe('11.1.1');
    expect(pkg.devDependencies.vite).toBe('^8.1.4');
    expect(pkg.devDependencies['vite-tsconfig-paths']).toBeUndefined();
    expect(pkg.devDependencies.vitest).toBe('^4.1.10');
    expect(lock.packages['node_modules/vite']?.version).toBe('8.1.4');
    expect(lock.packages['node_modules/vitest']?.version).toBe('4.1.10');
  });

  it('uses current Next.js configuration names', () => {
    const config = read('next.config.mjs');

    expect(config).toContain('remotePatterns');
    expect(config).toContain('serverExternalPackages');
    expect(config).not.toContain('images.domains');
    expect(config).not.toContain('serverComponentsExternalPackages');
  });

  it('keeps setup aligned with the SQLite and Node.js runtime', () => {
    const setup = read('setup.sh');

    expect(setup).toContain('20.19.0');
    expect(setup).not.toContain('MongoDB');
    expect(setup).not.toContain('mongo');
  });

  it('packages the Next.js request proxy for NAS deployment', () => {
    const deploy = read('deploy-to-nas.sh');

    expect(deploy).toContain('"proxy.ts"');
    expect(deploy).not.toContain('"middleware.ts"');
  });
});
