export const runtime = 'nodejs';
export const maxDuration = 300;
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getSkill } from '@/lib/skills';
import { isInvocableSkill } from '@/lib/skill-taxonomy';
import {
  getEnabledSubscriptionSources,
  hasSubscriptionAiProvider,
  integrateSubscriptionSources,
  type SubscriptionGenerationSkillMap,
} from '@/lib/subscription-service';
import {
  getSubscriptionGenerationSkillId,
  type SubscriptionTopic,
} from '@/lib/subscription-topics';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'subscriptions-integrate', 5);
  if (rl) return rl;

  if (!hasSubscriptionAiProvider()) {
    return Response.json({
      code: 'provider_not_configured',
      error: 'AI provider is not configured.',
      retryable: false,
    }, { status: 503 });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const sources = getEnabledSubscriptionSources(body.source_id);
  if (sources.length === 0) {
    return Response.json({ error: 'No enabled sources found' }, { status: 404 });
  }

  const topics = Array.from(new Set(sources.map(source => source.topic))) as SubscriptionTopic[];
  const skillsByTopic: SubscriptionGenerationSkillMap = {};
  for (const topic of topics) {
    const skill = getSkill(getSubscriptionGenerationSkillId(topic));
    if (!isInvocableSkill(skill)) {
      const label = topic === 'security' ? 'Security' : 'AI';
      return Response.json({
        code: 'subscription_skill_unavailable',
        error: `${label} subscription skill is not invocable`,
        topic,
      }, { status: 500 });
    }
    skillsByTopic[topic] = skill;
  }

  return Response.json(await integrateSubscriptionSources(skillsByTopic, sources));
}
