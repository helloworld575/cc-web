export const runtime = 'nodejs';
export const maxDuration = 300;
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getSkill } from '@/lib/skills';
import { isInvocableSkill } from '@/lib/skill-taxonomy';
import {
  getEnabledSubscriptionSources,
  integrateSubscriptionSources,
} from '@/lib/subscription-service';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'subscriptions-integrate', 5);
  if (rl) return rl;

  const subscriptionSkill = getSkill('subscription');
  if (!isInvocableSkill(subscriptionSkill)) {
    return Response.json({ error: 'Subscription skill is not invocable' }, { status: 500 });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const sources = getEnabledSubscriptionSources(body.source_id);
  if (sources.length === 0) {
    return Response.json({ error: 'No enabled sources found' }, { status: 404 });
  }

  return Response.json(await integrateSubscriptionSources(subscriptionSkill, sources));
}
