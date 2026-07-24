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
    process.env.GPT_IMAGE_API_URL = 'https://rightapi.ai';
    delete process.env.GPT_IMAGE_MODEL;
    delete process.env.GPT_IMAGE_GROUP;
  });

  afterEach(() => {
    consoleWarn.mockRestore();
    delete process.env.E2E_MOCK_STREAMS;
    delete process.env.GPT_IMAGE_API_MODE;
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

  it('rejects image prompts that exceed the server limit', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'x'.repeat(4001) }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: 'invalid_prompt',
      error: expect.any(String),
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('generates an image through the streaming chat image endpoint', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_MODE = 'chat';
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
    expect(url).toBe('https://rightapi.ai/v1/chat/completions');
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

  it('generates an image through the rightapi.ai native images endpoint by default', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_URL = 'https://www.rightapi.ai/draw';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      data: [{
        url: 'https://cdn.example.com/native.png',
        revised_prompt: 'a tiny robot, polished',
      }],
      created: 123,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot', size: '1024x1024' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.image).toBe('https://cdn.example.com/native.png');
    expect(data.revised_prompt).toBe('a tiny robot, polished');

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.rightapi.ai/draw/v1/images/generations');
    expect(init.headers.Authorization).toBe('Bearer test-image-key');
    expect(init.headers['New-Api-Group']).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({
      model: 'gpt-image-2-pro',
      prompt: 'a tiny robot',
      size: '1024x1024',
      response_format: 'url',
    });
  });

  it('sends an uploaded reference image as multimodal message content', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_MODE = 'chat';
    const referenceImage = 'data:image/png;base64,aW1hZ2U=';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'https://cdn.example.com/with-reference.png' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({
      prompt: 'use this style',
      reference_image: referenceImage,
    }));

    expect(res.status).toBe(200);
    const [, init] = mockFetch.mock.calls[0];
    const upstreamBody = JSON.parse(init.body);
    expect(upstreamBody.messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'use this style' },
        { type: 'image_url', image_url: { url: referenceImage } },
      ],
    });
  });

  it('rejects invalid reference image payloads', async () => {
    mockSession(true);

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({
      prompt: 'use this style',
      reference_image: 'not-an-image',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Reference image must be a data URL image');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects reference images that exceed the server byte limit', async () => {
    mockSession(true);
    const referenceImage = `data:image/png;base64,${Buffer.alloc(6 * 1024 * 1024 + 1).toString('base64')}`;

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({
      prompt: 'use this style',
      reference_image: referenceImage,
    }));

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toMatchObject({
      code: 'reference_image_too_large',
      error: expect.any(String),
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not double-prefix /gpt when the configured URL already includes it', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_MODE = 'chat';
    process.env.GPT_IMAGE_API_URL = 'https://rightapi.ai/gpt';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: Buffer.from('fake-image').toString('base64') }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { POST } = await import('@/app/api/ai-image/route');
    await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(mockFetch.mock.calls[0][0]).toBe('https://rightapi.ai/gpt/v1/chat/completions');
  });

  it('normalizes root provider URLs to the standard v1 chat completions path', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_MODE = 'chat';
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
    process.env.GPT_IMAGE_API_MODE = 'chat';
    process.env.GPT_IMAGE_API_URL = 'https://rightapi.ai/gpt/v1/chat/completions';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: Buffer.from('fake-image').toString('base64') }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { POST } = await import('@/app/api/ai-image/route');
    await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(mockFetch.mock.calls[0][0]).toBe('https://rightapi.ai/gpt/v1/chat/completions');
  });

  it('allows image model and group to be configured by env', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_MODE = 'chat';
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
    process.env.GPT_IMAGE_API_MODE = 'chat';
    mockFetch.mockResolvedValue(new Response('upstream refused request', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_not_found',
      error: 'Image provider rejected the request.',
      retryable: false,
    });
    expect(JSON.stringify(data)).not.toContain('upstream refused request');
  });

  it('extracts bounded JSON string errors without returning provider response details', async () => {
    mockSession(true);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      error: 'API Key is not allowed to access this channel',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_forbidden',
      error: 'Image provider rejected the credentials or channel access.',
      retryable: false,
    });
    expect(JSON.stringify(data)).not.toContain('API Key');
  });

  it('maps image provider network failures without exposing internal hosts', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_URL = 'https://internal-image.example';
    mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED internal-image.example'));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_unavailable',
      error: 'Unable to reach image provider.',
      retryable: true,
    });
    expect(JSON.stringify(data)).not.toMatch(/ECONNREFUSED|internal-image/i);
  });

  it('returns a JSON error when the image API returns HTML with a successful status', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_MODE = 'chat';
    mockFetch.mockResolvedValue(new Response('<!doctype html><html><body>proxy login</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_invalid_response',
      error: 'Image provider returned an invalid response.',
      retryable: true,
    });
    expect(JSON.stringify(data)).not.toMatch(/proxy login|doctype|<html/i);
  });

  it('returns a JSON error when the image API JSON cannot be parsed', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_MODE = 'chat';
    mockFetch.mockResolvedValue(new Response('{not json', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_invalid_response',
      error: 'Image provider returned an invalid response.',
      retryable: true,
    });
    expect(JSON.stringify(data)).not.toContain('{not json');
  });

  it('returns a safe error when the image provider returns an empty body', async () => {
    mockSession(true);
    mockFetch.mockResolvedValue(new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      code: 'upstream_empty_response',
      error: 'Image provider returned an empty response.',
      retryable: true,
    });
  });

  it('returns a bounded error when an image stream exceeds the response limit', async () => {
    mockSession(true);
    process.env.GPT_IMAGE_API_MODE = 'chat';
    const encoder = new TextEncoder();
    const oversizedChunk = `data: ${JSON.stringify({
      choices: [{ delta: { content: 'x'.repeat(1024 * 1024) } }],
    })}\n\n`;
    const stream = new ReadableStream({
      start(controller) {
        for (let index = 0; index < 17; index += 1) {
          controller.enqueue(encoder.encode(oversizedChunk));
        }
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai-image/route');
    const res = await POST(makePostReq({ prompt: 'a tiny robot' }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      code: 'upstream_response_too_large',
      error: 'Image provider response exceeded the allowed size.',
      retryable: true,
    });
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
