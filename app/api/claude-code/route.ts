export const runtime = 'nodejs';
import { createHash, randomUUID } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getRequestId, logServerEvent, summarizeError } from '@/lib/server-log';

const MAX_PROMPT_CHARS = 20000;
const WORKER_TIMEOUT_MS = 10 * 60_000;
const STALE_SESSION_MINUTES = 15;

interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantSessionRow {
  id: number;
  session_uuid: string;
  title: string;
  cwd: string;
  messages: string;
  status: 'idle' | 'running';
  created_at?: string;
  updated_at?: string;
}

const SAFE_WORKER_ERRORS: Record<string, { error: string; status: number }> = {
  CLAUDE_TIMEOUT: { error: 'Claude request timed out.', status: 504 },
  CLAUDE_OUTPUT_TOO_LARGE: { error: 'Claude response exceeded the safe output limit.', status: 502 },
  CLAUDE_INVALID_RESPONSE: { error: 'Claude returned an invalid response.', status: 502 },
  CLAUDE_FAILED: { error: 'Claude request failed. Check worker logs.', status: 502 },
  INVALID_SESSION: { error: 'Claude session is invalid.', status: 502 },
  WORKER_NOT_CONFIGURED: { error: 'Claude worker is not configured.', status: 503 },
  UNAUTHORIZED: { error: 'Claude worker rejected the request.', status: 502 },
};

function getWorkerUrl() {
  return process.env.CLAUDE_CODE_WORKER_URL?.replace(/\/$/, '');
}

function sessionHash(sessionId: string) {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 16);
}

function parseMessages(raw: string): AssistantMessage[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((message): message is AssistantMessage => (
      (message?.role === 'user' || message?.role === 'assistant')
      && typeof message?.content === 'string'
    ));
  } catch {
    return [];
  }
}

function releaseStaleSessions() {
  db.prepare(`
    UPDATE claude_assistant_sessions
    SET status = 'idle', updated_at = datetime('now')
    WHERE status = 'running'
      AND updated_at < datetime('now', ?)
  `).run(`-${STALE_SESSION_MINUTES} minutes`);
}

function resetSession(chatId: number, isNew: boolean) {
  if (isNew) {
    db.prepare('DELETE FROM claude_assistant_sessions WHERE id = ?').run(chatId);
    return;
  }
  db.prepare("UPDATE claude_assistant_sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?").run(chatId);
}

function workerError(code: string, error: string, status = 502, requestId?: string) {
  return Response.json({ code, error }, {
    status,
    headers: requestId ? { 'X-Request-ID': requestId } : undefined,
  });
}

async function readWorkerFailure(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return null;
  const data = await response.json().catch(() => null) as { code?: unknown } | null;
  return typeof data?.code === 'string' && SAFE_WORKER_ERRORS[data.code]
    ? data.code
    : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  releaseStaleSessions();
  const rows = db.prepare(`
    SELECT id, title, cwd, status, created_at, updated_at
    FROM claude_assistant_sessions
    ORDER BY updated_at DESC
    LIMIT 50
  `).all();
  return Response.json(rows);
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = rateLimitByIp(req, 'claude-code', 10);
  if (rl) return rl;

  let body: { message?: unknown; prompt?: unknown; cwd?: unknown; chat_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawPrompt = typeof body.message === 'string' ? body.message : body.prompt;
  const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';
  if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400 });
  if (prompt.length > MAX_PROMPT_CHARS) {
    return Response.json({ error: `Prompt must be ${MAX_PROMPT_CHARS} characters or fewer` }, { status: 400 });
  }

  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    return workerError('CLAUDE_WORKER_NOT_CONFIGURED', 'Claude Code worker is not configured.', 503, requestId);
  }
  const workerToken = process.env.NEXTAUTH_SECRET;
  if (!workerToken) {
    return workerError('CLAUDE_WORKER_NOT_CONFIGURED', 'Claude Code worker authentication is not configured.', 503, requestId);
  }

  const requestedChatId = body.chat_id === undefined || body.chat_id === null
    ? null
    : Number(body.chat_id);
  if (requestedChatId !== null && (!Number.isInteger(requestedChatId) || requestedChatId <= 0)) {
    return Response.json({ code: 'CLAUDE_CHAT_INVALID', error: 'Invalid conversation id.' }, { status: 400 });
  }

  releaseStaleSessions();
  const requestedCwd = typeof body.cwd === 'string' && body.cwd.trim()
    ? body.cwd.trim()
    : null;
  let chatId: number;
  let claudeSessionId: string;
  let cwd: string;
  let previousMessages: AssistantMessage[];
  let isNew = false;

  if (requestedChatId !== null) {
    const existing = db.prepare('SELECT * FROM claude_assistant_sessions WHERE id = ?')
      .get(requestedChatId) as AssistantSessionRow | undefined;
    if (!existing) {
      return Response.json({ code: 'CLAUDE_CHAT_NOT_FOUND', error: 'Conversation not found.' }, { status: 404 });
    }
    if (existing.status === 'running') {
      return Response.json({ code: 'CLAUDE_CHAT_BUSY', error: 'Conversation is already running.' }, { status: 409 });
    }
    if (requestedCwd && requestedCwd !== existing.cwd) {
      return Response.json({ code: 'CLAUDE_CWD_LOCKED', error: 'Workspace cannot change after a conversation starts.' }, { status: 409 });
    }

    const acquired = db.prepare(`
      UPDATE claude_assistant_sessions
      SET status = 'running', updated_at = datetime('now')
      WHERE id = ? AND status = 'idle'
    `).run(requestedChatId);
    if (acquired.changes !== 1) {
      return Response.json({ code: 'CLAUDE_CHAT_BUSY', error: 'Conversation is already running.' }, { status: 409 });
    }

    chatId = existing.id;
    claudeSessionId = existing.session_uuid;
    cwd = existing.cwd;
    previousMessages = parseMessages(existing.messages);
  } else {
    isNew = true;
    claudeSessionId = randomUUID();
    cwd = requestedCwd || 'default';
    previousMessages = [];
    const title = prompt.replace(/\s+/g, ' ').slice(0, 80) || 'New Conversation';
    const inserted = db.prepare(`
      INSERT INTO claude_assistant_sessions (session_uuid, title, cwd, messages, status)
      VALUES (?, ?, ?, '[]', 'running')
    `).run(claudeSessionId, title, cwd);
    chatId = Number(inserted.lastInsertRowid);
  }

  const turnIndex = Math.floor(previousMessages.length / 2) + 1;
  const logFields = {
    request_id: requestId,
    chat_id: chatId,
    session_hash: sessionHash(claudeSessionId),
    turn_index: turnIndex,
  };
  logServerEvent('info', 'claude-code', 'request_started', {
    ...logFields,
    prompt_chars: prompt.length,
    workspace_set: Boolean(cwd),
    resumed: !isNew,
  });

  const timeoutSignal = AbortSignal.timeout(WORKER_TIMEOUT_MS);
  const signal = AbortSignal.any([req.signal, timeoutSignal]);
  let upstream: Response;
  try {
    upstream = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Claude-Worker-Token': workerToken,
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({
        prompt,
        cwd,
        session_id: claudeSessionId,
        resume: !isNew,
        turn_index: turnIndex,
      }),
      signal,
    });
  } catch (caught: unknown) {
    resetSession(chatId, isNew);
    const code = req.signal.aborted
      ? 'CLAUDE_CANCELLED'
      : timeoutSignal.aborted
        ? 'CLAUDE_TIMEOUT'
        : 'CLAUDE_WORKER_UNAVAILABLE';
    const status = code === 'CLAUDE_CANCELLED' ? 499 : code === 'CLAUDE_TIMEOUT' ? 504 : 502;
    logServerEvent(code === 'CLAUDE_CANCELLED' ? 'info' : 'warn', 'claude-code', 'request_failed', {
      ...logFields,
      duration_ms: Date.now() - startedAt,
      ...summarizeError(caught),
      error_code: code,
    });
    return workerError(code, code === 'CLAUDE_TIMEOUT'
      ? 'Claude request timed out.'
      : code === 'CLAUDE_CANCELLED'
        ? 'Claude request was cancelled.'
        : 'Claude Code worker is unavailable. Try again later.', status, requestId);
  }

  if (!upstream.ok) {
    const upstreamStatus = upstream.status;
    const responseCode = await readWorkerFailure(upstream);
    const safe = responseCode ? SAFE_WORKER_ERRORS[responseCode] : null;
    resetSession(chatId, isNew);
    logServerEvent('warn', 'claude-code', 'worker_failed', {
      ...logFields,
      duration_ms: Date.now() - startedAt,
      upstream_status: upstreamStatus,
      content_type: upstream.headers.get('content-type') || '',
      error_code: responseCode || 'CLAUDE_WORKER_FAILED',
    });
    return workerError(
      responseCode || 'CLAUDE_WORKER_FAILED',
      safe?.error || 'Claude Code worker failed. Check the server logs and try again.',
      safe?.status || 502,
      requestId,
    );
  }
  if (!upstream.body) {
    resetSession(chatId, isNew);
    return workerError('CLAUDE_WORKER_INVALID_RESPONSE', 'Claude Code worker returned an invalid response.', 502, requestId);
  }
  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('text/plain')) {
    await upstream.body.cancel().catch(() => undefined);
    resetSession(chatId, isNew);
    logServerEvent('warn', 'claude-code', 'worker_failed', {
      ...logFields,
      duration_ms: Date.now() - startedAt,
      upstream_status: upstream.status,
      content_type: contentType,
      error_code: 'CLAUDE_WORKER_INVALID_RESPONSE',
    });
    return workerError('CLAUDE_WORKER_INVALID_RESPONSE', 'Claude Code worker returned an invalid response.', 502, requestId);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let responseText = '';
  let responseBytes = 0;
  let firstByteMs: number | undefined;
  let finished = false;

  const monitoredBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          responseText += decoder.decode();
          const nextMessages: AssistantMessage[] = [
            ...previousMessages,
            { role: 'user', content: prompt },
            { role: 'assistant', content: responseText },
          ];
          db.prepare(`
            UPDATE claude_assistant_sessions
            SET messages = ?, status = 'idle', updated_at = datetime('now')
            WHERE id = ?
          `).run(JSON.stringify(nextMessages), chatId);
          finished = true;
          logServerEvent('info', 'claude-code', 'request_completed', {
            ...logFields,
            duration_ms: Date.now() - startedAt,
            first_byte_ms: firstByteMs,
            response_bytes: responseBytes,
          });
          controller.close();
          return;
        }

        if (firstByteMs === undefined) firstByteMs = Date.now() - startedAt;
        responseBytes += value.byteLength;
        responseText += decoder.decode(value, { stream: true });
        controller.enqueue(value);
      } catch (caught: unknown) {
        if (!finished) resetSession(chatId, isNew);
        logServerEvent('warn', 'claude-code', 'stream_failed', {
          ...logFields,
          duration_ms: Date.now() - startedAt,
          ...summarizeError(caught),
          error_code: 'CLAUDE_STREAM_FAILED',
        });
        controller.error(caught);
      }
    },
    async cancel() {
      if (!finished) resetSession(chatId, isNew);
      await reader.cancel().catch(() => undefined);
      logServerEvent('info', 'claude-code', 'request_cancelled', {
        ...logFields,
        duration_ms: Date.now() - startedAt,
      });
    },
  });

  return new Response(monitoredBody, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-ID': requestId,
      'X-Claude-Chat-ID': String(chatId),
    },
  });
}
