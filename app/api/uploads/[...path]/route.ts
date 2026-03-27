export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import path from 'path';
import { existsSync, statSync, createReadStream } from 'fs';

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

  const stat = statSync(resolved);
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Length': String(stat.size),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'ETag': etag,
  };
  if (ext === '.svg') headers['Content-Security-Policy'] = "script-src 'none'";

  // Stream the file instead of reading entirely into memory
  const stream = createReadStream(resolved);
  const readable = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk: string | Buffer) => controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
  });

  return new NextResponse(readable as any, { headers });
}
