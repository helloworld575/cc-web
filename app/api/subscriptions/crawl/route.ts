export const runtime = 'nodejs';
export const maxDuration = 300;
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';
import {
  crawlSubscriptionSources,
  getEnabledSubscriptionSources,
  hasValidSubscriptionCronToken,
} from '@/lib/subscription-service';

export async function POST(req: Request) {
  const cronAuthorized = hasValidSubscriptionCronToken(req);
  if (!cronAuthorized) {
    const session = await getServerSession(authOptions);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const rl = rateLimitByIp(req, 'subscriptions-crawl', 10);
    if (rl) return rl;
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const sources = getEnabledSubscriptionSources(body.source_id);
  if (sources.length === 0) {
    return Response.json({ error: 'No enabled sources found' }, { status: 404 });
  }

  return Response.json(await crawlSubscriptionSources(sources));
}
