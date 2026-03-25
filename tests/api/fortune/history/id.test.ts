import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession } from '../../../helpers';

const mockCollection = {
  findOne: vi.fn(async () => ({ _id: 'abc', method: 'bazi' })),
  deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
};
const mockClient = { db: vi.fn(() => ({ collection: vi.fn(() => mockCollection) })) };

// Mock ObjectId
vi.mock('mongodb', () => ({
  ObjectId: class ObjectId {
    constructor(id: string) {
      if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('Invalid ObjectId');
    }
  },
}));

describe('GET /api/fortune/history/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/fortune/history/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });
    expect(res.status).toBe(401);
  });

  it('returns 400 on bad id', async () => {
    mockSession(true);
    const mongo = await import('@/lib/mongo');
    Object.defineProperty(mongo, 'default', { value: Promise.resolve(mockClient), writable: true });
    const { GET } = await import('@/app/api/fortune/history/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: 'bad-id' } });
    expect(res.status).toBe(400);
    Object.defineProperty(mongo, 'default', { value: null, writable: true });
  });

  it('returns 200 with doc', async () => {
    mockSession(true);
    const mongo = await import('@/lib/mongo');
    Object.defineProperty(mongo, 'default', { value: Promise.resolve(mockClient), writable: true });
    const { GET } = await import('@/app/api/fortune/history/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });
    expect(res.status).toBe(200);
    Object.defineProperty(mongo, 'default', { value: null, writable: true });
  });
});

describe('DELETE /api/fortune/history/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/fortune/history/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const mongo = await import('@/lib/mongo');
    Object.defineProperty(mongo, 'default', { value: Promise.resolve(mockClient), writable: true });
    const { DELETE } = await import('@/app/api/fortune/history/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });
    expect(res.status).toBe(200);
    Object.defineProperty(mongo, 'default', { value: null, writable: true });
  });
});
