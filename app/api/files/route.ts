export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

export async function GET() {
  const files = db.prepare('SELECT * FROM files ORDER BY uploaded_at DESC').all();
  return NextResponse.json(files);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file || !file.name) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json({ error: `File type not allowed. Use: ${ALLOWED_EXTS.join(', ')}` }, { status: 400 });
  }

  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(process.cwd(), 'uploads', filename), buffer);

  const mimeType = file.type || `image/${ext.slice(1)}`;
  db.prepare(
    'INSERT INTO files (filename, original_name, mime_type, size) VALUES (?, ?, ?, ?)'
  ).run(filename, file.name, mimeType, file.size);

  return NextResponse.json({ ok: true, filename });
}
