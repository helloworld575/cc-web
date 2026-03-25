import { vi } from 'vitest';
import { getServerSession } from 'next-auth';
import { rateLimitByIp } from '@/lib/rateLimit';
import db from '@/lib/db';

export function makeReq(method: string, url: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: { 'x-forwarded-for': '127.0.0.1' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`http://localhost${url}`, init);
}

export function postReq(body?: unknown, headers?: Record<string, string>): Request {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  if (headers) init.headers = headers;
  return new Request('http://localhost', init);
}

export function mockStreamResponse(mockFetch: ReturnType<typeof vi.fn>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\n'));
      controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n\n'));
      controller.close();
    },
  });
  mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));
}

export function mockRateLimit429() {
  vi.mocked(rateLimitByIp).mockReturnValue(new Response('{}', { status: 429 }));
}

export function mockSession(authed: boolean) {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(
    authed ? { user: { name: 'Admin' } } : null
  );
}

export function mockDbStmt(overrides: Record<string, unknown> = {}) {
  const stmt = {
    get: vi.fn(() => undefined),
    all: vi.fn(() => []),
    run: vi.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
    ...overrides,
  };
  (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue(stmt);
  return stmt;
}
