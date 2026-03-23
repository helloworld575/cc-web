export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getSkill, saveSkill, deleteSkill } from '@/lib/skills';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const skill = getSkill(params.id);
  if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(skill);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  saveSkill({ ...body, id: params.id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  deleteSkill(params.id);
  return NextResponse.json({ ok: true });
}
