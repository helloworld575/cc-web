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

  it('marks private surfaces as noindex while keeping public pages discoverable', () => {
    const config = read('next.config.mjs');

    expect(config).toContain("key: 'X-Robots-Tag'");
    for (const pathPrefix of ['/admin/:path*', '/api/:path*', '/tools/:path*', '/login']) {
      expect(config).toContain(`source: '${pathPrefix}'`);
    }
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

  it('server-renders the saved locale and provides one shared locale context', () => {
    const layout = read('app/layout.tsx');

    expect(layout).toContain("cookies()");
    expect(layout).toContain('LocaleProvider');
    expect(layout).toContain('initialLocale={locale}');
    expect(layout).toContain('lang={localeToHtmlLang(locale)}');
  });

  it('keeps Chinese copy for every tools tab without falling back to English', () => {
    const tools = read('app/tools/page.tsx');
    const chineseCopy = tools.slice(tools.indexOf('  zh: {'), tools.indexOf('} as const;'));

    expect(chineseCopy).toContain("image: {");
    expect(chineseCopy).toContain("eyebrow: '创作'");
    expect(chineseCopy).toContain('生成图片');
  });

  it('keeps AI client errors structured and localized instead of rendering upstream text', () => {
    for (const file of [
      'components/AIImageTool.tsx',
      'components/AIChatTool.tsx',
      'components/ClaudeCodeTool.tsx',
    ]) {
      const source = read(file);
      expect(source).toContain("@/lib/client-api-error");
      expect(source).not.toContain('response.text()');
    }
  });

  it('optimizes image transfer paths and lazy-loads rendered markdown images', () => {
    const imageTool = read('components/AIImageTool.tsx');
    const xPost = read('app/admin/x-post/page.tsx');
    const blogPost = read('app/blog/[slug]/PostClient.tsx');
    const streamingMarkdown = read('components/StreamingMarkdown.tsx');

    expect(imageTool).toContain('compressReferenceImage');
    expect(imageTool).toContain("'image/webp'");
    expect(xPost).not.toContain('/api/uploads/');
    expect(blogPost).toContain('loading="lazy"');
    expect(blogPost).toContain('decoding="async"');
    expect(streamingMarkdown).toContain('loading="lazy"');
    expect(streamingMarkdown).toContain('decoding="async"');
  });
});
