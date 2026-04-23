import path from 'path';
import { describe, expect, it } from 'vitest';

describe('lib/runtime-paths', () => {
  it('uses project-root defaults when no overrides are set', async () => {
    delete process.env.SITE_DB_PATH;
    delete process.env.SITE_POSTS_DIR;
    delete process.env.SITE_UPLOADS_DIR;
    delete process.env.SITE_SKILLS_DIR;

    const { getRuntimePaths } = await import('@/lib/runtime-paths');
    const paths = getRuntimePaths('D:/Projects/cc-web');

    expect(paths.dbPath).toBe(path.join('D:/Projects/cc-web', 'data', 'site.db'));
    expect(paths.postsDir).toBe(path.join('D:/Projects/cc-web', 'content', 'posts'));
    expect(paths.uploadsDir).toBe(path.join('D:/Projects/cc-web', 'uploads'));
    expect(paths.skillsDir).toBe(path.join('D:/Projects/cc-web', '.claude', 'skills'));
  });

  it('prefers explicit env overrides for runtime directories', async () => {
    process.env.SITE_DB_PATH = 'E:/sandbox/e2e/site.db';
    process.env.SITE_POSTS_DIR = 'E:/sandbox/e2e/posts';
    process.env.SITE_UPLOADS_DIR = 'E:/sandbox/e2e/uploads';
    process.env.SITE_SKILLS_DIR = 'E:/sandbox/e2e/skills';

    const { getRuntimePaths } = await import('@/lib/runtime-paths');
    const paths = getRuntimePaths('D:/Projects/cc-web');

    expect(paths.dbPath).toBe('E:/sandbox/e2e/site.db');
    expect(paths.postsDir).toBe('E:/sandbox/e2e/posts');
    expect(paths.uploadsDir).toBe('E:/sandbox/e2e/uploads');
    expect(paths.skillsDir).toBe('E:/sandbox/e2e/skills');
  });
});
