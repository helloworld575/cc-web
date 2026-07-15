import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getRuntimePaths } from '@/lib/runtime-paths';
import { getBlogViewCount, getBlogViewCounts } from '@/lib/blog-analytics';
import { orderBlogPosts } from '@/lib/blog-list';

const { postsDir } = getRuntimePaths();
const bundledPostsDir = process.env.SITE_BUNDLED_POSTS_DIR?.trim() || '';

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  brief: string;
  views: number;
}

export interface Post extends PostMeta {
  content: string;
}

function readablePostDirs() {
  const directories = bundledPostsDir && path.resolve(bundledPostsDir) !== path.resolve(postsDir)
    ? [bundledPostsDir, postsDir]
    : [postsDir];
  return directories.filter(directory => fs.existsSync(directory));
}

function resolvePostFile(slug: string) {
  const candidates = [postsDir, bundledPostsDir].filter(Boolean);
  return candidates
    .map(directory => path.join(directory, `${slug}.md`))
    .find(file => fs.existsSync(file));
}

export function normalizePostDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const legacyDate = new Date(text);
  return Number.isNaN(legacyDate.getTime()) ? '' : legacyDate.toISOString().slice(0, 10);
}

export function getPosts(): PostMeta[] {
  const filesBySlug = new Map<string, string>();
  for (const directory of readablePostDirs()) {
    for (const filename of fs.readdirSync(directory).filter(file => file.endsWith('.md'))) {
      filesBySlug.set(filename.replace(/\.md$/, ''), path.join(directory, filename));
    }
  }
  const posts = Array.from(filesBySlug.entries())
    .map(([slug, file]) => {
      const { data, content } = matter(fs.readFileSync(file, 'utf8'));
      const brief = data.brief ?? content.replace(/^#+\s.*$/gm, '').replace(/[`*_#>\[\]\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120).trimEnd();
      return { slug, title: data.title ?? slug, date: normalizePostDate(data.date), brief, views: 0 };
    })
  const orderedPosts = orderBlogPosts(posts);
  const viewCounts = getBlogViewCounts(orderedPosts.map(post => post.slug));
  return orderedPosts.map(post => ({ ...post, views: viewCounts.get(post.slug) || 0 }));
}

export function getPost(slug: string): Post | null {
  const file = resolvePostFile(slug);
  if (!file) return null;
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  const brief = data.brief ?? content.replace(/^#+\s.*$/gm, '').replace(/[`*_#>\[\]\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120).trimEnd();
  return { slug, title: data.title ?? slug, date: normalizePostDate(data.date), brief, views: getBlogViewCount(slug), content };
}

export function savePost(slug: string, title: string, date: string, content: string, brief?: string) {
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });
  const normalizedDate = normalizePostDate(date);
  const fm = `---\ntitle: "${title.replace(/"/g, '\\"')}"\ndate: "${normalizedDate}"${brief ? `\nbrief: "${brief.replace(/"/g, '\\"')}"` : ''}\n---\n`;
  fs.writeFileSync(path.join(postsDir, `${slug}.md`), fm + content);
}

export function deletePost(slug: string) {
  const file = resolvePostFile(slug);
  if (file) fs.unlinkSync(file);
}
