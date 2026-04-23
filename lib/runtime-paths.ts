import path from 'path';

export interface RuntimePaths {
  dbPath: string;
  postsDir: string;
  uploadsDir: string;
  skillsDir: string;
}

export function getRuntimePaths(root = process.cwd()): RuntimePaths {
  return {
    dbPath: process.env.SITE_DB_PATH || path.join(root, 'data', 'site.db'),
    postsDir: process.env.SITE_POSTS_DIR || path.join(root, 'content', 'posts'),
    uploadsDir: process.env.SITE_UPLOADS_DIR || path.join(root, 'uploads'),
    skillsDir: process.env.SITE_SKILLS_DIR || path.join(root, '.claude', 'skills'),
  };
}
