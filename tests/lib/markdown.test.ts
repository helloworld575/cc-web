import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let postsDir = '';
let bundledPostsDir = '';
let actualFs: typeof import('node:fs');

async function loadMarkdownModule() {
  vi.resetModules();
  vi.doUnmock('fs');
  vi.doUnmock('@/lib/markdown');
  process.env.SITE_POSTS_DIR = postsDir;
  return import('@/lib/markdown');
}

function post(title: string, date: string) {
  return `---\ntitle: "${title}"\ndate: ${date}\n---\n\n# ${title}\n`;
}

describe('blog markdown persistence', () => {
  beforeEach(async () => {
    actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
    postsDir = actualFs.mkdtempSync(path.join(os.tmpdir(), 'cc-web-posts-'));
    bundledPostsDir = actualFs.mkdtempSync(path.join(os.tmpdir(), 'cc-web-bundled-posts-'));
  });

  afterEach(() => {
    delete process.env.SITE_POSTS_DIR;
    delete process.env.SITE_BUNDLED_POSTS_DIR;
    if (postsDir) actualFs.rmSync(postsDir, { recursive: true, force: true });
    if (bundledPostsDir) actualFs.rmSync(bundledPostsDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('normalizes legacy YAML dates and orders newest posts first', async () => {
    actualFs.writeFileSync(path.join(postsDir, 'older.md'), post('Older', '2026-07-08'));
    actualFs.writeFileSync(path.join(postsDir, 'newest.md'), post('Newest', '2026-07-13'));
    actualFs.writeFileSync(path.join(postsDir, 'middle.md'), post('Middle', '2026-07-09'));

    const { getPost, getPosts } = await loadMarkdownModule();

    expect(getPost('newest')?.date).toBe('2026-07-13');
    expect(getPosts().map(item => [item.slug, item.date])).toEqual([
      ['newest', '2026-07-13'],
      ['middle', '2026-07-09'],
      ['older', '2026-07-08'],
    ]);
  });

  it('quotes dates when saving and preserves the canonical date on reload', async () => {
    const { getPost, savePost } = await loadMarkdownModule();

    savePost('round-trip', 'Round trip', '2026-04-23', '# Body', 'Brief');

    const saved = actualFs.readFileSync(path.join(postsDir, 'round-trip.md'), 'utf8');
    expect(saved).toContain('date: "2026-04-23"');
    expect(getPost('round-trip')?.date).toBe('2026-04-23');
  });

  it('reads bundled posts and lets persistent generated posts override the same slug', async () => {
    process.env.SITE_BUNDLED_POSTS_DIR = bundledPostsDir;
    actualFs.writeFileSync(path.join(bundledPostsDir, 'bundled.md'), post('Bundled', '2026-07-15'));
    actualFs.writeFileSync(path.join(bundledPostsDir, 'override.md'), post('Image version', '2026-07-14'));
    actualFs.writeFileSync(path.join(postsDir, 'generated.md'), post('Generated', '2026-07-16'));
    actualFs.writeFileSync(path.join(postsDir, 'override.md'), post('Persistent override', '2026-07-17'));

    const { getPost, getPosts } = await loadMarkdownModule();

    expect(getPosts().map(item => item.title)).toEqual([
      'Persistent override',
      'Generated',
      'Bundled',
    ]);
    expect(getPost('override')?.title).toBe('Persistent override');
    expect(getPost('bundled')?.title).toBe('Bundled');
  });
});
