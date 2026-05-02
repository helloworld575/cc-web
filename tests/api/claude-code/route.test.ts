import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makePostReq(body: unknown) {
  return new Request('http://localhost/api/claude-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/claude-code', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    mockFetch.mockReset();
    delete process.env.CLAUDE_CODE_WORKER_URL;
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
    await expect(res.json()).resolves.toEqual({ error: 'worker failed' });
  });

  it('proxies a successful worker stream', async () => {
    mockSession(true);
    process.env.CLAUDE_CODE_WORKER_URL = 'http://claude-worker:8787';
    const encoder = new TextEncoder();
    const workerStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"type":"assistant","text":"ok"}\n'));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(new Response(workerStream, {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson' },
    }));

    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ prompt: 'inspect repo', cwd: 'repo' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/x-ndjson');
    expect(mockFetch).toHaveBeenCalledWith('http://claude-worker:8787/run', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ prompt: 'inspect repo', cwd: 'repo' }),
    }));

    const text = await res.text();
    expect(text).toContain('"text":"ok"');
  });
});
