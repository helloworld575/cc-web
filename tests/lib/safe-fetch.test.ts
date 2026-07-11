import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookup } from 'node:dns/promises';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

import {
  fetchPublicHttp,
  validatePublicHttpUrl,
} from '@/.codex/skills/subscription/scripts/safe-fetch';

const mockedLookup = vi.mocked(lookup);

beforeEach(() => {
  vi.restoreAllMocks();
  mockedLookup.mockReset();
  mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as any);
});

describe('validatePublicHttpUrl', () => {
  it.each([
    'file:///etc/passwd',
    'ftp://example.com/feed',
    'data:text/plain,hello',
  ])('rejects non-http subscription URLs: %s', async url => {
    await expect(validatePublicHttpUrl(url)).rejects.toThrow(/http or https/i);
  });

  it.each([
    'http://localhost/feed',
    'http://service.localhost/feed',
    'http://127.0.0.1/feed',
    'http://10.0.0.1/feed',
    'http://172.16.0.1/feed',
    'http://192.168.1.1/feed',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/feed',
    'http://[::ffff:127.0.0.1]/feed',
    'http://[fd00::1]/feed',
    'http://[fe80::1]/feed',
    'http://[fec0::1]/feed',
  ])('rejects local, private, and link-local targets: %s', async url => {
    await expect(validatePublicHttpUrl(url)).rejects.toThrow(/not allowed/i);
  });

  it('rejects hostnames that resolve to a private address', async () => {
    mockedLookup.mockResolvedValue([{ address: '10.20.30.40', family: 4 }] as any);

    await expect(validatePublicHttpUrl('https://internal.example/feed')).rejects.toThrow(/not allowed/i);
  });

  it('normalizes a public HTTP URL after DNS validation', async () => {
    await expect(validatePublicHttpUrl('https://example.com/feed')).resolves.toBe('https://example.com/feed');
    expect(mockedLookup).toHaveBeenCalledWith('example.com', { all: true, verbatim: true });
  });
});

describe('fetchPublicHttp', () => {
  it('revalidates every redirect and blocks redirects to private targets', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/admin' },
    }));

    await expect(fetchPublicHttp('https://example.com/feed')).rejects.toThrow(/not allowed/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/feed', expect.objectContaining({ redirect: 'manual' }));
  });

  it('revalidates DNS after a redirect and blocks a hostname that resolves privately', async () => {
    mockedLookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as any)
      .mockResolvedValueOnce([{ address: '192.168.1.20', family: 4 }] as any);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: 'https://internal.example/feed' },
    }));

    await expect(fetchPublicHttp('https://example.com/feed')).rejects.toThrow(/not allowed/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockedLookup).toHaveBeenCalledTimes(2);
  });

  it('rejects response bodies larger than the configured byte limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x'.repeat(64)));

    await expect(fetchPublicHttp('https://example.com/feed', {
      maxResponseBytes: 16,
    })).rejects.toThrow(/too large/i);
  });

  it('aborts a subscription request after the configured timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }));

    await expect(fetchPublicHttp('https://example.com/feed', {
      timeoutMs: 5,
    })).rejects.toThrow(/timed out/i);
  });

  it('returns a bounded response for a public target', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('feed body', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    }));

    const response = await fetchPublicHttp('https://example.com/feed');

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('feed body');
  });
});
