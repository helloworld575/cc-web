export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';

const MAX_PROMPT_CHARS = 20000;

function getWorkerUrl() {
  return process.env.CLAUDE_CODE_WORKER_URL?.replace(/\/$/, '');
}

async function readWorkerError(response: Response) {
  try {
    const data = await response.clone().json();
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error;
    }
  } catch {
    const text = await response.text().catch(() => '');
    if (text.trim()) return text.trim();
  }
  return `Claude Code worker failed with HTTP ${response.status}`;
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

  const payload: { prompt: string; cwd?: string } = { prompt };
  if (typeof body.cwd === 'string' && body.cwd.trim()) {
    payload.cwd = body.cwd.trim();
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (caught: unknown) {
    const errorLike = caught as { message?: string };
    return Response.json({ error: errorLike?.message || 'Failed to reach Claude Code worker' }, { status: 502 });
  }

  if (!upstream.ok) {
    return Response.json({ error: await readWorkerError(upstream) }, { status: 502 });
  }
  if (!upstream.body) {
    return Response.json({ error: 'Claude Code worker returned an empty stream' }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
