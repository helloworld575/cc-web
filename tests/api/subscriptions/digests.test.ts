import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession, postReq } from '../../helpers';
import { generateSubscriptionDigest } from '@/lib/subscription-digest';

vi.mock('@/lib/subscription-digest', () => ({
  generateSubscriptionDigest: vi.fn(),
  listSubscriptionDigests: vi.fn(),
}));

describe('POST /api/subscriptions/digests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated administrator', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/subscriptions/digests/route');
    const response = await POST(postReq({ topic: 'ai' }));
    expect(response.status).toBe(401);
    expect(generateSubscriptionDigest).not.toHaveBeenCalled();
  });

  it('rejects an invalid topic before generating', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/subscriptions/digests/route');
    const response = await POST(postReq({ topic: 'everything' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid topic' });
    expect(generateSubscriptionDigest).not.toHaveBeenCalled();
  });

  it('rejects an invalid item limit', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/subscriptions/digests/route');
    const response = await POST(postReq({ topic: 'security', limit: 0 }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid limit' });
  });

  it('generates and returns a topic digest', async () => {
    mockSession(true);
    vi.mocked(generateSubscriptionDigest).mockResolvedValueOnce({
      id: 7,
      topic: 'ai',
      summary: '## AI news\n- A concise synthesis.',
      item_count: 2,
      item_ids: [11, 12],
      generated_at: '2026-10-01 10:00:00',
      provider: 'Claude Env Default',
      model: 'claude-opus-4-8',
      source_items: [],
      reused: false,
    });

    const { POST } = await import('@/app/api/subscriptions/digests/route');
    const response = await POST(postReq({ topic: 'ai', limit: 8 }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      id: 7,
      topic: 'ai',
      item_count: 2,
      reused: false,
    }));
    expect(generateSubscriptionDigest).toHaveBeenCalledWith({ topic: 'ai', limit: 8 });
  });

  it('returns an existing digest as a reuse without creating another one', async () => {
    mockSession(true);
    vi.mocked(generateSubscriptionDigest).mockResolvedValueOnce({
      id: 9,
      topic: 'security',
      summary: 'Security digest',
      item_count: 1,
      item_ids: [22],
      generated_at: '2026-10-01 10:01:00',
      provider: 'Claude Env Default',
      model: 'claude-opus-4-8',
      source_items: [],
      reused: true,
    });

    const { POST } = await import('@/app/api/subscriptions/digests/route');
    const response = await POST(postReq({ topic: 'security' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ reused: true }));
  });

  it('maps an empty source set to a 404', async () => {
    mockSession(true);
    vi.mocked(generateSubscriptionDigest).mockRejectedValueOnce(
      Object.assign(new Error('No new subscription items'), { code: 'NO_ITEMS' }),
    );
    const { POST } = await import('@/app/api/subscriptions/digests/route');
    const response = await POST(postReq({ topic: 'security' }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ code: 'NO_ITEMS', error: 'No new subscription items.' });
  });

  it('generates both topic digests for topic=all and reports skipped empty topics', async () => {
    mockSession(true);
    vi.mocked(generateSubscriptionDigest)
      .mockResolvedValueOnce({
        id: 13, topic: 'ai', summary: 'AI digest', item_count: 1, item_ids: [13],
        generated_at: '2026-10-01 10:00:00', provider: 'Claude', model: 'claude-test', source_items: [], reused: false,
      })
      .mockRejectedValueOnce(Object.assign(new Error('No items'), { code: 'NO_ITEMS' }));

    const { POST } = await import('@/app/api/subscriptions/digests/route');
    const response = await POST(postReq({ topic: 'all' }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      digests: [expect.objectContaining({ topic: 'ai' })],
      skipped_topics: ['security'],
    });
    expect(generateSubscriptionDigest).toHaveBeenNthCalledWith(1, { topic: 'ai', limit: undefined });
    expect(generateSubscriptionDigest).toHaveBeenNthCalledWith(2, { topic: 'security', limit: undefined });
  });

  it('returns 404 for topic=all when neither topic has any items', async () => {
    mockSession(true);
    vi.mocked(generateSubscriptionDigest)
      .mockRejectedValueOnce(Object.assign(new Error('No items'), { code: 'NO_ITEMS' }))
      .mockRejectedValueOnce(Object.assign(new Error('No items'), { code: 'NO_ITEMS' }));

    const { POST } = await import('@/app/api/subscriptions/digests/route');
    const response = await POST(postReq({ topic: 'all' }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ code: 'NO_ITEMS', error: 'No new subscription items.' });
  });
});

describe('GET /api/subscriptions/digests', () => {
  it('lists digests with validated topic and bounded limit', async () => {
    const { listSubscriptionDigests } = await import('@/lib/subscription-digest');
    vi.mocked(listSubscriptionDigests).mockReturnValueOnce([
      { id: 1, topic: 'security', summary: 'Security digest' },
    ] as never);
    const { GET } = await import('@/app/api/subscriptions/digests/route');
    const response = await GET(new Request('http://localhost/api/subscriptions/digests?topic=security&limit=999'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: 1, topic: 'security', summary: 'Security digest' }]);
    expect(listSubscriptionDigests).toHaveBeenCalledWith({ topic: 'security', limit: 100 });
  });

  it('rejects an invalid GET topic', async () => {
    const { GET } = await import('@/app/api/subscriptions/digests/route');
    const response = await GET(new Request('http://localhost/api/subscriptions/digests?topic=everything'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid topic' });
  });

  it('supports listing all topics', async () => {
    const { listSubscriptionDigests } = await import('@/lib/subscription-digest');
    vi.mocked(listSubscriptionDigests).mockReturnValueOnce([] as never);
    const { GET } = await import('@/app/api/subscriptions/digests/route');
    const response = await GET(new Request('http://localhost/api/subscriptions/digests?topic=all'));
    expect(response.status).toBe(200);
    expect(listSubscriptionDigests).toHaveBeenCalledWith({ topic: undefined, limit: 20 });
  });
});
