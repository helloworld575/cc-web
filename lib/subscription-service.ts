import crypto from 'crypto';
import db from '@/lib/db';
import { fetchByCategory, type FetchedContent, type FetchedItem } from '@/lib/fetchers';
import { getEnvProviders, type AiProviderConfig } from '@/lib/ai-providers';
import type { InvocableSkill } from '@/lib/skill-taxonomy';
import { logServerEvent, summarizeError } from '@/lib/server-log';
import {
  readUpstreamFailure,
  readUpstreamJson,
  safeFetchError,
  type SafeUpstreamError,
  upstreamEmptyResponseError,
  validateUpstreamSse,
} from '@/lib/ai-upstream';
import {
  buildClaudeHeaders,
  buildClaudeMessagesPayload,
  extractClaudeResponseText,
  getClaudeMessagesUrl,
} from '@/lib/ai-gateway';
import {
  extractResponsesStreamText,
  extractResponsesText,
  getOpenAiApiStyle,
  getOpenAiEndpointUrl,
  isResponsesStreamDone,
} from '@/lib/openai-compatible';
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

interface SubscriptionItem {
  id: number;
  source_id: number;
  external_id: string;
  title: string;
  url: string;
  content: string;
  content_hash: string;
  published_at?: string;
}

export function hasValidSubscriptionCronToken(req: Request) {
  const configuredSecret = process.env.SUBSCRIPTION_CRON_SECRET || process.env.ADMIN_PASSWORD;
  if (!configuredSecret) return false;

  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${configuredSecret}`;
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

export async function crawlSubscriptionSources(sources: SubscriptionSource[]) {
  const results = [];

  for (const source of sources) {
    let fetched: FetchedContent | null;
    try {
      fetched = await fetchByCategory(source.url, source.category);
    } catch (caught) {
      const error = summarizeError(caught);
      const failure = recordCrawlFailure(
        source,
        classifyCrawlFailure(caught),
      );
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

function getLatestSubscriptionItem(sourceId: number) {
  return db
    .prepare('SELECT * FROM subscription_items WHERE source_id = ? ORDER BY fetched_at DESC, id DESC LIMIT 1')
    .get(sourceId) as SubscriptionItem | undefined;
}

function getDefaultEnvAiProvider() {
  return getEnvProviders()[0] as AiProviderConfig | undefined;
}

export function hasSubscriptionAiProvider() {
  return Boolean(getDefaultEnvAiProvider());
}

type BriefGenerationResult =
  | { ok: true; brief: string }
  | ({ ok: false } & SafeUpstreamError);

const LEGACY_FAILURE_BRIEF_PREFIXES = [
  'No default AI provider configured',
  'Brief generation failed:',
];

function isLegacyFailureBrief(brief: string) {
  const normalized = brief.trim();
  return normalized === 'No brief generated'
    || LEGACY_FAILURE_BRIEF_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

async function readResponsesStreamText(upstreamBody: ReadableStream<Uint8Array>) {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const raw = trimmed.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;

      try {
        const parsed = JSON.parse(raw);
        text += extractResponsesStreamText(parsed);
        if (isResponsesStreamDone(parsed)) return text;
      } catch {
        // Ignore malformed SSE lines.
      }
    }
  }

  return text;
}

export async function generateBriefWithSkill(
  skill: InvocableSkill,
  source: {
    id?: number;
    name: string;
    url: string;
    category: string;
    topic?: SubscriptionSource['topic'];
  },
  content: string,
): Promise<BriefGenerationResult> {
  const requestId = `subscription-integrate-${crypto.randomUUID()}`;
  const startedAt = Date.now();
  const provider = getDefaultEnvAiProvider();
  if (!provider) {
    logServerEvent('warn', 'subscription-integrate', 'request_failed', {
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
      error_code: 'PROVIDER_NOT_CONFIGURED',
    });
    return {
      ok: false,
      code: 'provider_not_configured',
      error: 'AI provider is not configured.',
      retryable: false,
    };
  }
  const providerType = provider.api_type;
  const providerModel = provider.model;

  logServerEvent('info', 'subscription-integrate', 'request_started', {
    request_id: requestId,
    provider_type: providerType,
    model: providerModel,
    source_id: source.id,
    source_name: source.name,
    source_category: source.category,
  });

  function completed(text: string) {
    const brief = text.trim();
    if (!brief) {
      const failure = upstreamEmptyResponseError();
      logServerEvent('warn', 'subscription-integrate', 'request_failed', {
        request_id: requestId,
        duration_ms: Date.now() - startedAt,
        provider_type: providerType,
        model: providerModel,
        source_id: source.id,
        error_code: failure.code,
      });
      return { ok: false, ...failure } as BriefGenerationResult;
    }
    logServerEvent('info', 'subscription-integrate', 'request_completed', {
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
      provider_type: providerType,
      model: providerModel,
      source_id: source.id,
      text_chars: brief.length,
    });
    return { ok: true, brief } as BriefGenerationResult;
  }

  const userPrompt = skill.prompt
    .replace('{{content}}', content)
    .replace('{{source_name}}', source.name)
    .replace('{{category}}', source.category)
    .replace('{{topic}}', source.topic || 'ai')
    .replace('{{url}}', source.url);

  try {
    let payload: Record<string, unknown> = {};
    let reqUrl: string;
    let reqHeaders: Record<string, string>;

    const openAiApiStyle = provider.api_type === 'openai'
      ? getOpenAiApiStyle(provider)
      : null;

    if (provider.api_type === 'anthropic') {
      reqUrl = getClaudeMessagesUrl(provider.api_url);
      reqHeaders = buildClaudeHeaders(provider.api_key);
      payload = buildClaudeMessagesPayload({
        model: provider.model,
        maxTokens: 1024,
        stream: false,
        system: skill.system,
        messages: [{ role: 'user', content: userPrompt }],
      });
    } else if (openAiApiStyle === 'responses') {
      reqUrl = getOpenAiEndpointUrl(provider);
      reqHeaders = {
        'Authorization': `Bearer ${provider.api_key}`,
        'content-type': 'application/json',
      };
      payload = {
        model: provider.model,
        max_output_tokens: 4096,
        stream: true,
        instructions: skill.system || undefined,
        input: [
          {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: userPrompt }],
          },
        ],
      };
    } else {
      reqUrl = getOpenAiEndpointUrl(provider);
      reqHeaders = {
        'Authorization': `Bearer ${provider.api_key}`,
        'content-type': 'application/json',
      };
      payload = {
        model: provider.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: userPrompt }],
      };
      if (skill.system) {
        (payload.messages as Array<Record<string, string>>).unshift({ role: 'system', content: skill.system });
      }
    }

    const response = await fetch(reqUrl, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000),
    });

    if (!response.ok) {
      const failure = await readUpstreamFailure(response);
      logServerEvent('warn', 'subscription-integrate', 'request_failed', {
        request_id: requestId,
        duration_ms: Date.now() - startedAt,
        provider_type: provider.api_type,
        model: provider.model,
        source_id: source.id,
        upstream_status: response.status,
        error_code: failure.payload.code,
        upstream_detail: failure.logDetail,
      });
      return { ok: false, ...failure.payload };
    }

    if (provider.api_type === 'anthropic') {
      const parsed = await readUpstreamJson(response);
      if (!parsed.ok) {
        logServerEvent('warn', 'subscription-integrate', 'request_failed', {
          request_id: requestId,
          duration_ms: Date.now() - startedAt,
          provider_type: provider.api_type,
          model: provider.model,
          source_id: source.id,
          error_code: parsed.failure.payload.code,
          upstream_detail: parsed.failure.logDetail,
        });
        return { ok: false, ...parsed.failure.payload };
      }
      return completed(extractClaudeResponseText(parsed.data));
    }

    if (openAiApiStyle === 'responses') {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        const validated = await validateUpstreamSse(response);
        if (!validated.ok) return { ok: false, ...validated.payload };
        return completed(await readResponsesStreamText(validated.body));
      }

      const parsed = await readUpstreamJson(response);
      if (!parsed.ok) return { ok: false, ...parsed.failure.payload };
      return completed(extractResponsesText(parsed.data));
    }

    const parsed = await readUpstreamJson(response);
    if (!parsed.ok) return { ok: false, ...parsed.failure.payload };
    return completed(parsed.data.choices?.[0]?.message?.content || '');
  } catch (error: unknown) {
    const failure = safeFetchError(error);
    logServerEvent('error', 'subscription-integrate', 'request_failed', {
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
      provider_type: provider.api_type,
      model: provider.model,
      source_id: source.id,
      failure_code: failure.code,
      ...summarizeError(error),
    });
    return { ok: false, ...failure };
  }
}

export async function integrateSubscriptionSources(
  skill: InvocableSkill,
  sources: SubscriptionSource[],
) {
  const results = [];

  for (const source of sources) {
    const item = getLatestSubscriptionItem(source.id);
    if (!item) {
      results.push({
        source_id: source.id,
        success: false,
        error: 'No fetched content found. Run subscription crawl first.',
      });
      continue;
    }

    const existing = db
      .prepare('SELECT id, brief FROM subscription_briefs WHERE source_id = ? AND content_hash = ? ORDER BY id DESC LIMIT 1')
      .get(source.id, item.content_hash) as { id: number; brief: string } | undefined;

    if (existing && !isLegacyFailureBrief(existing.brief)) {
      results.push({ source_id: source.id, success: true, cached: true, title: item.title });
      continue;
    }

    const generated = await generateBriefWithSkill(
      skill,
      {
        id: source.id,
        name: source.name,
        url: item.url || source.url,
        category: source.category,
        topic: source.topic,
      },
      item.content,
    );

    if (!generated.ok) {
      results.push({
        source_id: source.id,
        success: false,
        code: generated.code,
        error: generated.error,
        retryable: generated.retryable ?? false,
      });
      continue;
    }

    if (existing) {
      db.prepare(
        "UPDATE subscription_briefs SET title = ?, url = ?, brief = ?, fetched_at = datetime('now'), created_at = datetime('now') WHERE id = ?",
      ).run(item.title, item.url || source.url, generated.brief, existing.id);
    } else {
      db.prepare(
        'INSERT INTO subscription_briefs (source_id, title, url, brief, content_hash) VALUES (?, ?, ?, ?, ?)',
      ).run(source.id, item.title, item.url || source.url, generated.brief, item.content_hash);
    }

    results.push({ source_id: source.id, success: true, title: item.title });
  }

  return { results, total: sources.length };
}
