import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import db from '@/lib/db';

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
    vi.mocked(db.prepare).mockClear();
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
      body: expect.any(String),
    }));

    const workerBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(workerBody).toMatchObject({
      prompt: 'inspect repo',
      cwd: 'repo',
      resume: false,
      turn_index: 1,
    });
    expect(workerBody.session_id).toMatch(/^[0-9a-f-]{36}$/i);

    const text = await res.text();
    expect(text).toBe('ok');
    expect(res.headers.get('X-Request-ID')).toBe('req-claude-worker-123');
    expect(res.headers.get('X-Claude-Chat-ID')).toBe('1');
  });

  it('resumes the server-owned Claude session for a follow-up turn', async () => {
    mockSession(true);
    process.env.CLAUDE_CODE_WORKER_URL = 'http://claude-worker:8787';
    const session = {
      id: 7,
      session_uuid: '8b8a90d2-9413-4c75-8cd5-a817af66c76f',
      title: 'First question',
      cwd: 'repo',
      messages: JSON.stringify([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
      ]),
      status: 'idle',
    };
    vi.mocked(db.prepare).mockImplementation(((sql: string) => ({
      get: vi.fn(() => sql.includes('SELECT * FROM claude_assistant_sessions') ? session : undefined),
      all: vi.fn(() => []),
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 0 })),
    })) as never);
    mockFetch.mockResolvedValue(new Response('Second answer', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }));

    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ chat_id: 7, message: 'Second question', cwd: 'repo' }));
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe('Second answer');

    const workerBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(workerBody).toEqual({
      prompt: 'Second question',
      cwd: 'repo',
      session_id: session.session_uuid,
      resume: true,
      turn_index: 2,
    });
    expect(res.headers.get('X-Claude-Chat-ID')).toBe('7');
    const updateMessagesCall = vi.mocked(db.prepare).mock.calls.find(([sql]) =>
      String(sql).includes('SET messages = ?'),
    );
    expect(updateMessagesCall).toBeTruthy();
  });

  it('rejects changing the workspace after a conversation has started', async () => {
    mockSession(true);
    process.env.CLAUDE_CODE_WORKER_URL = 'http://claude-worker:8787';
    vi.mocked(db.prepare).mockImplementation(((sql: string) => ({
      get: vi.fn(() => sql.includes('SELECT * FROM claude_assistant_sessions') ? {
        id: 7,
        session_uuid: '8b8a90d2-9413-4c75-8cd5-a817af66c76f',
        cwd: 'repo',
        messages: '[]',
        status: 'idle',
      } : undefined),
      all: vi.fn(() => []),
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 0 })),
    })) as never);

    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ chat_id: 7, message: 'Continue', cwd: 'other' }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: 'CLAUDE_CWD_LOCKED' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps previous messages when a follow-up worker call fails', async () => {
    mockSession(true);
    process.env.CLAUDE_CODE_WORKER_URL = 'http://claude-worker:8787';
    const previousMessages = JSON.stringify([
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
    ]);
    vi.mocked(db.prepare).mockImplementation(((sql: string) => ({
      get: vi.fn(() => sql.includes('SELECT * FROM claude_assistant_sessions') ? {
        id: 7,
        session_uuid: '8b8a90d2-9413-4c75-8cd5-a817af66c76f',
        cwd: 'repo',
        messages: previousMessages,
        status: 'idle',
      } : undefined),
      all: vi.fn(() => []),
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 0 })),
    })) as never);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ code: 'CLAUDE_TIMEOUT' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    }));

    const { POST } = await import('@/app/api/claude-code/route');
    const res = await POST(makePostReq({ chat_id: 7, message: 'Second question' }));

    expect(res.status).toBe(504);
    await expect(res.json()).resolves.toMatchObject({ code: 'CLAUDE_TIMEOUT' });
    expect(vi.mocked(db.prepare).mock.calls.some(([sql]) => String(sql).includes('SET messages = ?'))).toBe(false);
  });
});
