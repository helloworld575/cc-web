export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { getPosts } from '@/lib/markdown';

interface ViewRow {
  slug: string;
  views: number;
  latest_viewed_at: string | null;
}

interface CommentCountRow {
  slug: string;
  comments: number;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const posts = getPosts();
  const totalViewsRow = db.prepare('SELECT COUNT(*) as views FROM blog_view_events').get() as { views?: number } | undefined;
  const viewRows = db.prepare(`
    SELECT slug, COUNT(*) as views, MAX(created_at) as latest_viewed_at
    FROM blog_view_events
    GROUP BY slug
  `).all() as ViewRow[];
  const commentRows = db.prepare(`
    SELECT slug, COUNT(*) as comments
    FROM blog_comments
    GROUP BY slug
  `).all() as CommentCountRow[];
  const sourceRows = db.prepare(`
    SELECT source, COUNT(*) as views
    FROM blog_view_events
    GROUP BY source
    ORDER BY views DESC, source ASC
    LIMIT 20
  `).all();
  const recentViews = db.prepare(`
    SELECT slug, source, referrer, created_at
    FROM blog_view_events
    ORDER BY created_at DESC
    LIMIT 30
  `).all();
  const recentComments = db.prepare(`
    SELECT id, slug, author, content, created_at
    FROM blog_comments
    ORDER BY created_at DESC
    LIMIT 30
  `).all();

  const viewsBySlug = new Map(viewRows.map(row => [row.slug, row]));
  const commentsBySlug = new Map(commentRows.map(row => [row.slug, Number(row.comments || 0)]));

  return Response.json({
    totalViews: Number(totalViewsRow?.views || 0),
    posts: posts.map(post => {
      const stats = viewsBySlug.get(post.slug);
      return {
        slug: post.slug,
        title: post.title,
        date: post.date,
        views: Number(stats?.views || 0),
        comments: commentsBySlug.get(post.slug) || 0,
        latestViewedAt: stats?.latest_viewed_at || null,
      };
    }),
    sources: sourceRows,
    recentViews,
    recentComments,
  });
}
