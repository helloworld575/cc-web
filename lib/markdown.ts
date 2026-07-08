import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getRuntimePaths } from '@/lib/runtime-paths';
import { getBlogViewCount, getBlogViewCounts } from '@/lib/blog-analytics';

const { postsDir } = getRuntimePaths();

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

export function getPosts(): PostMeta[] {
  if (!fs.existsSync(postsDir)) return [];
  const posts = fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const slug = f.replace(/\.md$/, '');
      const { data, content } = matter(fs.readFileSync(path.join(postsDir, f), 'utf8'));
      const brief = data.brief ?? content.replace(/^#+\s.*$/gm, '').replace(/[`*_#>\[\]\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120).trimEnd();
      return { slug, title: data.title ?? slug, date: String(data.date ?? ''), brief, views: 0 };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const viewCounts = getBlogViewCounts(posts.map(post => post.slug));
  return posts.map(post => ({ ...post, views: viewCounts.get(post.slug) || 0 }));
}

export function getPost(slug: string): Post | null {
  const file = path.join(postsDir, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  const brief = data.brief ?? content.replace(/^#+\s.*$/gm, '').replace(/[`*_#>\[\]\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120).trimEnd();
  return { slug, title: data.title ?? slug, date: String(data.date ?? ''), brief, views: getBlogViewCount(slug), content };
}

export function savePost(slug: string, title: string, date: string, content: string, brief?: string) {
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });
  const fm = `---\ntitle: "${title.replace(/"/g, '\\"')}"\ndate: ${date}${brief ? `\nbrief: "${brief.replace(/"/g, '\\"')}"` : ''}\n---\n`;
  fs.writeFileSync(path.join(postsDir, `${slug}.md`), fm + content);
}

export function deletePost(slug: string) {
  const file = path.join(postsDir, `${slug}.md`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
