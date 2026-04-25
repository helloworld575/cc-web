export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';

const MOCK_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx7cAAAAASUVORK5CYII=';

const ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024']);

function getImageApiUrl() {
  return (process.env.GPT_IMAGE_API_URL || 'https://right.codes/gpt').replace(/\/$/, '');
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = rateLimitByIp(req, 'ai-image', 10);
  if (rl) return rl;

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return Response.json({ error: 'Prompt is required' }, { status: 400 });

  const size = ALLOWED_SIZES.has(body.size) ? body.size : '1024x1024';

  if (process.env.E2E_MOCK_STREAMS === '1') {
    return Response.json({
      image: `data:image/png;base64,${MOCK_IMAGE_BASE64}`,
      model: 'gpt-image-2',
      prompt,
      size,
    });
  }

  const apiKey = process.env.GPT_IMAGE_API_KEY;
  if (!apiKey) return Response.json({ error: 'GPT_IMAGE_API_KEY is not configured' }, { status: 500 });

  const upstream = await fetch(`${getImageApiUrl()}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      size,
    }),
  });

  if (!upstream.ok) {
    let message = 'Image API error';
    try {
      const data = await upstream.json();
      message = data.error?.message || data.message || message;
    } catch {}
    return Response.json({ error: message }, { status: 502 });
  }

  const data = await upstream.json();
  const image = data.data?.[0]?.b64_json
    ? `data:image/png;base64,${data.data[0].b64_json}`
    : data.data?.[0]?.url;

  if (!image) return Response.json({ error: 'Image API returned no image' }, { status: 502 });

  return Response.json({ image, model: 'gpt-image-2', prompt, size });
}
