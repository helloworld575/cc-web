import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongo';

const DB = 'thomaslee-blog';
const COLLECTION = 'fortune_history';

const noMongo = () => new Response(JSON.stringify({ error: 'MongoDB not configured' }), { status: 501 });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (!clientPromise) return noMongo();

  const client = await clientPromise;
  const col = client.db(DB).collection(COLLECTION);
  const docs = await col.find().sort({ createdAt: -1 }).limit(100).toArray();

  return Response.json(docs);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (!clientPromise) return noMongo();

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

  const client = await clientPromise;
  const col = client.db(DB).collection(COLLECTION);
  const doc = { method, input, preflight, analysis, createdAt: new Date() };
  const result = await col.insertOne(doc);

  return Response.json({ _id: result.insertedId, ...doc }, { status: 201 });
}
