import crypto from 'crypto';
import db from '@/lib/db';
import { fetchByCategory } from '@/lib/fetchers';
import { getEnvProviders, type AiProviderConfig } from '@/lib/ai-providers';
import type { InvocableSkill } from '@/lib/skill-taxonomy';
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

export interface SubscriptionSource {
  id: number;
  name: string;
  url: string;
  category: string;
  enabled: number;
}

interface SubscriptionItem {
  id: number;
  source_id: number;
  title: string;
  url: string;
  content: string;
  content_hash: string;
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
  return crypto.createHash('md5').update(content).digest('hex');
}

function markSourceFetched(sourceId: number) {
  db.prepare("UPDATE subscription_sources SET last_fetched_at = datetime('now') WHERE id = ?").run(sourceId);
}

export async function crawlSubscriptionSources(sources: SubscriptionSource[]) {
  const results = [];

  for (const source of sources) {
    const fetched = await fetchByCategory(source.url, source.category);
    if (!fetched) {
      results.push({ source_id: source.id, success: false, error: 'Failed to fetch content' });
      continue;
    }

    const contentHash = hashContent(fetched.content);
    const existing = db
      .prepare('SELECT id FROM subscription_items WHERE source_id = ? AND content_hash = ?')
      .get(source.id, contentHash);

    if (existing) {
      markSourceFetched(source.id);
      results.push({ source_id: source.id, success: true, cached: true, title: fetched.title });
      continue;
    }

    db.prepare(
      'INSERT INTO subscription_items (source_id, title, url, content, content_hash) VALUES (?, ?, ?, ?, ?)',
    ).run(source.id, fetched.title, source.url, fetched.content, contentHash);

    markSourceFetched(source.id);
    results.push({ source_id: source.id, success: true, title: fetched.title });
  }

  return { results, total: sources.length };
}

function getLatestSubscriptionItem(sourceId: number) {
  return db
    .prepare('SELECT * FROM subscription_items WHERE source_id = ? ORDER BY fetched_at DESC, id DESC LIMIT 1')
    .get(sourceId) as SubscriptionItem | undefined;
}

function getDefaultEnvAiProvider() {
  return getEnvProviders().find(provider => provider.is_default) as AiProviderConfig | undefined;
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
  source: { name: string; url: string; category: string },
  content: string,
): Promise<string> {
  const provider = getDefaultEnvAiProvider();
  if (!provider) {
    return 'No default AI provider configured. Configure CLAUDE_API_KEY and RIGHT_CODE_GPT_API_KEY in .env.local.';
  }

  const userPrompt = skill.prompt
    .replace('{{content}}', content)
    .replace('{{source_name}}', source.name)
    .replace('{{category}}', source.category)
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
      const error = await response.text();
      console.error('AI API error:', error);
      return `Brief generation failed: AI API returned ${response.status}`;
    }

    if (provider.api_type === 'anthropic') {
      const data = await response.json();
      return extractClaudeResponseText(data) || 'No brief generated';
    }

    if (openAiApiStyle === 'responses') {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        return await readResponsesStreamText(response.body) || 'No brief generated';
      }

      const data = await response.json();
      return extractResponsesText(data) || 'No brief generated';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No brief generated';
  } catch (error: unknown) {
    const errorLike = error as { message?: string };
    console.error('AI brief generation error:', error);
    return `Brief generation failed: ${errorLike?.message || 'Unknown error'}`;
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
      .prepare('SELECT id FROM subscription_briefs WHERE source_id = ? AND content_hash = ?')
      .get(source.id, item.content_hash);

    if (existing) {
      results.push({ source_id: source.id, success: true, cached: true, title: item.title });
      continue;
    }

    const brief = await generateBriefWithSkill(
      skill,
      { name: source.name, url: item.url || source.url, category: source.category },
      item.content,
    );

    db.prepare(
      'INSERT INTO subscription_briefs (source_id, title, url, brief, content_hash) VALUES (?, ?, ?, ?, ?)',
    ).run(source.id, item.title, item.url || source.url, brief, item.content_hash);

    results.push({ source_id: source.id, success: true, title: item.title });
  }

  return { results, total: sources.length };
}
