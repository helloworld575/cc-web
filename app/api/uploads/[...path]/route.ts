export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

export async function GET(_: Request, { params }: { params: { path: string[] } }) {
  const filename = params.path.join('/');
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const resolved = path.resolve(uploadsDir, filename);
  if (!resolved.startsWith(uploadsDir + path.sep))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!existsSync(resolved)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const buffer = await readFile(resolved);
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  };
  if (ext === '.svg') headers['Content-Security-Policy'] = "script-src 'none'";
  return new NextResponse(buffer, { headers });
}
