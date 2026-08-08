import crypto from 'crypto';
import db from '@/lib/db';
import { fetchByCategory, type FetchedContent, type FetchedItem } from '@/lib/fetchers';
import { logServerEvent, summarizeError } from '@/lib/server-log';
import { upsertSubscriptionItem } from '@/lib/subscription-items';
import {
  recordSubscriptionSourceFailure,
  recordSubscriptionSourceSuccess,
} from '@/lib/subscription-source-health';

export interface SubscriptionSource {
  id: number;
  name: string;
  url: string;
  category: string;
  topic: 'ai' | 'security';
  enabled: number;
  failure_count?: number;
  last_error_code?: string | null;
  last_failed_at?: string | null;
}

export function getEnabledSubscriptionSources(sourceId?: number | string | null): SubscriptionSource[] {
  if (sourceId !== undefined && sourceId !== null && sourceId !== '') {
    const source = db
      .prepare('SELECT * FROM subscription_sources WHERE id = ? AND enabled = 1')
      .get(sourceId) as SubscriptionSource | undefined;
    return source ? [source] : [];
  }

  return db
    .prepare('SELECT * FROM subscription_sources WHERE enabled = 1')
    .all() as SubscriptionSource[];
}

function hashContent(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function markSourceFetched(sourceId: number) {
  recordSubscriptionSourceSuccess(db, sourceId);
  db.prepare("UPDATE subscription_sources SET last_fetched_at = datetime('now') WHERE id = ?").run(sourceId);
}

function recordCrawlFailure(source: SubscriptionSource, rawCode: unknown) {
  const health = recordSubscriptionSourceFailure(db, source.id, rawCode);
  return {
    source_id: source.id,
    success: false as const,
    code: health.errorCode,
    error: 'Failed to fetch content',
    failure_count: health.failureCount,
    disabled: health.enabled === 0,
  };
}

function classifyCrawlFailure(caught: unknown) {
  const errorLike = caught as { code?: unknown; name?: unknown; message?: unknown };
  if (typeof errorLike?.code === 'string' && errorLike.code.trim()) return errorLike.code;
  const message = typeof errorLike?.message === 'string' ? errorLike.message.toLowerCase() : '';
  if (message.includes('timeout') && message.includes('html')) return 'CONNECT_TIMEOUT_HTML';
  if (message.includes('timeout')) return 'CONNECT_TIMEOUT';
  if (message.includes('html')) return 'UPSTREAM_HTML_RESPONSE';
  if (message.includes('abort')) return 'REQUEST_ABORTED';
  if (message.includes('enotfound') || message.includes('dns')) return 'DNS_LOOKUP_FAILED';
  const httpStatus = message.match(/\bhttp\s*(\d{3})\b/i)?.[1];
  if (httpStatus) return `HTTP_${httpStatus}`;
  return typeof errorLike?.name === 'string' ? errorLike.name : 'FETCH_ERROR';
}

/** Fetch enabled sources and persist raw, deduplicated items. */
export async function crawlSubscriptionSources(sources: SubscriptionSource[]) {
  const results = [];

  for (const source of sources) {
    let fetched: FetchedContent | null;
    try {
      fetched = await fetchByCategory(source.url, source.category);
    } catch (caught) {
      const error = summarizeError(caught);
      const failure = recordCrawlFailure(source, classifyCrawlFailure(caught));
      logServerEvent('warn', 'subscription-crawl', 'source_failed', {
        source_id: source.id,
        source_category: source.category,
        source_topic: source.topic,
        source_failure_count: failure.failure_count,
        source_disabled: failure.disabled,
        ...error,
      });
      results.push(failure);
      continue;
    }
    if (!fetched) {
      const failure = recordCrawlFailure(source, 'EMPTY_FETCH_RESULT');
      logServerEvent('warn', 'subscription-crawl', 'source_failed', {
        source_id: source.id,
        source_category: source.category,
        source_topic: source.topic,
        error_code: 'EMPTY_FETCH_RESULT',
        source_failure_count: failure.failure_count,
        source_disabled: failure.disabled,
      });
      results.push(failure);
      continue;
    }

    const feedItems: FetchedItem[] = fetched.items?.length
      ? fetched.items
      : [{
          external_id: source.url,
          title: fetched.title,
          url: source.url,
          text: fetched.content,
        }];
    let newItemCount = 0;

    for (const item of feedItems) {
      const canonicalUrl = item.url || source.url;
      const externalId = item.external_id || canonicalUrl;
      const contentHash = hashContent(JSON.stringify({
        externalId,
        title: item.title,
        url: canonicalUrl,
        text: item.text,
        date: item.date || null,
      }));
      const stored = upsertSubscriptionItem(db, {
        sourceId: source.id,
        externalId,
        title: item.title,
        url: canonicalUrl,
        content: item.text,
        contentHash,
        publishedAt: item.date || null,
      });
      if (stored.inserted) newItemCount += 1;
    }

    markSourceFetched(source.id);
    results.push({
      source_id: source.id,
      success: true,
      cached: newItemCount === 0,
      title: fetched.title,
      item_count: feedItems.length,
      new_item_count: newItemCount,
    });
  }

  return { results, total: sources.length };
}
