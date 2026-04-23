export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { findSkills, getSkills, saveSkill } from '@/lib/skills';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const includeNonInvocable = params.get('catalog') === 'all';
  const query = params.get('q');
  return NextResponse.json(
    query
      ? findSkills(query, { includeNonInvocable })
      : getSkills({ includeNonInvocable }),
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let skill: any;
  try { skill = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const invocable = skill.invocable !== false;
  if (!skill.id || !skill.name || !skill.description) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (invocable && (!skill.prompt || !skill.output)) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (!/^[a-z0-9-]+$/.test(skill.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  saveSkill({ ...skill, invocable });
  return NextResponse.json({ ok: true });
}
