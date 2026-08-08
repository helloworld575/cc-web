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
 * Categories: x, github, selfblog, rss, json, newsletter, reddit, other
 *
 * Strategies:
 *   x          → Twitter syndication API + fxtwitter profile API
 *   github     → Atom feeds (releases.atom, commits.atom)
 *   selfblog   → Auto-discover RSS/Atom → parse entries → fallback HTML
 *   rss        → Same as selfblog
 *   json       → Structured JSON or Next.js __NEXT_DATA__ feeds
 *   newsletter → Same as selfblog
 *   reddit     → Reddit JSON API (append .json)
 *   other      → Try RSS first, fallback to HTML text extraction
 */

import { fetchPublicHttp } from './safe-fetch';

export interface FetchedContent {
  title: string;
  content: string;
  items?: FetchedItem[];
}

export interface FetchedItem {
  external_id: string;
  title: string;
  text: string;
  date?: string;
  url: string;
}

function decodeXml(value: string) {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .trim();
}

function plainText(value: string, maxChars = 1200) {
  return decodeXml(value)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function tagValue(xml: string, names: string[]) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match?.[1]) return decodeXml(match[1]);
  }
  return '';
}

function normalizeFeedDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function subscriptionFetchError(code: string, message: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

function resolveFeedUrl(value: string, sourceUrl: string) {
  if (!value) return sourceUrl;
  try {
    const resolved = new URL(decodeXml(value), sourceUrl);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:'
      ? resolved.href
      : sourceUrl;
  } catch {
    return sourceUrl;
  }
}

function looksLikeFeed(value: string) {
  return /<(?:rss|feed|rdf:RDF|channel)(?:\s|>)/i.test(value);
}

function logFetchFailure(fetcher: string, target: string, caught: unknown) {
  const errorLike = caught as { name?: unknown; code?: unknown };
  let targetHost = 'invalid-url';
  try { targetHost = new URL(target).host; } catch {}
  console.warn(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'warn',
    scope: 'subscription-fetch',
    event: 'request_failed',
    fetcher,
    target_host: targetHost,
    error_name: typeof errorLike?.name === 'string' ? errorLike.name : 'Error',
    error_code: typeof errorLike?.code === 'string' ? errorLike.code : undefined,
  }));
}

// ─── X / Twitter ────────────────────────────────────────────────────────────
// Uses Twitter syndication API which returns real tweet HTML without auth
async function fetchX(url: string): Promise<FetchedContent | null> {
  const match = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/);
  if (!match) return fetchGeneric(url);
  const username = match[1];

  try {
    const res = await fetchPublicHttp(
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
      const profileRes = await fetchPublicHttp(`https://api.fxtwitter.com/${username}`, {
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
    logFetchFailure('x', url, err);
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
    const res = await fetchPublicHttp(`https://github.com/${owner}/${clean}/releases.atom`, { signal: AbortSignal.timeout(15000) });
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
    const res = await fetchPublicHttp(`https://github.com/${owner}/${clean}/commits.atom`, { signal: AbortSignal.timeout(15000) });
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
    const res = await fetchPublicHttp(`https://github.com/${owner}/${clean}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
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
    const res = await fetchPublicHttp(`https://github.com/${org}.atom`, { signal: AbortSignal.timeout(15000) });
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

  let initialHtml = '';
  try {
    const direct = await fetchPublicHttp(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (direct.ok) {
      const text = await direct.text();
      if (looksLikeFeed(text)) return parseSubscriptionFeed(text, url);
      initialHtml = text;
    }
  } catch { /* continue with discovery */ }

  for (const path of feedPaths) {
    try {
      const res = await fetchPublicHttp(baseUrl + path, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const text = await res.text();
        if (text.includes('<rss') || text.includes('<feed') || text.includes('<channel>')) {
          return parseSubscriptionFeed(text, url);
        }
      }
    } catch { /* try next */ }
  }

  // Check HTML <link> for feed URL
  try {
    const html = initialHtml || await (async () => {
      const res = await fetchPublicHttp(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
      return res.ok ? res.text() : '';
    })();
    if (html) {
      const feedLink = html.match(/<link[^>]*type="application\/(rss|atom)\+xml"[^>]*href="([^"]+)"/)?.[2];
      if (feedLink) {
        const feedUrl = feedLink.startsWith('http') ? feedLink : new URL(feedLink, url).href;
        try {
          const feedRes = await fetchPublicHttp(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
          if (feedRes.ok) {
            const feedText = await feedRes.text();
            if (feedText.includes('<rss') || feedText.includes('<feed') || feedText.includes('<channel>')) {
              return parseSubscriptionFeed(feedText, feedUrl);
            }
          }
        } catch { /* fall through */ }
      }
      return extractFromHTML(html, url);
    }
  } catch { /* ignore */ }

  return fetchGeneric(url);
}

export function parseSubscriptionFeed(xml: string, sourceUrl: string): FetchedContent {
  const items: FetchedItem[] = [];
  const entryRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;
  let count = 0;
  while ((match = entryRegex.exec(xml)) !== null && count < 15) {
    const entry = match[1];
    const title = plainText(tagValue(entry, ['title']), 300);
    const pubDate = tagValue(entry, ['pubDate', 'updated', 'published', 'dc:date']);
    const desc = plainText(tagValue(entry, ['description', 'summary', 'content', 'content:encoded']));
    const link = entry.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i)?.[1]
      || entry.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i)?.[1]
      || tagValue(entry, ['link']);
    const resolvedUrl = resolveFeedUrl(link, sourceUrl);
    const externalId = tagValue(entry, ['guid', 'id']) || resolvedUrl;

    if (title) {
      items.push({
        external_id: externalId,
        title,
        text: desc,
        date: normalizeFeedDate(pubDate),
        url: resolvedUrl,
      });
      count++;
    }
  }

  const feedTitle = plainText(tagValue(xml, ['title']), 300) || sourceUrl;
  const content = items.map(item => {
    const dateText = item.date ? ` (${item.date.slice(0, 10)})` : '';
    return `[${item.title}]${dateText}\n${item.text}${item.url ? `\n${item.url}` : ''}`;
  }).join('\n\n');
  return { title: feedTitle, content: `Latest posts from ${feedTitle}:\n\n${content}`, items };
}

function readJsonText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function readJsonItems(data: any): unknown[] {
  const candidates = [
    data?.data?.list,
    data?.data?.items,
    data?.data?.results,
    data?.pageProps?.blogList,
    data?.props?.pageProps?.blogList,
    data?.items,
    data?.results,
    data?.list,
  ];
  return candidates.find(Array.isArray) || [];
}

function resolveStructuredItemUrl(record: Record<string, unknown>, sourceUrl: string, id: string) {
  const explicitUrl = readJsonText(record, ['url', 'link', 'href']);
  if (explicitUrl) return resolveFeedUrl(explicitUrl, sourceUrl);

  try {
    const source = new URL(sourceUrl);
    const hostname = source.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'stack.chaitin.com' && id) {
      return `https://stack.chaitin.com/techblog/detail/${encodeURIComponent(id)}`;
    }
    if ((hostname === 'threatbook.cn' || hostname === 'threatbook.com') && id) {
      return `${source.origin}/techBlogInfo/${encodeURIComponent(id)}`;
    }
  } catch { /* use the source URL */ }

  return sourceUrl;
}

function normalizeStructuredDate(value: string, sourceUrl: string) {
  if (!value) return undefined;
  let normalized = value;
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();
    if (hostname.includes('threatbook.')
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) {
      normalized = `${value}+08:00`;
    }
  } catch { /* normalize as supplied */ }
  return normalizeFeedDate(normalized);
}

export function parseSubscriptionJsonPayload(payload: string, sourceUrl: string): FetchedContent | null {
  let data: any;
  try {
    data = JSON.parse(payload);
  } catch {
    const nextData = payload.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
    if (!nextData) return null;
    try {
      data = JSON.parse(nextData);
    } catch {
      return null;
    }
  }

  const items: FetchedItem[] = [];
  for (const candidate of readJsonItems(data).slice(0, 15)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const record = candidate as Record<string, unknown>;
    const title = plainText(readJsonText(record, ['title', 'name']), 300);
    if (!title) continue;

    const id = readJsonText(record, ['id', 'guid', 'external_id']);
    const url = resolveStructuredItemUrl(record, sourceUrl, id);
    const text = plainText(readJsonText(record, [
      'subDesc',
      'summary',
      'description',
      'content',
      'text',
      'desc',
    ]), 5000);
    const dateValue = readJsonText(record, [
      'created_time',
      'published_at',
      'date',
      'time',
      'updated_at',
      'last_modify_time',
    ]);

    items.push({
      external_id: id || url,
      title,
      text,
      date: normalizeStructuredDate(dateValue, sourceUrl),
      url,
    });
  }

  if (items.length === 0) return null;
  const sourceTitle = readJsonText(data?.data || {}, ['title', 'name']) || new URL(sourceUrl).hostname;
  const content = items.map(item => {
    const dateText = item.date ? ` (${item.date.slice(0, 10)})` : '';
    return `[${item.title}]${dateText}\n${item.text}${item.url ? `\n${item.url}` : ''}`;
  }).join('\n\n');
  return { title: sourceTitle, content: `Latest posts from ${sourceTitle}:\n\n${content}`, items };
}

async function fetchJson(url: string): Promise<FetchedContent> {
  const response = await fetchPublicHttp(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status === 468) {
      throw subscriptionFetchError('WAF_CHALLENGE', 'Subscription source requires an interactive WAF challenge');
    }
    throw subscriptionFetchError(`HTTP_${response.status}`, `Subscription JSON source returned HTTP ${response.status}`);
  }

  const payload = await response.text();
  if (/SafeLineChallenge|\.safeline\/challenge/i.test(payload)) {
    throw subscriptionFetchError('WAF_CHALLENGE', 'Subscription source requires an interactive WAF challenge');
  }
  const parsed = parseSubscriptionJsonPayload(payload, url);
  if (!parsed) {
    throw subscriptionFetchError('SOURCE_SCHEMA_CHANGED', 'Subscription JSON source schema is not recognized');
  }
  return parsed;
}

// ─── Reddit ─────────────────────────────────────────────────────────────────
async function fetchReddit(url: string): Promise<FetchedContent | null> {
  const jsonUrl = url.replace(/\/$/, '') + '.json';
  try {
    const res = await fetchPublicHttp(jsonUrl, { headers: { 'User-Agent': 'SubscriptionBot/1.0' }, signal: AbortSignal.timeout(15000) });
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
    const res = await fetchPublicHttp(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return extractFromHTML(await res.text(), url);
  } catch (err) {
    logFetchFailure('generic', url, err);
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
    case 'json': return fetchJson(url);
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
    console.error('Categories: x, github, selfblog, rss, json, newsletter, reddit, other');
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
