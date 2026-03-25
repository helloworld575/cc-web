import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, postReq } from '../../../helpers';

// Mock mongo with a working client
const mockCollection = {
  find: vi.fn(() => ({ sort: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(async () => [{ _id: '1', method: 'bazi' }]) })) })) })),
  insertOne: vi.fn(async () => ({ insertedId: 'abc123' })),
};
const mockClient = { db: vi.fn(() => ({ collection: vi.fn(() => mockCollection) })) };

describe('GET /api/fortune/history', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/fortune/history/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 501 when mongo not configured', async () => {
    mockSession(true);
    // Default mock has clientPromise = null
    const { GET } = await import('@/app/api/fortune/history/route');
    const res = await GET();
    expect(res.status).toBe(501);
  });

  it('returns 200 with docs when mongo available', async () => {
    mockSession(true);
    // Override mongo mock for this test
    const mongo = await import('@/lib/mongo');
    Object.defineProperty(mongo, 'default', { value: Promise.resolve(mockClient), writable: true });
    const { GET } = await import('@/app/api/fortune/history/route');
    const res = await GET();
    expect(res.status).toBe(200);
    // Reset
    Object.defineProperty(mongo, 'default', { value: null, writable: true });
  });
});

describe('POST /api/fortune/history', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/fortune/history/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    mockSession(true);
    const mongo = await import('@/lib/mongo');
    Object.defineProperty(mongo, 'default', { value: Promise.resolve(mockClient), writable: true });
    const { POST } = await import('@/app/api/fortune/history/route');
    const res = await POST(postReq({ method: 'bazi' }));
    expect(res.status).toBe(400);
    Object.defineProperty(mongo, 'default', { value: null, writable: true });
  });

  it('returns 201 on success', async () => {
    mockSession(true);
    const mongo = await import('@/lib/mongo');
    Object.defineProperty(mongo, 'default', { value: Promise.resolve(mockClient), writable: true });
    const { POST } = await import('@/app/api/fortune/history/route');
    const res = await POST(postReq({ method: 'bazi', input: {}, preflight: {}, analysis: 'test analysis' }));
    expect(res.status).toBe(201);
    Object.defineProperty(mongo, 'default', { value: null, writable: true });
  });
});
