export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getSkills, saveSkill } from '@/lib/skills';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  return NextResponse.json(getSkills());
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let skill: any;
  try { skill = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!skill.id || !skill.name || !skill.prompt) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (!/^[a-z0-9-]+$/.test(skill.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  saveSkill(skill);
  return NextResponse.json({ ok: true });
}
