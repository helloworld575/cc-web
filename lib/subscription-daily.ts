import db from '@/lib/db';
import { savePost } from '@/lib/markdown';
import {
  crawlSubscriptionSources,
  getEnabledSubscriptionSources,
} from '@/lib/subscription-service';
import type { SubscriptionTopic } from '@/lib/subscription-topics';
import { revalidatePath } from 'next/cache';

const DAILY_ENTRY_LIMIT = 12;

export interface DailySubscriptionEntry {
  id: number;
  source_name: string;
  source_url: string;
  title: string;
  url: string;
  excerpt: string;
  published_at?: string | null;
}

interface DailySummary {
  entry_id: number;
  summary: string;
}

function escapeMarkdownLabel(value: string) {
  return value.replace(/[\\[\]]/g, match => `\\${match}`).replace(/\s+/g, ' ').trim();
}

function safeHttpUrl(value: string, fallback = '') {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : fallback;
  } catch {
    return fallback;
  }
}

function markdownSafeUrl(value: string) {
  return value.replace(/[()!\[\]<>\\]/g, character => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
}

function cleanExcerpt(value: string, maxChars = 600) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\`*{}[\]()#+.!_>~-])/g, '\\$1');
}

function formatReferenceDate(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function getShanghaiRunDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function getShanghaiDayUtcBounds(runDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
    throw new Error('Invalid subscription run date');
  }
  const startDate = new Date(`${runDate}T00:00:00+08:00`);
  if (Number.isNaN(startDate.getTime())) throw new Error('Invalid subscription run date');
  return {
    start: startDate.toISOString(),
    end: new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function renderDailySubscriptionPost({
  topic,
  runDate,
  intro,
  entries,
  summaries,
}: {
  topic: SubscriptionTopic;
  runDate: string;
  intro: string;
  entries: DailySubscriptionEntry[];
  summaries: DailySummary[];
}) {
  const summaryByEntry = new Map(
    summaries
      .filter(summary => entries.some(entry => entry.id === summary.entry_id))
      .map(summary => [summary.entry_id, cleanExcerpt(summary.summary)]),
  );
  const topicLabel = topic === 'security' ? '安全' : 'AI';
  const lines = [
    '## 片头',
    '',
    intro.trim() || `${runDate} ${topicLabel} 订阅信息汇总。`,
    '',
    '## 今日信息',
    '',
  ];

  if (entries.length === 0) {
    lines.push('本期抓取完成，但没有可核实的新条目。', '');
  } else {
    entries.forEach((entry, index) => {
      const rawArticleUrl = safeHttpUrl(entry.url, safeHttpUrl(entry.source_url));
      const rawSourceUrl = safeHttpUrl(entry.source_url, rawArticleUrl);
      const articleUrl = markdownSafeUrl(rawArticleUrl);
      const sourceUrl = markdownSafeUrl(rawSourceUrl);
      const title = escapeMarkdownLabel(entry.title || entry.source_name);
      const sourceName = escapeMarkdownLabel(entry.source_name);
      const date = formatReferenceDate(entry.published_at);
      const summary = escapeMarkdownText(summaryByEntry.get(entry.id) || cleanExcerpt(entry.excerpt));

      lines.push(
        `### ${index + 1}. [${title}](${articleUrl})`,
        '',
        `- 来源：[${sourceName}](${sourceUrl})`,
        ...(date ? [`- 发布时间：${date}`] : []),
        `- 内容摘要：${summary || '来源未提供可提取的摘要，请打开原文核对。'}`,
        '',
      );
    });
  }

  lines.push('## 参考信息', '');
  if (entries.length === 0) {
    lines.push('- 本期无可核实条目。');
  } else {
    entries.forEach((entry, index) => {
      const rawArticleUrl = safeHttpUrl(entry.url, safeHttpUrl(entry.source_url));
      const rawSourceUrl = safeHttpUrl(entry.source_url, rawArticleUrl);
      const articleUrl = markdownSafeUrl(rawArticleUrl);
      const sourceUrl = markdownSafeUrl(rawSourceUrl);
      lines.push(
        `${index + 1}. [${escapeMarkdownLabel(entry.title)}](${articleUrl}) — [${escapeMarkdownLabel(entry.source_name)}](${sourceUrl})`,
      );
    });
  }

  return `${lines.join('\n').trim()}\n`;
}

function getDailyEntries(topic: SubscriptionTopic, runDate: string) {
  const bounds = getShanghaiDayUtcBounds(runDate);
  const rows = db.prepare(`
    SELECT
      i.id,
      s.name AS source_name,
      s.url AS source_url,
      i.title,
      i.url,
      i.content AS excerpt,
      i.published_at
    FROM subscription_items i
    JOIN subscription_sources s ON s.id = i.source_id
    WHERE s.enabled = 1
      AND s.topic = ?
      AND i.fetched_at >= datetime(?)
      AND i.fetched_at < datetime(?)
    ORDER BY COALESCE(i.published_at, i.fetched_at) DESC, i.id DESC
    LIMIT 60
  `).all(topic, bounds.start, bounds.end) as DailySubscriptionEntry[];

  const seen = new Set<string>();
  return rows.filter(entry => {
    const key = `${entry.source_url}\n${entry.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, DAILY_ENTRY_LIMIT);
}

interface DailyRunRow {
  status: 'running' | 'published' | 'failed';
  slug: string;
  entry_count: number;
}

function claimDailyPublication(runDate: string, topic: SubscriptionTopic, slug: string) {
  const inserted = db.prepare(`
    INSERT INTO subscription_daily_runs (run_date, topic, status, slug)
    VALUES (?, ?, 'running', ?)
    ON CONFLICT(run_date, topic) DO NOTHING
  `).run(runDate, topic, slug);
  if (inserted.changes === 1) return { claimed: true as const };

  const retried = db.prepare(`
    UPDATE subscription_daily_runs
    SET status = 'running', error_code = NULL, started_at = datetime('now'), updated_at = datetime('now')
    WHERE run_date = ? AND topic = ?
      AND (status = 'failed' OR (status = 'running' AND updated_at < datetime('now', '-30 minutes')))
  `).run(runDate, topic);
  if (retried.changes === 1) return { claimed: true as const };

  const existing = db.prepare(`
    SELECT status, slug, entry_count
    FROM subscription_daily_runs
    WHERE run_date = ? AND topic = ?
  `).get(runDate, topic) as DailyRunRow | undefined;
  return { claimed: false as const, existing };
}

export async function runDailySubscriptionPublishing({
  requestId,
  now = new Date(),
}: {
  requestId: string;
  now?: Date;
}) {
  const runDate = getShanghaiRunDate(now);
  const sources = getEnabledSubscriptionSources();
  const crawl = await crawlSubscriptionSources(sources);
  const successCount = crawl.results.filter(result => result.success).length;
  const publications = (['ai', 'security'] as const).map(topic => {
    const topicLabel = topic === 'security' ? '安全' : 'AI';
    const slug = `${runDate.replace(/-/g, '')}-${topic}-subscription-daily`;
    const claim = claimDailyPublication(runDate, topic, slug);
    if (!claim.claimed) {
      return {
        topic,
        slug: claim.existing?.slug || slug,
        status: claim.existing?.status || 'running',
        entry_count: claim.existing?.entry_count || 0,
        cached: claim.existing?.status === 'published',
      };
    }

    const topicSourceIds = new Set(
      sources.filter(source => source.topic === topic).map(source => source.id),
    );
    const topicSucceeded = crawl.results.some(result => (
      result.success && topicSourceIds.has(result.source_id)
    ));
    if (topicSourceIds.size === 0 || !topicSucceeded) {
      const errorCode = topicSourceIds.size === 0
        ? 'TOPIC_SOURCES_NOT_CONFIGURED'
        : 'TOPIC_CRAWL_FAILED';
      db.prepare(`
        UPDATE subscription_daily_runs
        SET status = 'failed', error_code = ?, updated_at = datetime('now')
        WHERE run_date = ? AND topic = ?
      `).run(errorCode, runDate, topic);
      return { topic, slug, status: 'failed' as const, entry_count: 0, error_code: errorCode };
    }

    const entries = getDailyEntries(topic, runDate);
    const title = `${topicLabel} 订阅日报 | ${runDate}`;
    const intro = entries.length > 0
      ? `本期从已完成抓取的${topicLabel}订阅源中编选 ${entries.length} 条信息。片头用于说明编选范围；正文只保留来源可核实的事实与原文链接。`
      : `本期${topicLabel}订阅抓取已完成，但没有得到可核实的新条目。`;
    const content = renderDailySubscriptionPost({
      topic,
      runDate,
      intro,
      entries,
      summaries: entries.map(entry => ({
        entry_id: entry.id,
        summary: cleanExcerpt(entry.excerpt),
      })),
    });

    try {
      savePost(
        slug,
        title,
        runDate,
        content,
        `每日${topicLabel}订阅汇总，包含明确、可点击的原始参考链接。`,
      );
      db.prepare(`
        UPDATE subscription_daily_runs
        SET status = 'published', entry_count = ?, error_code = NULL, updated_at = datetime('now')
        WHERE run_date = ? AND topic = ?
      `).run(entries.length, runDate, topic);
      revalidatePath(`/blog/${slug}`);
      return { topic, slug, status: 'published' as const, entry_count: entries.length };
    } catch {
      db.prepare(`
        UPDATE subscription_daily_runs
        SET status = 'failed', error_code = 'BLOG_WRITE_FAILED', updated_at = datetime('now')
        WHERE run_date = ? AND topic = ?
      `).run(runDate, topic);
      return { topic, slug, status: 'failed' as const, entry_count: 0, error_code: 'BLOG_WRITE_FAILED' };
    }
  });

  revalidatePath('/blog');
  const publishedCount = publications.filter(item => item.status === 'published').length;
  return {
    request_id: requestId,
    run_date: runDate,
    status: publishedCount === publications.length
      ? 'published' as const
      : publishedCount > 0
        ? 'partial' as const
        : 'failed' as const,
    crawl: {
      total: crawl.total,
      success: successCount,
      failed: crawl.total - successCount,
    },
    publications,
  };
}
