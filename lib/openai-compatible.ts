import type { AiProviderConfig, OpenAiApiStyle } from '@/lib/ai-providers';

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeOpenAiApiStyle(value: unknown): OpenAiApiStyle | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'responses' || normalized === 'response') return 'responses';
  if (normalized === 'chat' || normalized === 'chat_completions' || normalized === 'chat-completions') {
    return 'chat_completions';
  }
  return null;
}

function isRightCodeCodexUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return (hostname === 'rightapi.ai' || hostname === 'right.codes')
      && parsed.pathname.toLowerCase().split('/').includes('codex');
  } catch {
    const normalized = apiUrl.toLowerCase();
    return (normalized.includes('rightapi.ai') || normalized.includes('right.codes'))
      && normalized.includes('/codex');
  }
}

export function getOpenAiApiStyle(provider: Pick<AiProviderConfig, 'api_url' | 'api_style'>): OpenAiApiStyle {
  const configured = normalizeOpenAiApiStyle(provider.api_style);
  if (configured) return configured;

  const baseUrl = stripTrailingSlashes(provider.api_url).toLowerCase();
  if (baseUrl.endsWith('/v1/responses') || baseUrl.endsWith('/responses')) {
    return 'responses';
  }

  if (isRightCodeCodexUrl(provider.api_url)) {
    return 'responses';
  }

  return 'chat_completions';
}

export function getOpenAiEndpointUrl(provider: Pick<AiProviderConfig, 'api_url' | 'api_style'>) {
  const baseUrl = stripTrailingSlashes(provider.api_url);
  const style = getOpenAiApiStyle(provider);

  if (style === 'responses') {
    if (baseUrl.endsWith('/v1/responses') || baseUrl.endsWith('/responses')) return baseUrl;
    if (baseUrl.endsWith('/v1')) return `${baseUrl}/responses`;
    return `${baseUrl}/v1/responses`;
  }

  if (baseUrl.endsWith('/v1/chat/completions') || baseUrl.endsWith('/chat/completions')) {
    return baseUrl;
  }
  if (baseUrl.endsWith('/v1')) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function collectTextFromContent(value: any) {
  if (typeof value === 'string') return value;
  return [
    value?.text,
    value?.output_text,
    value?.content,
  ].find(item => typeof item === 'string' && item.length > 0) || '';
}

export function extractResponsesText(data: any) {
  const direct = collectTextFromContent(data?.output_text);
  if (direct) return direct;

  const chunks: string[] = [];
  for (const output of asArray(data?.output)) {
    const outputText = collectTextFromContent(output);
    if (outputText) chunks.push(outputText);
    for (const content of asArray((output as any)?.content)) {
      const text = collectTextFromContent(content);
      if (text) chunks.push(text);
    }
  }

  for (const content of asArray(data?.content)) {
    const text = collectTextFromContent(content);
    if (text) chunks.push(text);
  }

  return chunks.join('');
}

export function extractResponsesStreamText(event: any) {
  const type = typeof event?.type === 'string' ? event.type : '';
  if (type === 'response.output_text.delta' && typeof event.delta === 'string') {
    return event.delta;
  }
  if (type.endsWith('.delta') && typeof event.delta === 'string') {
    return event.delta;
  }
  if (type.includes('delta') && typeof event.text === 'string') {
    return event.text;
  }
  if (!type && typeof event?.delta === 'string') {
    return event.delta;
  }
  return '';
}

export function isResponsesStreamDone(event: any) {
  const type = typeof event?.type === 'string' ? event.type : '';
  return event?.done === true
    || type === 'response.completed'
    || type === 'response.done'
    || type === 'response.failed'
    || type === 'response.cancelled'
    || type === 'response.incomplete';
}
