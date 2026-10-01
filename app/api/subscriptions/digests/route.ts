export const runtime = 'nodejs';
export const maxDuration = 120;

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';
import {
  generateSubscriptionDigest,
  listSubscriptionDigests,
  type SubscriptionDigestTopic,
} from '@/lib/subscription-digest';

const MAX_LIMIT = 100;

function isTopic(value: unknown): value is SubscriptionDigestTopic {
  return value === 'ai' || value === 'security';
}

function isTopicSelection(value: unknown): value is SubscriptionDigestTopic | 'all' {
  return value === 'all' || isTopic(value);
}

function readLimit(value: string | null, fallback = 20) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(MAX_LIMIT, parsed);
}

function digestError(caught: unknown) {
  const code = (caught as { code?: unknown })?.code;
  if (code === 'NO_ITEMS') {
    return Response.json({ code, error: 'No new subscription items.' }, { status: 404 });
  }
  if (code === 'AI_NOT_CONFIGURED') {
    return Response.json({ code, error: 'No AI provider is configured.' }, { status: 503 });
  }
  if (code === 'AI_GENERATION_FAILED') {
    return Response.json({ code, error: 'Unable to generate the subscription digest.' }, { status: 502 });
  }
  return Response.json({ code: 'SUBSCRIPTION_DIGEST_FAILED', error: 'Subscription digest failed.' }, { status: 500 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawTopic = url.searchParams.get('topic');
  if (rawTopic !== null && rawTopic !== 'all' && !isTopic(rawTopic)) {
    return Response.json({ error: 'Invalid topic' }, { status: 400 });
  }
  const limit = readLimit(url.searchParams.get('limit'));
  if (limit === null) return Response.json({ error: 'Invalid limit' }, { status: 400 });

  return Response.json(listSubscriptionDigests({
    topic: rawTopic === 'all' ? undefined : rawTopic as SubscriptionDigestTopic | undefined,
    limit,
  }));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = rateLimitByIp(req, 'subscriptions-digest', 5);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const candidate = body as { topic?: unknown; limit?: unknown };
  const topic = candidate.topic === undefined ? 'ai' : candidate.topic;
  if (!isTopicSelection(topic)) return Response.json({ error: 'Invalid topic' }, { status: 400 });
  if (candidate.limit !== undefined && (
    typeof candidate.limit !== 'number'
    || !Number.isInteger(candidate.limit)
    || candidate.limit < 1
    || candidate.limit > 20
  )) {
    return Response.json({ error: 'Invalid limit' }, { status: 400 });
  }

  try {
    const topics: SubscriptionDigestTopic[] = topic === 'all' ? ['ai', 'security'] : [topic];
    const digests = [] as Awaited<ReturnType<typeof generateSubscriptionDigest>>[];
    const skippedTopics: SubscriptionDigestTopic[] = [];
    for (const selectedTopic of topics) {
      try {
        digests.push(await generateSubscriptionDigest({
          topic: selectedTopic,
          limit: candidate.limit as number | undefined,
        }));
      } catch (caught) {
        if ((caught as { code?: unknown })?.code !== 'NO_ITEMS') throw caught;
        skippedTopics.push(selectedTopic);
      }
    }
    if (digests.length === 0) {
      return Response.json({ code: 'NO_ITEMS', error: 'No new subscription items.' }, { status: 404 });
    }
    const status = digests.some(digest => !digest.reused) ? 201 : 200;
    if (topic === 'all') {
      return Response.json({ digests, skipped_topics: skippedTopics }, { status });
    }
    return Response.json(digests[0], { status });
  } catch (caught) {
    return digestError(caught);
  }
}
