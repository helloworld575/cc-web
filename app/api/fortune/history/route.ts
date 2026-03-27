import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stmts } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const rows = stmts.listFortune.all().map(r => {
    const row = r as any;
    return { ...row, input: JSON.parse(row.input), preflight: JSON.parse(row.preflight) };
  });

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }
  const { method, input, preflight, analysis } = body as {
    method: string;
    input: Record<string, unknown>;
    preflight: Record<string, unknown>;
    analysis: string;
  };

  if (!method || !analysis) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  const result = stmts.insertFortune.run(method, JSON.stringify(input ?? {}), JSON.stringify(preflight ?? {}), analysis);
  const doc = stmts.getFortune.get(result.lastInsertRowid) as any;

  return Response.json({
    ...doc,
    input: JSON.parse(doc.input),
    preflight: JSON.parse(doc.preflight),
  }, { status: 201 });
}
