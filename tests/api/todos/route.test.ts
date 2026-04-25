import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSession, mockDbStmt, postReq } from '../../helpers';

describe('GET /api/todos', () => {
  beforeEach(() => mockDbStmt({ all: () => [{ id: 1, text: 'test', done: 0 }] }));

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/todos/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with todos', async () => {
    mockSession(true);
    const { GET } = await import('@/app/api/todos/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([{ id: 1, text: 'test', done: 0 }]);
  });
});

describe('POST /api/todos', () => {
  beforeEach(() => mockDbStmt());

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/todos/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/todos/route');
    const res = await POST(postReq('not json'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/todos/route');
    const res = await POST(postReq({ text: 'new todo' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('id');
  });

  it('returns the created todo so clients do not depend on optimistic placeholders', async () => {
    mockSession(true);
    const statements: any[] = [];
    const insertStmt = { run: () => ({ lastInsertRowid: 42 }) };
    const getStmt = { get: () => ({ id: 42, text: 'new todo', done: 0, deadline: null, created_at: '2026-04-25 12:00:00' }) };
    const prepare = vi.fn((sql: string) => {
      statements.push(sql);
      return sql.startsWith('INSERT INTO todos') ? insertStmt : getStmt;
    });
    const db = (await import('@/lib/db')).default;
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(prepare);

    const { POST } = await import('@/app/api/todos/route');
    const res = await POST(postReq({ text: 'new todo' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      id: 42,
      text: 'new todo',
      done: 0,
      deadline: null,
      created_at: '2026-04-25 12:00:00',
    });
    expect(statements).toContain('SELECT * FROM todos WHERE id = ?');
  });
});
