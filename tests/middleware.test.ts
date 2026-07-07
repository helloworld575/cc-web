import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { getToken } from 'next-auth/jwt';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

function request(pathname: string, init: Partial<NextRequest> = {}) {
  return {
    method: 'GET',
    url: `http://192.168.31.92:3000${pathname}`,
    nextUrl: { pathname },
    headers: new Headers(),
    ...init,
  } as NextRequest;
}

describe('middleware', () => {
  it('reads admin auth tokens from non-secure NAS LAN cookies', async () => {
    process.env.NEXTAUTH_SECRET = 'test-secret';
    vi.mocked(getToken).mockResolvedValue({ name: 'Admin' });

    const response = await middleware(request('/admin/blog'));

    expect(getToken).toHaveBeenCalledWith({
      req: expect.anything(),
      secret: 'test-secret',
      secureCookie: false,
    });
    expect(response.status).not.toBe(307);
  });
});
