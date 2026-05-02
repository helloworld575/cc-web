import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockSession, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makePostReq(body: unknown) {
  return new Request('http://localhost/api/ai-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai-image', () => {
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    mockFetch.mockReset();
    process.env.GPT_IMAGE_API_KEY = 'test-image-key';
    process.env.GPT_IMAGE_API_URL = 'https://right.codes';
    delete process.env.GPT_IMAGE_MODEL;
    delete process.env.GPT_IMAGE_GROUP;
  });

  afterEach(() => {
    consoleWarn.mockRestore();
    delete process.env.E2E_MOCK_STREAMS;
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));
    expect(res.status).toBe(429);
  });

  it('requires a prompt', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: '  ' }));
    expect(res.status).toBe(400);
  });

  it('generates an image through the streaming chat image endpoint', async () => {
    mockSession(true);
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"![image](https://cdn.example.com/robot.png)"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot', size: '1024x1024' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.image).toBe('https://cdn.example.com/robot.png');
    expect(data.revised_prompt).toBe('a tiny robot');
    expect(data.model).toBe('gpt-image-2-pro');

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://right.codes/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-image-key');
    expect(init.headers['New-Api-Group']).toBe('vip_2_image');
    expect(JSON.parse(init.body)).toEqual({
      model: 'gpt-image-2-pro',
      group: 'vip_2_image',
      messages: [
        { role: 'user', content: '测试' },
        { role: 'assistant', content: '' },
        { role: 'user', content: 'a tiny robot' },
      ],
      stream: true,
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
  });

  it('does not double-prefix /gpt when the configured URL already includes it', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_URL = 'https://right.codes/gpt';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: Buffer.from('fake-image').toString('base64') }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { POST } = await import('@/app/api/ai-image/route');
    await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(mockFetch.mock.calls[0][0]).toBe('https://right.codes/gpt/v1/chat/completions');
  });

  it('normalizes root provider URLs to the standard v1 chat completions path', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_URL = 'https://www.openclaudecode.cn';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'https://cdn.example.com/root.png' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { POST } = await import('@/app/api/ai-image/route');
    await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(mockFetch.mock.calls[0][0]).toBe('https://www.openclaudecode.cn/v1/chat/completions');
  });

  it('normalizes configured URLs that already include the chat completions API path', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_URL = 'https://right.codes/gpt/v1/chat/completions';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: Buffer.from('fake-image').toString('base64') }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { POST } = await import('@/app/api/ai-image/route');
    await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(mockFetch.mock.calls[0][0]).toBe('https://right.codes/gpt/v1/chat/completions');
  });

  it('allows image model and group to be configured by env', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_MODEL = 'custom-image-model';
    process.env.GPT_IMAGE_GROUP = 'custom-image-group';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'https://cdn.example.com/custom.png' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(200);
    const [, init] = mockFetch.mock.calls[0];
    const upstreamBody = JSON.parse(init.body);
    expect(upstreamBody.model).toBe('custom-image-model');
    expect(upstreamBody.group).toBe('custom-image-group');
    expect(init.headers['New-Api-Group']).toBe('custom-image-group');
  });

  it('includes upstream status and body when image generation fails', async () => {
    mockSession(true);
    mockFetch.mockResolvedValue(new Response('upstream refused request', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain('Image API error (404)');
    expect(data.detail).toContain('upstream refused request');
  });

  it('returns a JSON error when the image API returns HTML with a successful status', async () => {
    mockSession(true);
    mockFetch.mockResolvedValue(new Response('<!doctype html><html><body>proxy login</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBe('Image API returned a non-JSON response');
    expect(data.detail).toContain('proxy login');
  });

  it('returns a JSON error when the image API JSON cannot be parsed', async () => {
    mockSession(true);
    mockFetch.mockResolvedValue(new Response('{not json', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBe('Image API returned invalid JSON');
  });

  it('returns deterministic mock image when e2e streams are mocked', async () => {
    process.env.E2E_MOCK_STREAMS = '1';
    mockSession(true);

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'mock image' }));

    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.image).toContain('data:image/png;base64,');
    expect(data.model).toBe('gpt-image-2-pro');
  });
});
