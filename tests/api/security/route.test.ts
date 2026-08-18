import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getServerSession } from 'next-auth';

type RouteContext = { params: Promise<{ path: string[] }> };

function context(path: string[]): RouteContext {
  return { params: Promise.resolve({ path }) };
}

function authenticate() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { name: 'Admin' } });
}

describe('/api/security/[...path]', () => {
  beforeEach(() => {
    delete process.env.SECURITY_API_URL;
    delete process.env.SECURITY_API_KEY;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.SECURITY_API_URL;
    delete process.env.SECURITY_API_KEY;
  });

  it('requires an authenticated admin session before inspecting configuration', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { GET } = await import('@/app/api/security/[...path]/route');

    const response = await GET(
      new Request('http://localhost/api/security/v1/projects'),
      context(['v1', 'projects']),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed without a complete internal service configuration', async () => {
    authenticate();
    process.env.SECURITY_API_URL = 'http://sec-ai:3000';
    const { GET } = await import('@/app/api/security/[...path]/route');

    const response = await GET(
      new Request('http://localhost/api/security/health'),
      context(['health']),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'SECURITY_NOT_CONFIGURED',
      error: 'Security service is not configured.',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows only the documented security API paths', async () => {
    authenticate();
    process.env.SECURITY_API_URL = 'http://sec-ai:3000';
    process.env.SECURITY_API_KEY = 'server-only-key';
    const { GET, POST } = await import('@/app/api/security/[...path]/route');

    const docsResponse = await GET(
      new Request('http://localhost/api/security/docs/json'),
      context(['docs', 'json']),
    );
    const wrongMethodResponse = await POST(
      new Request('http://localhost/api/security/v1/projects/prj_1', { method: 'POST' }),
      context(['v1', 'projects', 'prj_1']),
    );
    const traversalResponse = await GET(
      new Request('http://localhost/api/security/v1/projects/..'),
      context(['v1', 'projects', '..']),
    );

    expect(docsResponse.status).toBe(404);
    expect(wrongMethodResponse.status).toBe(404);
    expect(traversalResponse.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the workbench assessment list and evidence paths available', async () => {
    authenticate();
    process.env.SECURITY_API_URL = 'http://sec-ai:3000';
    process.env.SECURITY_API_KEY = 'server-only-key';
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { evidence: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    const { GET } = await import('@/app/api/security/[...path]/route');

    const listResponse = await GET(
      new Request('http://localhost/api/security/v1/assessments?limit=50'),
      context(['v1', 'assessments']),
    );
    const evidenceResponse = await GET(
      new Request('http://localhost/api/security/v1/assessments/asm_1/evidence'),
      context(['v1', 'assessments', 'asm_1', 'evidence']),
    );

    expect(listResponse.status).toBe(200);
    expect(evidenceResponse.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('injects the server key and forwards only explicitly allowed request headers', async () => {
    authenticate();
    process.env.SECURITY_API_URL = 'http://sec-ai:3000';
    process.env.SECURITY_API_KEY = 'server-only-key';
    const upstream = new Response(JSON.stringify({ data: [{ id: 'prj_1' }] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'internal=secret',
        Server: 'internal-fastify',
        'X-Internal-Address': 'http://sec-ai:3000',
      },
    });
    vi.mocked(fetch).mockResolvedValue(upstream);
    const { GET } = await import('@/app/api/security/[...path]/route');
    const request = new Request('http://localhost/api/security/v1/projects?view=summary', {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer attacker-key',
        Cookie: 'next-auth.session-token=session',
        Host: 'attacker.example',
        'X-Forwarded-Host': 'attacker.example',
        'X-Request-ID': 'security-request-123',
      },
    });

    const response = await GET(request, context(['v1', 'projects']));

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe('http://sec-ai:3000/v1/projects?view=summary');
    expect(init?.method).toBe('GET');
    expect(init?.redirect).toBe('manual');
    const headers = init?.headers as Headers;
    expect(Object.fromEntries(headers.entries())).toEqual({
      accept: 'application/json',
      authorization: 'Bearer server-only-key',
      'x-request-id': 'security-request-123',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: 'prj_1' }] });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('server')).toBeNull();
    expect(response.headers.get('x-internal-address')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('security-request-123');
  });

  it('streams POST bodies and preserves content type and idempotency key', async () => {
    authenticate();
    process.env.SECURITY_API_URL = 'http://sec-ai:3000';
    process.env.SECURITY_API_KEY = 'server-only-key';
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'art_1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { POST } = await import('@/app/api/security/[...path]/route');
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('streamed-artifact'));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/security/v1/artifacts', {
      method: 'POST',
      body,
      duplex: 'half',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=test-boundary',
        'Content-Length': '999999',
        'Idempotency-Key': 'artifact-upload-1',
      },
    } as RequestInit & { duplex: 'half' });
    const originalBody = request.body;

    const response = await POST(request, context(['v1', 'artifacts']));

    expect(response.status).toBe(201);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe(originalBody);
    expect((init as RequestInit & { duplex?: string }).duplex).toBe('half');
    const headers = init?.headers as Headers;
    expect(headers.get('content-type')).toBe('multipart/form-data; boundary=test-boundary');
    expect(headers.get('idempotency-key')).toBe('artifact-upload-1');
    expect(headers.has('content-length')).toBe(false);
  });

  it('returns a bounded error without exposing upstream details', async () => {
    authenticate();
    process.env.SECURITY_API_URL = 'http://sec-ai:3000';
    process.env.SECURITY_API_KEY = 'server-only-key';
    vi.mocked(fetch).mockRejectedValue(
      new Error('connect ECONNREFUSED http://sec-ai:3000 using server-only-key'),
    );
    const { POST } = await import('@/app/api/security/[...path]/route');

    const response = await POST(
      new Request('http://localhost/api/security/v1/reports', {
        method: 'POST',
        body: JSON.stringify({ assessmentId: 'asm_1', format: 'sarif' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      context(['v1', 'reports']),
    );
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).toContain('Security service is unavailable.');
    expect(text).not.toContain('sec-ai');
    expect(text).not.toContain('server-only-key');
    expect(text).not.toContain('ECONNREFUSED');
  });

  it('does not relay unexpected upstream redirects or server error bodies', async () => {
    authenticate();
    process.env.SECURITY_API_URL = 'http://sec-ai:3000';
    process.env.SECURITY_API_KEY = 'server-only-key';
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: 'http://internal-admin.local/' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('stack trace at http://sec-ai:3000', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );
    const { GET } = await import('@/app/api/security/[...path]/route');

    const redirectResponse = await GET(
      new Request('http://localhost/api/security/health'),
      context(['health']),
    );
    const failureResponse = await GET(
      new Request('http://localhost/api/security/health'),
      context(['health']),
    );

    expect(redirectResponse.status).toBe(502);
    expect(redirectResponse.headers.get('location')).toBeNull();
    expect(await redirectResponse.text()).not.toContain('internal-admin');
    expect(failureResponse.status).toBe(502);
    expect(await failureResponse.text()).not.toContain('stack trace');
  });
});
