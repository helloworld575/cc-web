import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongo';
import { ObjectId } from 'mongodb';

const DB = 'thomaslee-blog';
const COLLECTION = 'fortune_history';

const noMongo = () => new Response(JSON.stringify({ error: 'MongoDB not configured' }), { status: 501 });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (!clientPromise) return noMongo();

  let oid: ObjectId;
  try { oid = new ObjectId(params.id); } catch {
    return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
  }

  const client = await clientPromise;
  const doc = await client.db(DB).collection(COLLECTION).findOne({ _id: oid });
  if (!doc) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return Response.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (!clientPromise) return noMongo();

  let oid: ObjectId;
  try { oid = new ObjectId(params.id); } catch {
    return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
  }

  const client = await clientPromise;
  const result = await client.db(DB).collection(COLLECTION).deleteOne({ _id: oid });
  if (result.deletedCount === 0) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  return Response.json({ ok: true });
}
