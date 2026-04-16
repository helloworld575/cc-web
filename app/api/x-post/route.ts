export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { postTweet, postThread, uploadMedia } from '@/lib/xapi';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'x-post', 10);
  if (rl) return rl;

  const contentType = req.headers.get('content-type') || '';

  // Handle multipart form (with images)
  if (contentType.includes('multipart/form-data')) {
    return handleMultipart(req);
  }

  // Handle JSON (text-only)
  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { text, thread, media_ids } = body;

  // Thread mode
  if (thread && Array.isArray(thread) && thread.length > 0) {
    const result = await postThread(thread);
    if (result.errors.length > 0) {
      return Response.json({ error: result.errors[0], posted: result.results }, { status: 502 });
    }
    return Response.json({ ok: true, tweets: result.results });
  }

  // Single tweet mode
  if (!text || typeof text !== 'string') {
    return Response.json({ error: 'Missing text field' }, { status: 400 });
  }
  if (text.length > 280) {
    return Response.json({ error: `Tweet too long: ${text.length}/280 characters` }, { status: 400 });
  }

  const result = await postTweet(text, media_ids);
  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 502 });
  }
  return Response.json({ ok: true, tweet: result });
}

async function handleMultipart(req: Request) {
  const formData = await req.formData();
  const text = formData.get('text') as string || '';
  const files = formData.getAll('images') as File[];

  if (!text && files.length === 0) {
    return Response.json({ error: 'Missing text or images' }, { status: 400 });
  }
  if (text.length > 280) {
    return Response.json({ error: `Tweet too long: ${text.length}/280 characters` }, { status: 400 });
  }
  if (files.length > 4) {
    return Response.json({ error: 'Maximum 4 images per tweet' }, { status: 400 });
  }

  // Upload images first
  const mediaIds: string[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadMedia(buffer, file.type || 'image/jpeg');
    if ('error' in result) {
      return Response.json({ error: `Image upload failed: ${result.error}` }, { status: 502 });
    }
    mediaIds.push(result.media_id_string);
  }

  // Post tweet with media
  const result = await postTweet(text, mediaIds.length > 0 ? mediaIds : undefined);
  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 502 });
  }
  return Response.json({ ok: true, tweet: result, media_ids: mediaIds });
}
