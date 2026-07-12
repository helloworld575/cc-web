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
import { getRequestId, logServerEvent, summarizeError } from '@/lib/server-log';

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
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

  logServerEvent('info', 'subscription-crawl', 'request_started', {
    request_id: requestId,
    auth_mode: cronAuthorized ? 'cron' : 'session',
    source_count: sources.length,
    source_id: body.source_id,
  });

  try {
    const result = await crawlSubscriptionSources(sources);
    const successCount = result.results.filter(item => item.success).length;
    logServerEvent('info', 'subscription-crawl', 'request_completed', {
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
      source_count: result.total,
      success_count: successCount,
      failure_count: result.total - successCount,
    });
    return Response.json(result, { headers: { 'X-Request-ID': requestId } });
  } catch (caught) {
    logServerEvent('error', 'subscription-crawl', 'request_failed', {
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
      source_count: sources.length,
      ...summarizeError(caught),
    });
    throw caught;
  }
}
