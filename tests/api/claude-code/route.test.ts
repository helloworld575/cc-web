import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makePostReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/claude-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/claude-code', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    mockFetch.mockReset();
    delete process.env.CLAUDE_CODE_WORKER_URL;
    process.env.NEXTAUTH_SECRET = 'worker-shared-secret';
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ prompt: 'inspect repo' }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ prompt: 'inspect repo' }));
    expect(res.status).toBe(429);
  });

  it('returns 400 for missing prompt', async () => {
    mockSession(true);
    process.env.CLAUDE_CODE_WORKER_URL = 'http://claude-worker:8787';
    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ prompt: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 503 when worker URL is not configured', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ prompt: 'inspect repo' }));
    expect(res.status).toBe(503);
  });

  it('returns 502 when the worker rejects the request', async () => {
    mockSession(true);
    process.env.CLAUDE_CODE_WORKER_URL = 'http://claude-worker:8787';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'worker failed' }), { status: 500 }));

    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ prompt: 'inspect repo' }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      code: 'CLAUDE_WORKER_FAILED',
      error: 'Claude Code worker failed. Check the server logs and try again.',
    });
  });

  it('does not expose HTML returned by the worker', async () => {
    mockSession(true);
    process.env.CLAUDE_CODE_WORKER_URL = 'http://claude-worker:8787';
    mockFetch.mockResolvedValue(new Response('<!doctype html><html><body>proxy login</body></html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    }));

    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ prompt: 'inspect repo' }));
    const text = await res.text();

    expect(res.status).toBe(502);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(text).not.toContain('<html');
    expect(text).not.toContain('proxy login');
  });

  it('rejects successful HTML responses from the worker', async () => {
    mockSession(true);
    process.env.CLAUDE_CODE_WORKER_URL = 'http://claude-worker:8787';
    mockFetch.mockResolvedValue(new Response('<html>unexpected</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ prompt: 'inspect repo' }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      code: 'CLAUDE_WORKER_INVALID_RESPONSE',
      error: 'Claude Code worker returned an invalid response.',
    });
  });

  it('proxies a successful worker stream', async () => {
    mockSession(true);
    process.env.CLAUDE_CODE_WORKER_URL = 'http://claude-worker:8787';
    const encoder = new TextEncoder();
    const workerStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('ok'));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(new Response(workerStream, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }));

    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq(
      { prompt: 'inspect repo', cwd: 'repo' },
      { 'x-request-id': 'req-claude-worker-123' },
    ));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    expect(mockFetch).toHaveBeenCalledWith('http://claude-worker:8787/run', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Claude-Worker-Token': 'worker-shared-secret',
        'X-Request-ID': 'req-claude-worker-123',
      },
      body: JSON.stringify({ prompt: 'inspect repo', cwd: 'repo' }),
    }));

    const text = await res.text();
    expect(text).toBe('ok');
    expect(res.headers.get('X-Request-ID')).toBe('req-claude-worker-123');
  });
});
