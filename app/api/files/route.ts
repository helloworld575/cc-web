export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { stmts } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '24')));
  const search = searchParams.get('search') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const albumId = searchParams.get('album_id') ?? '';

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push('original_name LIKE ?');
    params.push(`%${search}%`);
  }
  if (from) {
    conditions.push("uploaded_at >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("uploaded_at < ?");
    params.push(to + 'T24');
  }
  if (albumId === 'none') {
    conditions.push('album_id IS NULL');
  } else if (albumId) {
    conditions.push('album_id = ?');
    params.push(Number(albumId));
  }

  if (!conditions.length) {
    // Fast path: use prepared statements for unfiltered queries
    const total = (stmts.countFiles.get() as { c: number }).c;
    const files = stmts.listFiles.all(pageSize, (page - 1) * pageSize);
    return NextResponse.json({ files, total });
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const total = (db.prepare(`SELECT COUNT(*) as c FROM files ${where}`).get(...params) as { c: number }).c;
  const files = db.prepare(`SELECT * FROM files ${where} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);

  return NextResponse.json({ files, total });
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
  const albumId = formData.get('album_id');
  stmts.insertFile.run(filename, file.name, mimeType, file.size, albumId ? Number(albumId) : null);

  return NextResponse.json({ ok: true, filename });
}
