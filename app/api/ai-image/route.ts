export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';

const MOCK_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx7cAAAAASUVORK5CYII=';

function getImageGenerationUrl() {
  const configured = (process.env.GPT_IMAGE_API_URL || 'https://right.codes').replace(/\/+$/, '');
  if (configured.endsWith('/v1/images/generations')) return configured;
  if (configured.endsWith('/v1')) return `${configured}/images/generations`;
  if (configured.endsWith('/gpt')) return `${configured}/v1/images/generations`;
  return `${configured}/gpt/v1/images/generations`;
}

async function readUpstreamError(response: Response) {
  const fallback = `Image API error (${response.status})`;
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const detail = data.error?.message || data.message || data.error || JSON.stringify(data);
      return { error: detail ? `${fallback}: ${detail}` : fallback, detail };
    }
    const detail = await response.text();
    return { error: fallback, detail: detail.slice(0, 500) };
  } catch {
    return { error: fallback, detail: response.statusText };
  }
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

  if (process.env.E2E_MOCK_STREAMS === '1') {
    return Response.json({
      image: `data:image/png;base64,${MOCK_IMAGE_BASE64}`,
      model: 'gpt-image-2',
      prompt,
      revised_prompt: prompt,
    });
  }

  const apiKey = process.env.GPT_IMAGE_API_KEY;
  if (!apiKey) return Response.json({ error: 'GPT_IMAGE_API_KEY is not configured' }, { status: 500 });

  const upstream = await fetch(getImageGenerationUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
    }),
  });

  if (!upstream.ok) {
    const { error, detail } = await readUpstreamError(upstream);
    return Response.json({ error, detail }, { status: 502 });
  }

  const data = await upstream.json();
  const image = data.data?.[0]?.b64_json
    ? `data:image/png;base64,${data.data[0].b64_json}`
    : data.data?.[0]?.url;
  const revisedPrompt = data.data?.[0]?.revised_prompt;

  if (!image) return Response.json({ error: 'Image API returned no image' }, { status: 502 });

  return Response.json({
    image,
    model: 'gpt-image-2',
    prompt,
    revised_prompt: revisedPrompt ?? prompt,
    created: data.created,
  });
}
