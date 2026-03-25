import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

const params = (p: string[]) => ({ params: { path: p } });

describe('GET /api/uploads/[...path]', () => {
  it('returns 403 on path traversal', async () => {
    const { GET } = await import('@/app/api/uploads/[...path]/route');
    const res = await GET(new Request('http://localhost'), params(['..', '..', 'etc', 'passwd']));
    expect(res.status).toBe(403);
  });

  it('returns 404 when file missing', async () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const { GET } = await import('@/app/api/uploads/[...path]/route');
    const res = await GET(new Request('http://localhost'), params(['photo.jpg']));
    expect(res.status).toBe(404);
  });

  it('returns 200 with correct MIME', async () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('fake'));
    const { GET } = await import('@/app/api/uploads/[...path]/route');
    const res = await GET(new Request('http://localhost'), params(['photo.png']));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns CSP header for SVG', async () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('<svg></svg>'));
    const { GET } = await import('@/app/api/uploads/[...path]/route');
    const res = await GET(new Request('http://localhost'), params(['icon.svg']));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Security-Policy')).toBe("script-src 'none'");
  });
});
