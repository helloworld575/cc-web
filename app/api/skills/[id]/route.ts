export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getSkill, saveSkill, deleteSkill } from '@/lib/skills';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const ID_RE = /^[a-z0-9-]+$/;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const skill = getSkill(id);
  if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(skill);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  saveSkill({ ...body, id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  deleteSkill(id);
  return NextResponse.json({ ok: true });
}
