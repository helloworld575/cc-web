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
  const filepath = path.join(process.cwd(), 'uploads', filename);
  if (!existsSync(filepath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const buffer = await readFile(filepath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';
  return new NextResponse(buffer, { headers: { 'Content-Type': contentType } });
}
