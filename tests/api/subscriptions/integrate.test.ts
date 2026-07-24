import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { fetchByCategory } from '@/lib/fetchers';
import { getSkill } from '@/lib/skills';
import db from '@/lib/db';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function generationSkill(id: 'subscription-ai' | 'subscription-security') {
  return {
    id,
    name: id,
    description: 'Summarize subscription content',
    invocable: true as const,
    output: 'content',
    system: 'Summarize clearly',
    prompt: `${id}: Topic: {{topic}}\nSummarize {{source_name}} from {{url}} in {{category}}: {{content}}`,
  };
}

describe('POST /api/subscriptions/integrate', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    vi.mocked(fetchByCategory).mockClear();
    vi.mocked(getSkill).mockReset();
    mockFetch.mockReset();
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-8';
    process.env.CLAUDE_API_HOST = 'https://www.rightapi.ai/claude';
    delete process.env.RIGHT_CODE_GPT_API_KEY;
    delete process.env.RIGHT_CODE_API_KEY;
    delete process.env.RIGHT_CODE_GPT_API_STYLE;
  });

  afterEach(() => {
    process.env.CLAUDE_API_KEY = 'test-key';
    delete process.env.RIGHT_CODE_GPT_API_KEY;
    delete process.env.RIGHT_CODE_API_KEY;
    delete process.env.RIGHT_CODE_GPT_API_STYLE;
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/subscriptions/integrate/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/integrate', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 500 before generation when the topic skill is not invocable', async () => {
    mockSession(true);
    const insertBrief = vi.fn();
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources')) {
        return { all: vi.fn(() => [{
          id: 1, name: 'Security Source', url: 'https://security.example', category: 'rss', topic: 'security', enabled: 1,
        }]) };
      }
      if (sql.includes('INSERT INTO subscription_briefs')) return { run: insertBrief };
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });
    const { POST } = await import('@/app/api/subscriptions/integrate/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/integrate', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      code: 'subscription_skill_unavailable',
      error: 'Security subscription skill is not invocable',
      topic: 'security',
    });
    expect(getSkill).toHaveBeenCalledWith('subscription-security');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(insertBrief).not.toHaveBeenCalled();
  });

  it('generates briefs from stored subscription items without crawling again', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockImplementation((id: string) => (
      id === 'subscription-security' ? generationSkill(id) : null
    ));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      content: [{ text: 'Brief from env provider' }],
      model: 'claude-opus-4-8',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const getSource = vi.fn(() => ({
      id: 1,
      name: 'AI Source',
      url: 'https://example.com/ai',
      category: 'rss',
      topic: 'security',
      enabled: 1,
    }));
    const getLatestItem = vi.fn(() => ({
      id: 7,
      source_id: 1,
      title: 'Stored crawl',
      url: 'https://example.com/ai',
      content: 'Stored content from daily crawl',
      content_hash: 'stored-hash',
    }));
    const getExistingBrief = vi.fn(() => undefined);
    const insertBrief = vi.fn(() => ({ lastInsertRowid: 10, changes: 1 }));

    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources WHERE id = ? AND enabled = 1')) {
        return { get: getSource };
      }
      if (sql.includes('SELECT * FROM subscription_items')) {
        return { get: getLatestItem };
      }
      if (sql.includes('SELECT id FROM subscription_briefs')) {
        return { get: getExistingBrief };
      }
      if (sql.includes('INSERT INTO subscription_briefs')) {
        return { run: insertBrief };
      }
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/integrate/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/integrate', {
      method: 'POST',
      body: JSON.stringify({ source_id: 1 }),
    }));

    expect(res.status).toBe(200);
    expect(getSkill).toHaveBeenCalledWith('subscription-security');
    expect(getSkill).not.toHaveBeenCalledWith('subscription');
    expect(fetchByCategory).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(JSON.stringify(requestBody.messages[0].content)).toContain('Topic: security');
    expect(insertBrief).toHaveBeenCalledWith(
      1,
      'Stored crawl',
      'https://example.com/ai',
      'Brief from env provider',
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it('preloads both topic skills and uses the matching prompt for a mixed batch', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockImplementation((id: string) => (
      id === 'subscription-ai' || id === 'subscription-security'
        ? generationSkill(id)
        : null
    ));
    mockFetch.mockImplementation(async () => new Response(JSON.stringify({
      content: [{ text: 'Generated brief' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const sources = [
      { id: 1, name: 'Security Source', url: 'https://security.example', category: 'rss', topic: 'security', enabled: 1 },
      { id: 2, name: 'AI Source', url: 'https://ai.example', category: 'rss', topic: 'ai', enabled: 1 },
    ];
    const insertBrief = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources')) return { all: vi.fn(() => sources) };
      if (sql.includes('SELECT * FROM subscription_items')) {
        return { get: vi.fn((sourceId: number) => ({
          id: sourceId,
          source_id: sourceId,
          title: `Stored ${sourceId}`,
          url: sources[sourceId - 1].url,
          content: `Content ${sourceId}`,
          content_hash: `hash-${sourceId}`,
        })) };
      }
      if (sql.includes('SELECT id, brief FROM subscription_briefs')) return { get: vi.fn(() => undefined) };
      if (sql.includes('INSERT INTO subscription_briefs')) return { run: insertBrief };
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/integrate/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/integrate', {
      method: 'POST', body: '{}',
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ total: 2 });
    expect(getSkill).toHaveBeenCalledWith('subscription-security');
    expect(getSkill).toHaveBeenCalledWith('subscription-ai');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const prompts = mockFetch.mock.calls.map(call => JSON.stringify(JSON.parse(call[1].body as string).messages));
    expect(prompts[0]).toContain('subscription-security');
    expect(prompts[1]).toContain('subscription-ai');
    expect(Math.max(...vi.mocked(getSkill).mock.invocationCallOrder))
      .toBeLessThan(Math.min(...mockFetch.mock.invocationCallOrder));
    expect(insertBrief).toHaveBeenCalledTimes(2);
  });

  it('does not call a provider or write a brief when any mixed-batch skill is unavailable', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockImplementation((id: string) => (
      id === 'subscription-security' ? generationSkill(id) : null
    ));
    const insertBrief = vi.fn();
    const updateBrief = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources')) {
        return { all: vi.fn(() => [
          { id: 1, name: 'Security Source', url: 'https://security.example', category: 'rss', topic: 'security', enabled: 1 },
          { id: 2, name: 'AI Source', url: 'https://ai.example', category: 'rss', topic: 'ai', enabled: 1 },
        ]) };
      }
      if (sql.includes('INSERT INTO subscription_briefs')) return { run: insertBrief };
      if (sql.includes('UPDATE subscription_briefs SET')) return { run: updateBrief };
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/integrate/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/integrate', {
      method: 'POST', body: '{}',
    }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      code: 'subscription_skill_unavailable', topic: 'ai',
    });
    expect(getSkill).toHaveBeenCalledWith('subscription-security');
    expect(getSkill).toHaveBeenCalledWith('subscription-ai');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(insertBrief).not.toHaveBeenCalled();
    expect(updateBrief).not.toHaveBeenCalled();
  });

  it('returns 503 without an environment AI provider and does not persist an error brief', async () => {
    mockSession(true);
    delete process.env.CLAUDE_API_KEY;
    delete process.env.RIGHT_CODE_GPT_API_KEY;
    delete process.env.RIGHT_CODE_API_KEY;
    const insertBrief = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO subscription_briefs')) return { run: insertBrief };
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/integrate/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/integrate', {
      method: 'POST',
      body: '{}',
    }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: 'provider_not_configured',
      retryable: false,
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(insertBrief).not.toHaveBeenCalled();
  });

  it('uses Right Code when it is the only configured provider', async () => {
    mockSession(true);
    delete process.env.CLAUDE_API_KEY;
    process.env.RIGHT_CODE_GPT_API_KEY = 'test-right-code-key';
    process.env.RIGHT_CODE_GPT_API_STYLE = 'responses';
    (getSkill as ReturnType<typeof vi.fn>).mockImplementation((id: string) => (
      id === 'subscription-ai' ? generationSkill(id) : null
    ));
    mockFetch.mockResolvedValue(new Response(
      'data: {"type":"response.output_text.delta","delta":"Right Code brief"}\n\n'
        + 'data: {"type":"response.completed"}\n\n',
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    ));
    const insertBrief = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources WHERE id = ?')) {
        return { get: vi.fn(() => ({ id: 1, name: 'AI Source', url: 'https://example.com', category: 'rss', topic: 'ai', enabled: 1 })) };
      }
      if (sql.includes('SELECT * FROM subscription_items')) {
        return { get: vi.fn(() => ({ id: 1, source_id: 1, title: 'Stored', url: 'https://example.com', content: 'Content', content_hash: 'hash' })) };
      }
      if (sql.includes('SELECT id, brief FROM subscription_briefs')) return { get: vi.fn(() => undefined) };
      if (sql.includes('INSERT INTO subscription_briefs')) return { run: insertBrief };
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/integrate/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/integrate', {
      method: 'POST',
      body: JSON.stringify({ source_id: 1 }),
    }));

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/responses'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-right-code-key' }) }),
    );
    expect(insertBrief).toHaveBeenCalledWith(
      1, 'Stored', 'https://example.com', 'Right Code brief', expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it('does not persist upstream failures as subscription content', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockImplementation((id: string) => (
      id === 'subscription-ai' ? generationSkill(id) : null
    ));
    mockFetch.mockResolvedValue(new Response('<html>gateway failure</html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    }));
    const insertBrief = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources WHERE id = ?')) {
        return { get: vi.fn(() => ({ id: 1, name: 'AI Source', url: 'https://example.com', category: 'rss', topic: 'ai', enabled: 1 })) };
      }
      if (sql.includes('SELECT * FROM subscription_items')) {
        return { get: vi.fn(() => ({ id: 1, source_id: 1, title: 'Stored', url: 'https://example.com', content: 'Content', content_hash: 'hash' })) };
      }
      if (sql.includes('SELECT id, brief FROM subscription_briefs')) return { get: vi.fn(() => undefined) };
      if (sql.includes('INSERT INTO subscription_briefs')) return { run: insertBrief };
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/integrate/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/integrate', {
      method: 'POST',
      body: JSON.stringify({ source_id: 1 }),
    }));
    const body = await res.json();

    expect(body.results).toEqual([
      expect.objectContaining({ source_id: 1, success: false, code: 'upstream_unavailable', retryable: true }),
    ]);
    expect(JSON.stringify(body)).not.toContain('<html>');
    expect(insertBrief).not.toHaveBeenCalled();
  });

  it('regenerates a historical provider-error brief instead of treating it as cached', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockImplementation((id: string) => (
      id === 'subscription-ai' ? generationSkill(id) : null
    ));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ content: [{ text: 'Recovered brief' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const updateBrief = vi.fn();
    const insertBrief = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources WHERE id = ?')) {
        return { get: vi.fn(() => ({ id: 1, name: 'AI Source', url: 'https://example.com', category: 'rss', topic: 'ai', enabled: 1 })) };
      }
      if (sql.includes('SELECT * FROM subscription_items')) {
        return { get: vi.fn(() => ({ id: 1, source_id: 1, title: 'Stored', url: 'https://example.com', content: 'Content', content_hash: 'hash' })) };
      }
      if (sql.includes('SELECT id, brief FROM subscription_briefs')) {
        return { get: vi.fn((_sourceId: number, contentHash: string) => (
          contentHash === 'hash'
            ? { id: 14, brief: 'No default AI provider configured. Go to Admin → AI Config.' }
            : undefined
        )) };
      }
      if (sql.includes('UPDATE subscription_briefs SET')) return { run: updateBrief };
      if (sql.includes('INSERT INTO subscription_briefs')) return { run: insertBrief };
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/integrate/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/integrate', {
      method: 'POST',
      body: JSON.stringify({ source_id: 1 }),
    }));

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(updateBrief).toHaveBeenCalledWith(
      'Stored',
      'https://example.com',
      'Recovered brief',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      14,
    );
    expect(insertBrief).not.toHaveBeenCalled();
  });
});
