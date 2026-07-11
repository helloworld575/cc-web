import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
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

describe('request proxy', () => {
  it('reads admin auth tokens from non-secure NAS LAN cookies', async () => {
    process.env.NEXTAUTH_SECRET = 'test-secret';
    vi.mocked(getToken).mockResolvedValue({ name: 'Admin' });

    const response = await proxy(request('/admin/blog'));

    expect(getToken).toHaveBeenCalledWith({
      req: expect.anything(),
      secret: 'test-secret',
      secureCookie: false,
    });
    expect(response.status).not.toBe(307);
  });

  it('applies a global login ceiling even when forwarding headers rotate', async () => {
    process.env.TRUST_PROXY_HEADERS = '1';
    let response: Response | undefined;
    for (let index = 0; index < 51; index += 1) {
      response = await proxy(request('/api/auth/callback/credentials', {
        method: 'POST',
        headers: new Headers({ 'x-forwarded-for': `203.0.113.${index + 1}` }),
      }));
    }
    expect(response?.status).toBe(429);
  });
});
