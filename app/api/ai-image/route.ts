export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';

const MOCK_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx7cAAAAASUVORK5CYII=';

function getImageGenerationUrl() {
  const configured = (process.env.GPT_IMAGE_API_URL || 'https://www.right.codes/draw').replace(/\/+$/, '');
  if (configured.endsWith('/v1/images/generations')) return configured;
  if (configured.endsWith('/images/generations')) return configured;
  if (configured.endsWith('/v1')) return `${configured}/images/generations`;
  return `${configured}/v1/images/generations`;
}

function getChatImageGenerationUrl() {
  const configured = (process.env.GPT_IMAGE_API_URL || 'https://www.right.codes/draw').replace(/\/+$/, '');
  if (configured.endsWith('/v1/chat/completions')) return configured;
  if (configured.endsWith('/chat/completions')) return configured;
  if (configured.endsWith('/v1')) return `${configured}/chat/completions`;
  if (configured.endsWith('/gpt')) return `${configured}/v1/chat/completions`;
  return `${configured}/v1/chat/completions`;
}

function getImageApiMode() {
  const configured = process.env.GPT_IMAGE_API_MODE?.trim().toLowerCase();
  if (configured === 'chat' || configured === 'chat-completions') return 'chat';
  return 'images';
}

function getImageModel() {
  return process.env.GPT_IMAGE_MODEL || 'gpt-image-2-pro';
}

function getImageGroup() {
  return process.env.GPT_IMAGE_GROUP || 'vip_2_image';
}

function normalizeReferenceImage(value: unknown) {
  if (value == null || value === '') return { value: null, error: null };
  if (typeof value !== 'string') {
    return { value: null, error: 'Reference image must be a data URL image' };
  }

  const trimmed = value.trim();
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return { value: null, error: 'Reference image must be a data URL image' };
  }

  return { value: trimmed, error: null };
}

function logImageFailure(reason: string, detail: Record<string, unknown>) {
  console.warn('[ai-image]', reason, detail);
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

async function readUpstreamJson(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const detail = await response.text().catch(() => response.statusText);
    return {
      data: null,
      error: 'Image API returned a non-JSON response',
      detail: detail.slice(0, 500),
    };
  }

  try {
    return {
      data: await response.json(),
      error: null,
      detail: null,
    };
  } catch (caught: unknown) {
    const errorLike = caught as { message?: string };
    return {
      data: null,
      error: 'Image API returned invalid JSON',
      detail: errorLike?.message || response.statusText,
    };
  }
}

function buildUserImageMessage(prompt: string, referenceImage: string | null) {
  if (!referenceImage) return prompt;
  return [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: referenceImage } },
  ];
}

function buildImageRequestBody(prompt: string, referenceImage: string | null) {
  return {
    model: getImageModel(),
    group: getImageGroup(),
    messages: [
      { role: 'user', content: '测试' },
      { role: 'assistant', content: '' },
      { role: 'user', content: buildUserImageMessage(prompt, referenceImage) },
    ],
    stream: true,
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };
}

function buildNativeImageRequestBody(prompt: string, referenceImage: string | null, size: unknown) {
  const payload: Record<string, unknown> = {
    model: getImageModel(),
    prompt,
    response_format: 'url',
  };
  if (typeof size === 'string' && size.trim()) payload.size = size.trim();
  if (referenceImage) payload.image = referenceImage;
  return payload;
}

function extractContentFromJson(data: any) {
  return [
    data.choices?.[0]?.message?.content,
    data.choices?.[0]?.delta?.content,
    data.message?.content,
    data.content,
    data.text,
    data.output,
  ].find(value => typeof value === 'string' && value.trim()) || '';
}

function extractImageFromText(text: string) {
  const markdownImage = text.match(/!\[[^\]]*]\(([^)\s]+)[^)]*\)/);
  if (markdownImage?.[1]) return markdownImage[1];

  const dataImage = text.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
  if (dataImage?.[0]) return dataImage[0];

  const imageUrl = text.match(/https?:\/\/[^\s"'<>)]*\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>)]*)?/i);
  if (imageUrl?.[0]) return imageUrl[0];

  const anyUrl = text.match(/https?:\/\/[^\s"'<>)]*/i);
  return anyUrl?.[0] || '';
}

function normalizeImageResponse(data: any, prompt: string) {
  const legacyImage = data.data?.[0]?.b64_json
    ? `data:image/png;base64,${data.data[0].b64_json}`
    : data.data?.[0]?.url;
  const content = extractContentFromJson(data);
  const image = legacyImage || extractImageFromText(content);

  return {
    image,
    revisedPrompt: data.data?.[0]?.revised_prompt || content || prompt,
    created: data.created,
  };
}

async function readUpstreamStream(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    return { text: '', error: 'Image API returned an empty stream', detail: null };
  }

  const decoder = new TextDecoder();
  let buf = '';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const raw = trimmed.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        text += extractContentFromJson(parsed);
      } catch {
        text += raw;
      }
    }
  }

  if (buf.trim().startsWith('data: ')) {
    const raw = buf.trim().slice(6).trim();
    if (raw && raw !== '[DONE]') {
      try {
        text += extractContentFromJson(JSON.parse(raw));
      } catch {
        text += raw;
      }
    }
  }

  return { text, error: null, detail: null };
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

  const referenceImage = normalizeReferenceImage(body.reference_image);
  if (referenceImage.error) return Response.json({ error: referenceImage.error }, { status: 400 });

  if (process.env.E2E_MOCK_STREAMS === '1') {
    return Response.json({
      image: `data:image/png;base64,${MOCK_IMAGE_BASE64}`,
      model: getImageModel(),
      prompt,
      revised_prompt: prompt,
    });
  }

  const apiKey = process.env.GPT_IMAGE_API_KEY;
  if (!apiKey) return Response.json({ error: 'GPT_IMAGE_API_KEY is not configured' }, { status: 500 });

  let upstream: Response;
  const imageGroup = getImageGroup();
  const mode = getImageApiMode();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const requestUrl = mode === 'chat' ? getChatImageGenerationUrl() : getImageGenerationUrl();
  const requestBody = mode === 'chat'
    ? buildImageRequestBody(prompt, referenceImage.value)
    : buildNativeImageRequestBody(prompt, referenceImage.value, body.size);
  if (mode === 'chat') {
    headers['New-Api-Group'] = imageGroup;
  }

  try {
    upstream = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (caught: unknown) {
    const errorLike = caught as { message?: string };
    return Response.json({ error: errorLike?.message || 'Failed to reach image API' }, { status: 502 });
  }

  if (!upstream.ok) {
    const { error, detail } = await readUpstreamError(upstream);
    logImageFailure('upstream-error', {
      status: upstream.status,
      contentType: upstream.headers.get('content-type') || '',
      detail,
    });
    return Response.json({ error, detail }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') || '';
  let image = '';
  let revisedPrompt = prompt;
  let created: unknown;

  if (contentType.includes('text/event-stream')) {
    const { text, error, detail } = await readUpstreamStream(upstream);
    if (error) {
      logImageFailure('stream-error', { error, detail });
      return Response.json({ error, detail }, { status: 502 });
    }
    image = extractImageFromText(text);
    revisedPrompt = prompt;
  } else {
    const { data, error: parseError, detail: parseDetail } = await readUpstreamJson(upstream);
    if (parseError) {
      logImageFailure('parse-error', {
        error: parseError,
        detail: parseDetail,
        contentType,
      });
      return Response.json({ error: parseError, detail: parseDetail }, { status: 502 });
    }

    const normalized = normalizeImageResponse(data, prompt);
    image = normalized.image;
    revisedPrompt = normalized.revisedPrompt;
    created = normalized.created;
  }

  if (!image) {
    logImageFailure('no-image', { contentType });
    return Response.json({ error: 'Image API returned no image' }, { status: 502 });
  }

  return Response.json({
    image,
    model: getImageModel(),
    prompt,
    revised_prompt: revisedPrompt ?? prompt,
    created,
  });
}
