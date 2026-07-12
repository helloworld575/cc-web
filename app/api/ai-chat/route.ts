export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getEnvProviderById, type AiProviderConfig } from '@/lib/ai-providers';
import {
  readUpstreamFailure,
  safeFetchError,
  safeUpstreamResponse,
  upstreamEmptyResponseError,
  upstreamFirstTokenTimeoutError,
  upstreamInvalidResponseError,
  upstreamStreamIdleTimeoutError,
  validateUpstreamSse,
  type SafeUpstreamError,
} from '@/lib/ai-upstream';
import { DEFAULT_AI_CHAT_SYSTEM_PROMPT, mergeAiChatSystemPrompts } from '@/lib/ai-chat-defaults';
import { getSkill, resolveSkillReference, type Skill } from '@/lib/skills';
import { isInvocableSkill } from '@/lib/skill-taxonomy';
import { getRequestId, logServerEvent, summarizeError } from '@/lib/server-log';
import {
  buildClaudeHeaders,
  buildClaudeMessagesPayload,
  extractClaudeStreamText,
  getClaudeMessagesUrl,
  isClaudeStreamDone,
} from '@/lib/ai-gateway';
import {
  extractResponsesStreamText,
  getOpenAiApiStyle,
  getOpenAiEndpointUrl,
  isResponsesStreamDone,
} from '@/lib/openai-compatible';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const MAX_UPSTREAM_CONTEXT_MESSAGES = 12;
const MAX_UPSTREAM_CONTEXT_CHARS = 16000;
const DEFAULT_AI_CHAT_CONNECT_TIMEOUT_MS = 30_000;
const DEFAULT_AI_CHAT_FIRST_TOKEN_TIMEOUT_MS = 60_000;
const DEFAULT_AI_CHAT_STREAM_IDLE_TIMEOUT_MS = 30_000;

interface AiStreamOptions {
  chatId?: number;
  requestId?: string;
  firstTokenTimeoutMs?: number;
  streamIdleTimeoutMs?: number;
  onText?: (text: string) => void;
  onDone?: () => void;
  onError?: (error: SafeUpstreamError) => void;
  onCancel?: () => void;
}

function readPositiveTimeout(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createStreamWatchdog(options: AiStreamOptions) {
  const firstTokenTimeoutMs = options.firstTokenTimeoutMs ?? DEFAULT_AI_CHAT_FIRST_TOKEN_TIMEOUT_MS;
  const streamIdleTimeoutMs = options.streamIdleTimeoutMs ?? DEFAULT_AI_CHAT_STREAM_IDLE_TIMEOUT_MS;
  let sawText = false;
  let deadline = Date.now() + firstTokenTimeoutMs;

  return {
    markText() {
      sawText = true;
      deadline = Date.now() + streamIdleTimeoutMs;
    },
    read(reader: ReadableStreamDefaultReader<Uint8Array>) {
      const timeoutError = sawText
        ? upstreamStreamIdleTimeoutError()
        : upstreamFirstTokenTimeoutError();
      const remainingMs = Math.max(0, deadline - Date.now());

      return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(timeoutError);
          void reader.cancel(timeoutError).catch(() => undefined);
        }, remainingMs);

        reader.read().then(
          result => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(result);
          },
          caught => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(caught);
          },
        );
      });
    },
  };
}

function createTitle(messages: ChatMessage[]) {
  const firstUserMessage = messages.find(message => message.role === 'user')?.content.trim();
  if (!firstUserMessage) return 'New Chat';
  return firstUserMessage.length > 60
    ? `${firstUserMessage.slice(0, 57)}...`
    : firstUserMessage;
}

function compactMessagesForProvider(messages: ChatMessage[]) {
  const systemMessages = messages.filter(message => message.role === 'system');
  const chatMessages = messages.filter(message => message.role !== 'system');
  const recentChatMessages = chatMessages.slice(-MAX_UPSTREAM_CONTEXT_MESSAGES);
  const compacted = [...systemMessages, ...recentChatMessages];
  let totalChars = 0;
  const withinCharBudget: ChatMessage[] = [];

  for (const message of compacted.reverse()) {
    totalChars += message.content.length;
    if (totalChars > MAX_UPSTREAM_CONTEXT_CHARS && withinCharBudget.length > 0) {
      break;
    }
    withinCharBudget.unshift(message);
  }

  return withinCharBudget;
}

function fillSkillPrompt(template: string, content: string) {
  if (template.includes('{{content}}')) {
    return template.replaceAll('{{content}}', content);
  }

  return `${template.trim()}\n\n${content}`.trim();
}

function buildSkillSystemMessage(skill: Skill): ChatMessage | null {
  const parts = [
    `Active skill: ${skill.name}`,
    skill.description ? `Skill purpose: ${skill.description}` : '',
    skill.output ? `Expected skill output: ${skill.output}` : '',
    skill.system || '',
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return { role: 'system', content: parts.join('\n\n') };
}

function applySkillToLatestUserMessage(messages: ChatMessage[], skill: Skill) {
  const nextMessages = messages.map(message => ({ ...message }));
  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    if (nextMessages[index].role === 'user') {
      nextMessages[index] = {
        ...nextMessages[index],
        content: fillSkillPrompt(skill.prompt || '{{content}}', nextMessages[index].content),
      };
      break;
    }
  }

  const systemMessage = buildSkillSystemMessage(skill);
  return systemMessage ? [systemMessage, ...nextMessages] : nextMessages;
}

function saveNewChat(providerId: number, messages: ChatMessage[]) {
  const title = createTitle(messages);
  const result = db
    .prepare('INSERT INTO ai_chat_history (provider_id, title, messages) VALUES (?, ?, ?)')
    .run(providerId, title, JSON.stringify(messages));
  return { id: Number(result.lastInsertRowid), title };
}

function updateChat(chatId: number, title: string, messages: ChatMessage[]) {
  db.prepare("UPDATE ai_chat_history SET title=?, messages=?, updated_at=datetime('now') WHERE id=?")
    .run(title, JSON.stringify(messages), chatId);
}

function enqueueEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: Record<string, unknown>,
) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

function normalizeAiStreamError(caught: unknown): SafeUpstreamError {
  const errorLike = caught as Partial<SafeUpstreamError>;
  if (typeof errorLike?.code === 'string' && typeof errorLike?.error === 'string') {
    return errorLike as SafeUpstreamError;
  }
  return safeFetchError(caught);
}

function extractUpstreamStreamError(event: any) {
  const candidates = [
    event?.error,
    event?.response?.error,
    event?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate?.message === 'string' && candidate.message.trim()) {
      return candidate.message.trim();
    }
  }

  return '';
}

function buildAnthropicRequest(provider: AiProviderConfig, messages: ChatMessage[]) {
  const systemMessages = messages.filter(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');
  const systemPrompt = mergeAiChatSystemPrompts(
    DEFAULT_AI_CHAT_SYSTEM_PROMPT,
    provider.system_prompt,
    ...systemMessages.map(m => m.content),
  );

  const payload: Record<string, unknown> = {
    ...buildClaudeMessagesPayload({
      model: provider.model,
      maxTokens: provider.max_tokens || undefined,
      stream: true,
      system: systemPrompt,
      messages: chatMessages,
    }),
  };

  return {
    url: getClaudeMessagesUrl(provider.api_url),
    headers: buildClaudeHeaders(provider.api_key),
    body: JSON.stringify(payload),
  };
}

function buildOpenAIRequest(provider: AiProviderConfig, messages: ChatMessage[]) {
  const allMessages: ChatMessage[] = [];
  const systemPrompt = mergeAiChatSystemPrompts(
    DEFAULT_AI_CHAT_SYSTEM_PROMPT,
    provider.system_prompt,
  );
  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt });
  }
  allMessages.push(...messages);

  const payload = {
    model: provider.model,
    max_tokens: provider.max_tokens || 4096,
    stream: true,
    messages: allMessages.map(m => ({ role: m.role, content: m.content })),
  };

  // Determine if the URL already includes the path
  const baseUrl = provider.api_url.replace(/\/$/, '');
  const url = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/v1/chat/completions`;

  return {
    url,
    headers: {
      'Authorization': `Bearer ${provider.api_key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

function buildResponsesRequest(provider: AiProviderConfig, messages: ChatMessage[]) {
  const systemMessages = messages.filter(message => message.role === 'system');
  const chatMessages = messages.filter(message => message.role !== 'system');
  const instructions = mergeAiChatSystemPrompts(
    DEFAULT_AI_CHAT_SYSTEM_PROMPT,
    provider.system_prompt,
    ...systemMessages.map(message => message.content),
  );

  const payload: Record<string, unknown> = {
    model: provider.model,
    max_output_tokens: provider.max_tokens || 4096,
    stream: true,
    input: chatMessages.map(message => ({
      type: 'message',
      role: message.role,
      content: [
        {
          type: message.role === 'assistant' ? 'output_text' : 'input_text',
          text: message.content,
        },
      ],
    })),
  };

  if (instructions) {
    payload.instructions = instructions;
  }

  return {
    url: getOpenAiEndpointUrl(provider),
    headers: {
      'Authorization': `Bearer ${provider.api_key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

function createAnthropicStream(
  upstreamBody: ReadableStream<Uint8Array>,
  options: AiStreamOptions = {},
) {
  const encoder = new TextEncoder();
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let donePersisted = false;
  let hasText = false;

  function finish(controller: ReadableStreamDefaultController<Uint8Array>) {
    if (!hasText) {
      finishWithError(controller, upstreamEmptyResponseError());
      return;
    }
    if (!donePersisted) {
      options.onDone?.();
      donePersisted = true;
    }
    controller.close();
  }

  function finishWithError(controller: ReadableStreamDefaultController<Uint8Array>, caught: unknown) {
    if (!donePersisted) {
      const error = normalizeAiStreamError(caught);
      enqueueEvent(controller, { ...error, request_id: options.requestId });
      options.onError?.(error);
      donePersisted = true;
    }
    try { controller.close(); } catch {}
  }

  return new ReadableStream({
    async start(controller) {
      try {
        if (options.chatId) {
          enqueueEvent(controller, { chat_id: options.chatId, request_id: options.requestId });
        }
        upstreamReader = upstreamBody.getReader();
        const decoder = new TextDecoder();
        const watchdog = createStreamWatchdog(options);
        let buf = '';
        let sawEvent = false;

        while (true) {
          const { done, value } = await watchdog.read(upstreamReader);
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') { finish(controller); return; }
              try {
                const parsed = JSON.parse(raw);
                sawEvent = true;
                const upstreamError = extractUpstreamStreamError(parsed);
                if (upstreamError) {
                  finishWithError(controller, upstreamError);
                  return;
                }
                const text = extractClaudeStreamText(parsed);
                if (text) {
                  hasText = true;
                  watchdog.markText();
                  options.onText?.(text);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
                if (isClaudeStreamDone(parsed)) {
                  finish(controller);
                  return;
                }
              } catch {
                finishWithError(controller, upstreamInvalidResponseError());
                return;
              }
            }
          }
        }
        finishWithError(controller, sawEvent
          ? upstreamInvalidResponseError()
          : upstreamEmptyResponseError());
      } catch (caught) {
        finishWithError(controller, caught);
      }
    },
    cancel() {
      if (!donePersisted) {
        if (hasText) options.onDone?.();
        options.onCancel?.();
        donePersisted = true;
      }
      upstreamReader?.cancel();
    },
  });
}

function createOpenAIStream(
  upstreamBody: ReadableStream<Uint8Array>,
  options: AiStreamOptions = {},
) {
  const encoder = new TextEncoder();
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let donePersisted = false;
  let hasText = false;

  function finish(controller: ReadableStreamDefaultController<Uint8Array>) {
    if (!hasText) {
      finishWithError(controller, upstreamEmptyResponseError());
      return;
    }
    if (!donePersisted) {
      options.onDone?.();
      donePersisted = true;
    }
    controller.close();
  }

  function finishWithError(controller: ReadableStreamDefaultController<Uint8Array>, caught: unknown) {
    if (!donePersisted) {
      const error = normalizeAiStreamError(caught);
      enqueueEvent(controller, { ...error, request_id: options.requestId });
      options.onError?.(error);
      donePersisted = true;
    }
    try { controller.close(); } catch {}
  }

  return new ReadableStream({
    async start(controller) {
      try {
        if (options.chatId) {
          enqueueEvent(controller, { chat_id: options.chatId, request_id: options.requestId });
        }
        upstreamReader = upstreamBody.getReader();
        const decoder = new TextDecoder();
        const watchdog = createStreamWatchdog(options);
        let buf = '';
        let sawEvent = false;

        while (true) {
          const { done, value } = await watchdog.read(upstreamReader);
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') { finish(controller); return; }
              try {
                const parsed = JSON.parse(raw);
                sawEvent = true;
                const upstreamError = extractUpstreamStreamError(parsed);
                if (upstreamError) {
                  finishWithError(controller, upstreamError);
                  return;
                }
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  hasText = true;
                  watchdog.markText();
                  options.onText?.(delta);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
                }
                if (parsed.choices?.[0]?.finish_reason) {
                  finish(controller);
                  return;
                }
              } catch {
                finishWithError(controller, upstreamInvalidResponseError());
                return;
              }
            }
          }
        }
        finishWithError(controller, sawEvent
          ? upstreamInvalidResponseError()
          : upstreamEmptyResponseError());
      } catch (caught) {
        finishWithError(controller, caught);
      }
    },
    cancel() {
      if (!donePersisted) {
        if (hasText) options.onDone?.();
        options.onCancel?.();
        donePersisted = true;
      }
      upstreamReader?.cancel();
    },
  });
}

function createResponsesStream(
  upstreamBody: ReadableStream<Uint8Array>,
  options: AiStreamOptions = {},
) {
  const encoder = new TextEncoder();
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let donePersisted = false;
  let hasText = false;

  function finish(controller: ReadableStreamDefaultController<Uint8Array>) {
    if (!hasText) {
      finishWithError(controller, upstreamEmptyResponseError());
      return;
    }
    if (!donePersisted) {
      options.onDone?.();
      donePersisted = true;
    }
    controller.close();
  }

  function finishWithError(controller: ReadableStreamDefaultController<Uint8Array>, caught: unknown) {
    if (!donePersisted) {
      const error = normalizeAiStreamError(caught);
      enqueueEvent(controller, { ...error, request_id: options.requestId });
      options.onError?.(error);
      donePersisted = true;
    }
    try { controller.close(); } catch {}
  }

  return new ReadableStream({
    async start(controller) {
      try {
        if (options.chatId) {
          enqueueEvent(controller, { chat_id: options.chatId, request_id: options.requestId });
        }
        upstreamReader = upstreamBody.getReader();
        const decoder = new TextDecoder();
        const watchdog = createStreamWatchdog(options);
        let buf = '';
        let sawEvent = false;

        while (true) {
          const { done, value } = await watchdog.read(upstreamReader);
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') { finish(controller); return; }
              try {
                const parsed = JSON.parse(raw);
                sawEvent = true;
                const upstreamError = extractUpstreamStreamError(parsed);
                if (upstreamError) {
                  finishWithError(controller, upstreamError);
                  return;
                }
                const text = extractResponsesStreamText(parsed);
                if (text) {
                  hasText = true;
                  watchdog.markText();
                  options.onText?.(text);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
                if (isResponsesStreamDone(parsed)) {
                  finish(controller);
                  return;
                }
              } catch {
                finishWithError(controller, upstreamInvalidResponseError());
                return;
              }
            }
          }
        }
        finishWithError(controller, sawEvent
          ? upstreamInvalidResponseError()
          : upstreamEmptyResponseError());
      } catch (caught) {
        finishWithError(controller, caught);
      }
    },
    cancel() {
      if (!donePersisted) {
        if (hasText) options.onDone?.();
        options.onCancel?.();
        donePersisted = true;
      }
      upstreamReader?.cancel();
    },
  });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get('provider_id');
  const chats = providerId
    ? db.prepare('SELECT id, provider_id, title, created_at, updated_at FROM ai_chat_history WHERE provider_id = ? ORDER BY updated_at DESC LIMIT 50').all(providerId)
    : db.prepare('SELECT id, provider_id, title, created_at, updated_at FROM ai_chat_history ORDER BY updated_at DESC LIMIT 50').all();

  return Response.json(chats);
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'ai-chat', 30);
  if (rl) return rl;

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { chat_id, provider_id, messages } = body;
  if (!provider_id || !messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'Missing provider_id or messages' }, { status: 400 });
  }

  const skillReference = typeof body.skill === 'string'
    ? body.skill.trim()
    : typeof body.skill_id === 'string'
      ? body.skill_id.trim()
      : '';
  const skill = skillReference
    ? (getSkill(skillReference) ?? resolveSkillReference(skillReference))
    : null;
  if (skillReference && !skill) {
    return Response.json({ error: `Unknown skill: ${skillReference}` }, { status: 400 });
  }
  if (skill && !isInvocableSkill(skill)) {
    return Response.json({ error: `Skill is not invocable: ${skillReference}` }, { status: 400 });
  }

  const provider = getEnvProviderById(Number(provider_id));
  if (!provider) {
    return Response.json({ code: 'provider_not_found', error: 'AI provider not found.' }, { status: 404 });
  }

  const providerId = Number(provider_id);
  let chatId: number | undefined;
  let chatTitle = createTitle(messages);

  if (chat_id) {
    const existing = db.prepare('SELECT * FROM ai_chat_history WHERE id = ?').get(chat_id) as any;
    if (!existing) {
      return Response.json({ error: 'Chat not found' }, { status: 404 });
    }
    chatId = Number(existing.id);
    chatTitle = existing.title || chatTitle;
  }

  logServerEvent('info', 'ai-chat', 'request_started', {
    request_id: requestId,
    provider_id: providerId,
    provider_type: provider.api_type,
    model: provider.model,
    chat_id: chatId,
    message_count: messages.length,
    skill: skill?.name,
  });

  if (process.env.E2E_MOCK_STREAMS === '1') {
    if (!chatId) {
      const saved = saveNewChat(providerId, messages);
      chatId = saved.id;
      chatTitle = saved.title;
    }

    const latestUserMessage = [...messages].reverse().find(
      (message: ChatMessage) => message.role === 'user'
    )?.content ?? 'mock prompt';
    let assistantText = '';
    const chunks = [
      '## Mock response\n\n',
      `Echo: ${latestUserMessage}\n\n`,
      '- streamed item\n',
      '- second item\n\n',
      '| name | score |\n| --- | ---: |\n| alpha | 1 |\n| beta | 2 |\n\n',
      '```csv\nname,score\nalpha,1\nbeta,2\n```\n\n',
      '```md\nflow-ready\n```',
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        enqueueEvent(controller, { chat_id: chatId, request_id: requestId });
        for (const chunk of chunks) {
          assistantText += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
        updateChat(chatId!, chatTitle, [...messages, { role: 'assistant', content: assistantText }]);
        logServerEvent('info', 'ai-chat', 'request_completed', {
          request_id: requestId,
          provider_id: providerId,
          model: provider.model,
          chat_id: chatId,
          duration_ms: Date.now() - startedAt,
          text_chars: assistantText.length,
          mock: true,
        });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Request-ID': requestId,
      },
    });
  }

  const upstreamSourceMessages = skill
    ? applySkillToLatestUserMessage(messages, skill)
    : messages;
  const upstreamMessages = compactMessagesForProvider(upstreamSourceMessages);

  const openAiApiStyle = provider.api_type === 'openai'
    ? getOpenAiApiStyle(provider)
    : null;
  const reqConfig = provider.api_type === 'anthropic'
    ? buildAnthropicRequest(provider, upstreamMessages)
    : openAiApiStyle === 'responses'
      ? buildResponsesRequest(provider, upstreamMessages)
      : buildOpenAIRequest(provider, upstreamMessages);

  let upstream: Response;
  const connectController = new AbortController();
  const connectTimeout = setTimeout(
    () => connectController.abort(new DOMException('AI provider connection timed out.', 'TimeoutError')),
    readPositiveTimeout('AI_CHAT_CONNECT_TIMEOUT_MS', DEFAULT_AI_CHAT_CONNECT_TIMEOUT_MS),
  );
  try {
    upstream = await fetch(reqConfig.url, {
      method: 'POST',
      headers: reqConfig.headers,
      body: reqConfig.body,
      signal: connectController.signal,
    });
  } catch (caught: unknown) {
    const error = safeFetchError(caught);
    logServerEvent('warn', 'ai-chat', 'request_failed', {
      request_id: requestId,
      provider_id: providerId,
      model: provider.model,
      phase: 'connect',
      duration_ms: Date.now() - startedAt,
      error_code: error.code,
      cause: summarizeError(caught),
    });
    const response = safeUpstreamResponse(error);
    response.headers.set('X-Request-ID', requestId);
    return response;
  } finally {
    clearTimeout(connectTimeout);
  }

  if (!upstream.ok) {
    const failure = await readUpstreamFailure(upstream);
    logServerEvent('warn', 'ai-chat', 'request_failed', {
      request_id: requestId,
      provider_id: providerId,
      model: provider.model,
      phase: 'upstream_status',
      duration_ms: Date.now() - startedAt,
      upstream_status: upstream.status,
      error_code: failure.payload.code,
    });
    const response = safeUpstreamResponse(failure.payload);
    response.headers.set('X-Request-ID', requestId);
    return response;
  }
  const validated = await validateUpstreamSse(upstream);
  if (!validated.ok) {
    logServerEvent('warn', 'ai-chat', 'request_failed', {
      request_id: requestId,
      provider_id: providerId,
      model: provider.model,
      phase: 'validate_stream',
      duration_ms: Date.now() - startedAt,
      error_code: validated.payload.code,
    });
    const response = safeUpstreamResponse(validated.payload);
    response.headers.set('X-Request-ID', requestId);
    return response;
  }

  if (!chatId) {
    const saved = saveNewChat(providerId, messages);
    chatId = saved.id;
    chatTitle = saved.title;
  } else {
    updateChat(chatId, chatTitle, messages);
  }

  let assistantText = '';
  const streamOptions = {
    chatId,
    requestId,
    firstTokenTimeoutMs: readPositiveTimeout(
      'AI_CHAT_FIRST_TOKEN_TIMEOUT_MS',
      DEFAULT_AI_CHAT_FIRST_TOKEN_TIMEOUT_MS,
    ),
    streamIdleTimeoutMs: readPositiveTimeout(
      'AI_CHAT_STREAM_IDLE_TIMEOUT_MS',
      DEFAULT_AI_CHAT_STREAM_IDLE_TIMEOUT_MS,
    ),
    onText(text: string) {
      assistantText += text;
    },
    onDone() {
      updateChat(chatId!, chatTitle, [...messages, { role: 'assistant', content: assistantText }]);
      logServerEvent('info', 'ai-chat', 'request_completed', {
        request_id: requestId,
        provider_id: providerId,
        model: provider.model,
        chat_id: chatId,
        duration_ms: Date.now() - startedAt,
        text_chars: assistantText.length,
      });
    },
    onError(error: SafeUpstreamError) {
      logServerEvent('warn', 'ai-chat', 'request_failed', {
        request_id: requestId,
        provider_id: providerId,
        model: provider.model,
        chat_id: chatId,
        phase: 'stream',
        duration_ms: Date.now() - startedAt,
        text_chars: assistantText.length,
        error_code: error.code,
        retryable: error.retryable,
      });
    },
    onCancel() {
      logServerEvent('info', 'ai-chat', 'request_cancelled', {
        request_id: requestId,
        provider_id: providerId,
        model: provider.model,
        chat_id: chatId,
        duration_ms: Date.now() - startedAt,
        text_chars: assistantText.length,
      });
    },
  };
  const stream = provider.api_type === 'anthropic'
    ? createAnthropicStream(validated.body, streamOptions)
    : openAiApiStyle === 'responses'
      ? createResponsesStream(validated.body, streamOptions)
      : createOpenAIStream(validated.body, streamOptions);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Request-ID': requestId,
    },
  });
}
