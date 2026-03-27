import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stmts } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
  }

  const doc = stmts.getFortune.get(id) as any;
  if (!doc) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return Response.json({
    ...doc,
    input: JSON.parse(doc.input),
    preflight: JSON.parse(doc.preflight),
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
  }

  const result = stmts.deleteFortune.run(id);
  if (result.changes === 0) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return Response.json({ ok: true });
}
