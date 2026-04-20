#!/usr/bin/env npx tsx
/**
 * Subscription Skill — Content Fetcher
 *
 * Standalone script that fetches latest content from various source types.
 * No authentication required for any source.
 *
 * Usage:
 *   npx tsx fetch-content.ts <url> [category]
 *
 * Categories: x, github, selfblog, rss, newsletter, reddit, other
 *
 * Strategies:
 *   x          → Twitter syndication API + fxtwitter profile API
 *   github     → Atom feeds (releases.atom, commits.atom)
 *   selfblog   → Auto-discover RSS/Atom → parse entries → fallback HTML
 *   rss        → Same as selfblog
 *   newsletter → Same as selfblog
 *   reddit     → Reddit JSON API (append .json)
 *   other      → Try RSS first, fallback to HTML text extraction
 */

export interface FetchedContent {
  title: string;
  content: string;
  items?: { title: string; text: string; date?: string; url?: string }[];
}

// ─── X / Twitter ────────────────────────────────────────────────────────────
// Uses Twitter syndication API which returns real tweet HTML without auth
async function fetchX(url: string): Promise<FetchedContent | null> {
  const match = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/);
  if (!match) return fetchGeneric(url);
  const username = match[1];

  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!res.ok) return fetchGeneric(url);

    const html = await res.text();

    // Extract tweet texts embedded as JSON in the syndication page
    const textRegex = /"text":"((?:[^"\\]|\\.)*)"/g;
    const rawTexts: string[] = [];
    let m;
    while ((m = textRegex.exec(html)) !== null) {
      rawTexts.push(m[1]);
    }

    const tweets = rawTexts
      .map(t => {
        try { return t.replace(/\\u[\dA-Fa-f]{4}/g, c => String.fromCharCode(parseInt(c.slice(2), 16))); }
        catch { return t; }
      })
      .filter(t => t.length > 15 && !t.startsWith('{') && !t.startsWith('.') && !t.includes('function'))
      .slice(0, 20);

    if (tweets.length === 0) return fetchGeneric(url);

    // Get user profile via fxtwitter (optional enrichment)
    let profileDesc = '';
    try {
      const profileRes = await fetch(`https://api.fxtwitter.com/${username}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        const u = profile.user || profile;
        profileDesc = `@${u.screen_name || username} (${u.name || username}) — ${u.description || ''} | Followers: ${u.followers || 'N/A'}`;
      }
    } catch { /* ignore */ }

    const content = tweets.map((t, i) => `[Tweet ${i + 1}] ${t}`).join('\n\n');

    return {
      title: `@${username} on X`,
      content: profileDesc ? `Profile: ${profileDesc}\n\nRecent tweets:\n\n${content}` : `Recent tweets from @${username}:\n\n${content}`,
    };
  } catch (err) {
    console.error(`X fetcher failed for ${username}:`, err);
    return fetchGeneric(url);
  }
}

// ─── GitHub ─────────────────────────────────────────────────────────────────
async function fetchGitHub(url: string): Promise<FetchedContent | null> {
  const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  const orgMatch = url.match(/github\.com\/([^/]+)\/?$/);

  if (repoMatch) return fetchGitHubRepo(repoMatch[1], repoMatch[2]);
  if (orgMatch) return fetchGitHubOrg(orgMatch[1]);
  return fetchGeneric(url);
}

async function fetchGitHubRepo(owner: string, repo: string): Promise<FetchedContent | null> {
  const clean = repo.replace(/\.git$/, '');
  const items: string[] = [];

  // Releases atom feed
  try {
    const res = await fetch(`https://github.com/${owner}/${clean}/releases.atom`, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const xml = await res.text();
      for (const entry of xml.split('<entry>').slice(1, 8)) {
        const title = entry.match(/<title>([^<]+)<\/title>/)?.[1] || '';
        const updated = entry.match(/<updated>([^<]+)<\/updated>/)?.[1] || '';
        const content = (entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || '')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
        items.push(`[Release: ${title}] (${updated.slice(0, 10)})\n${content}`);
      }
    }
  } catch { /* ignore */ }

  // Commits atom feed
  try {
    const res = await fetch(`https://github.com/${owner}/${clean}/commits.atom`, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const xml = await res.text();
      for (const entry of xml.split('<entry>').slice(1, 11)) {
        const title = entry.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() || '';
        const updated = entry.match(/<updated>([^<]+)<\/updated>/)?.[1] || '';
        const author = entry.match(/<name>([^<]+)<\/name>/)?.[1] || '';
        items.push(`[Commit] ${title} — by ${author} (${updated.slice(0, 10)})`);
      }
    }
  } catch { /* ignore */ }

  // Repo description via HTML
  let repoDesc = '';
  try {
    const res = await fetch(`https://github.com/${owner}/${clean}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const html = await res.text();
      const desc = html.match(/<p[^>]*class="[^"]*f4[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1]?.replace(/<[^>]+>/g, '').trim();
      if (desc) repoDesc = `Repo description: ${desc}\n\n`;
    }
  } catch { /* ignore */ }

  if (items.length === 0) return fetchGeneric(`https://github.com/${owner}/${clean}`);

  return {
    title: `${owner}/${clean} on GitHub`,
    content: `${repoDesc}Latest activity from ${owner}/${clean}:\n\n${items.join('\n\n')}`,
  };
}

async function fetchGitHubOrg(org: string): Promise<FetchedContent | null> {
  const items: string[] = [];
  try {
    const res = await fetch(`https://github.com/${org}.atom`, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const xml = await res.text();
      for (const entry of xml.split('<entry>').slice(1, 15)) {
        const title = entry.match(/<title[^>]*>([^<]+)<\/title>/)?.[1]?.trim() || '';
        const updated = entry.match(/<updated>([^<]+)<\/updated>/)?.[1] || '';
        if (title) items.push(`[${updated.slice(0, 10)}] ${title}`);
      }
    }
  } catch { /* ignore */ }

  if (items.length === 0) return fetchGeneric(`https://github.com/${org}`);
  return { title: `${org} on GitHub`, content: `Latest public activity from github.com/${org}:\n\n${items.join('\n')}` };
}

// ─── Blog / RSS ─────────────────────────────────────────────────────────────
async function fetchBlog(url: string): Promise<FetchedContent | null> {
  const baseUrl = url.replace(/\/$/, '');
  const feedPaths = ['/feed', '/rss', '/atom.xml', '/feed.xml', '/rss.xml', '/index.xml'];

  for (const path of feedPaths) {
    try {
      const res = await fetch(baseUrl + path, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const text = await res.text();
        if (text.includes('<rss') || text.includes('<feed') || text.includes('<channel>')) {
          return parseRSSFeed(text, url);
        }
      }
    } catch { /* try next */ }
  }

  // Check HTML <link> for feed URL
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const html = await res.text();
      const feedLink = html.match(/<link[^>]*type="application\/(rss|atom)\+xml"[^>]*href="([^"]+)"/)?.[2];
      if (feedLink) {
        const feedUrl = feedLink.startsWith('http') ? feedLink : new URL(feedLink, url).href;
        try {
          const feedRes = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
          if (feedRes.ok) {
            const feedText = await feedRes.text();
            if (feedText.includes('<rss') || feedText.includes('<feed') || feedText.includes('<channel>')) {
              return parseRSSFeed(feedText, url);
            }
          }
        } catch { /* fall through */ }
      }
      return extractFromHTML(html, url);
    }
  } catch { /* ignore */ }

  return fetchGeneric(url);
}

function parseRSSFeed(xml: string, sourceUrl: string): FetchedContent {
  const items: string[] = [];
  const entryRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;
  let count = 0;
  while ((match = entryRegex.exec(xml)) !== null && count < 15) {
    const entry = match[1];
    const title = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
    const pubDate = entry.match(/<(?:pubDate|updated|published)>([^<]+)<\/(?:pubDate|updated|published)>/)?.[1] || '';
    const desc = (entry.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/)?.[1] || '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    const link = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] || entry.match(/<link>([^<]+)<\/link>/)?.[1] || '';

    if (title) {
      const dateStr = pubDate ? ` (${pubDate.slice(0, 10)})` : '';
      items.push(`[${title}]${dateStr}\n${desc}${link ? '\n' + link : ''}`);
      count++;
    }
  }

  const feedTitle = xml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || sourceUrl;
  return { title: feedTitle, content: `Latest posts from ${feedTitle}:\n\n${items.join('\n\n')}` };
}

// ─── Reddit ─────────────────────────────────────────────────────────────────
async function fetchReddit(url: string): Promise<FetchedContent | null> {
  const jsonUrl = url.replace(/\/$/, '') + '.json';
  try {
    const res = await fetch(jsonUrl, { headers: { 'User-Agent': 'SubscriptionBot/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return fetchGeneric(url);

    const data = await res.json();
    const posts = (Array.isArray(data) ? data[0]?.data?.children : data?.data?.children) || [];
    const items = posts.slice(0, 15).map((p: any) => {
      const d = p.data;
      return `[${d.score} pts] ${d.title}\n${(d.selftext || '').slice(0, 200)}${d.selftext?.length > 200 ? '...' : ''}`;
    });

    if (items.length === 0) return fetchGeneric(url);
    return { title: `Reddit: ${url}`, content: `Latest posts:\n\n${items.join('\n\n')}` };
  } catch {
    return fetchGeneric(url);
  }
}

// ─── Generic HTML (fallback) ────────────────────────────────────────────────
export async function fetchGeneric(url: string): Promise<FetchedContent | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return extractFromHTML(await res.text(), url);
  } catch (err) {
    console.error(`Generic fetch failed for ${url}:`, err);
    return null;
  }
}

function extractFromHTML(html: string, url: string): FetchedContent {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : url;

  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (content.length > 10000) content = content.slice(0, 10000);
  return { title, content };
}

// ─── Main dispatcher ────────────────────────────────────────────────────────
export async function fetchByCategory(url: string, category: string): Promise<FetchedContent | null> {
  switch (category) {
    case 'x': return fetchX(url);
    case 'github': return fetchGitHub(url);
    case 'selfblog':
    case 'rss':
    case 'newsletter': return fetchBlog(url);
    case 'reddit': return fetchReddit(url);
    default: return fetchBlog(url);
  }
}

// ─── CLI entry ──────────────────────────────────────────────────────────────
const isMain = typeof require !== 'undefined' && require.main === module;
if (isMain) {
  const [,, url, category = 'other'] = process.argv;
  if (!url) {
    console.error('Usage: npx tsx fetch-content.ts <url> [category]');
    console.error('Categories: x, github, selfblog, rss, newsletter, reddit, other');
    process.exit(1);
  }
  fetchByCategory(url, category).then(result => {
    if (result) {
      console.log(`Title: ${result.title}\n`);
      console.log(result.content);
    } else {
      console.error('Failed to fetch content');
      process.exit(1);
    }
  });
}
