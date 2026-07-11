export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';

const MAX_PROMPT_CHARS = 20000;
const WORKER_TIMEOUT_MS = 10 * 60_000;

function getWorkerUrl() {
  return process.env.CLAUDE_CODE_WORKER_URL?.replace(/\/$/, '');
}

async function logWorkerFailure(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const detail = await response.text().catch(() => response.statusText);
  console.warn('[claude-code] worker failure', {
    status: response.status,
    contentType,
    detail: detail.replace(/\s+/g, ' ').slice(0, 500),
  });
}

function workerError(code: string, error: string, status = 502) {
  return Response.json({ code, error }, { status });
}

export async function POST(req: Request) {
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
    return workerError('CLAUDE_WORKER_NOT_CONFIGURED', 'Claude Code worker authentication is not configured.', 503);
  }

  const payload: { prompt: string; cwd?: string } = { prompt };
  if (typeof body.cwd === 'string' && body.cwd.trim()) {
    payload.cwd = body.cwd.trim();
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Claude-Worker-Token': workerToken,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });
  } catch (caught: unknown) {
    console.warn('[claude-code] worker request failed', caught);
    return workerError('CLAUDE_WORKER_UNAVAILABLE', 'Claude Code worker is unavailable. Try again later.');
  }

  if (!upstream.ok) {
    await logWorkerFailure(upstream);
    return workerError('CLAUDE_WORKER_FAILED', 'Claude Code worker failed. Check the server logs and try again.');
  }
  if (!upstream.body) {
    return workerError('CLAUDE_WORKER_INVALID_RESPONSE', 'Claude Code worker returned an invalid response.');
  }
  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('text/plain')) {
    await logWorkerFailure(upstream);
    return workerError('CLAUDE_WORKER_INVALID_RESPONSE', 'Claude Code worker returned an invalid response.');
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
