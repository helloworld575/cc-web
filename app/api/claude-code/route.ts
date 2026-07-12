export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getRequestId, logServerEvent, summarizeError } from '@/lib/server-log';

const MAX_PROMPT_CHARS = 20000;
const WORKER_TIMEOUT_MS = 10 * 60_000;

function getWorkerUrl() {
  return process.env.CLAUDE_CODE_WORKER_URL?.replace(/\/$/, '');
}

async function logWorkerFailure(response: Response, requestId: string, startedAt: number) {
  const contentType = response.headers.get('content-type') || '';
  let responseCode: string | undefined;
  if (contentType.toLowerCase().includes('application/json')) {
    const data = await response.json().catch(() => null) as { code?: unknown } | null;
    responseCode = typeof data?.code === 'string' ? data.code : undefined;
  } else {
    await response.body?.cancel().catch(() => undefined);
  }
  logServerEvent('warn', 'claude-code', 'worker_failed', {
    request_id: requestId,
    duration_ms: Date.now() - startedAt,
    upstream_status: response.status,
    content_type: contentType,
    error_code: responseCode,
  });
}

function workerError(code: string, error: string, status = 502, requestId?: string) {
  return Response.json({ code, error }, {
    status,
    headers: requestId ? { 'X-Request-ID': requestId } : undefined,
  });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = rateLimitByIp(req, 'claude-code', 10);
  if (rl) return rl;

  let body: { prompt?: unknown; cwd?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400 });
  if (prompt.length > MAX_PROMPT_CHARS) {
    return Response.json({ error: `Prompt must be ${MAX_PROMPT_CHARS} characters or fewer` }, { status: 400 });
  }

  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    return Response.json({ error: 'Claude Code worker is not configured' }, { status: 503 });
  }
  const workerToken = process.env.NEXTAUTH_SECRET;
  if (!workerToken) {
    return workerError('CLAUDE_WORKER_NOT_CONFIGURED', 'Claude Code worker authentication is not configured.', 503, requestId);
  }

  const payload: { prompt: string; cwd?: string } = { prompt };
  if (typeof body.cwd === 'string' && body.cwd.trim()) {
    payload.cwd = body.cwd.trim();
  }

  logServerEvent('info', 'claude-code', 'request_started', {
    request_id: requestId,
    prompt_chars: prompt.length,
    workspace_set: Boolean(payload.cwd),
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Claude-Worker-Token': workerToken,
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });
  } catch (caught: unknown) {
    logServerEvent('warn', 'claude-code', 'worker_unavailable', {
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
      ...summarizeError(caught),
    });
    return workerError('CLAUDE_WORKER_UNAVAILABLE', 'Claude Code worker is unavailable. Try again later.', 502, requestId);
  }

  if (!upstream.ok) {
    await logWorkerFailure(upstream, requestId, startedAt);
    return workerError('CLAUDE_WORKER_FAILED', 'Claude Code worker failed. Check the server logs and try again.', 502, requestId);
  }
  if (!upstream.body) {
    return workerError('CLAUDE_WORKER_INVALID_RESPONSE', 'Claude Code worker returned an invalid response.', 502, requestId);
  }
  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('text/plain')) {
    await logWorkerFailure(upstream, requestId, startedAt);
    return workerError('CLAUDE_WORKER_INVALID_RESPONSE', 'Claude Code worker returned an invalid response.', 502, requestId);
  }

  let responseBytes = 0;
  const monitoredBody = upstream.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      responseBytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
    flush() {
      logServerEvent('info', 'claude-code', 'request_completed', {
        request_id: requestId,
        duration_ms: Date.now() - startedAt,
        response_bytes: responseBytes,
      });
    },
  }));

  return new Response(monitoredBody, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-ID': requestId,
    },
  });
}
