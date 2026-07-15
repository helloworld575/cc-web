export const runtime = 'nodejs';
export const maxDuration = 300;

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';
import { runDailySubscriptionPublishing } from '@/lib/subscription-daily';
import { hasValidSubscriptionCronToken } from '@/lib/subscription-service';
import { getRequestId, logServerEvent, summarizeError } from '@/lib/server-log';

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  const cronAuthorized = hasValidSubscriptionCronToken(req);
  if (!cronAuthorized) {
    const session = await getServerSession(authOptions);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const limited = rateLimitByIp(req, 'subscriptions-daily', 3);
    if (limited) return limited;
  }

  logServerEvent('info', 'subscription-daily', 'request_started', {
    request_id: requestId,
    auth_mode: cronAuthorized ? 'cron' : 'session',
  });

  try {
    const result = await runDailySubscriptionPublishing({ requestId });
    logServerEvent('info', 'subscription-daily', 'request_completed', {
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
      crawl_total: result.crawl.total,
      crawl_success: result.crawl.success,
      crawl_failed: result.crawl.failed,
      run_date: result.run_date,
      publish_status: result.status,
      ai_status: result.publications.find(item => item.topic === 'ai')?.status,
      ai_entry_count: result.publications.find(item => item.topic === 'ai')?.entry_count || 0,
      security_status: result.publications.find(item => item.topic === 'security')?.status,
      security_entry_count: result.publications.find(item => item.topic === 'security')?.entry_count || 0,
    });
    return Response.json(result, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (caught) {
    logServerEvent('error', 'subscription-daily', 'request_failed', {
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
      ...summarizeError(caught),
    });
    return Response.json({
      code: 'SUBSCRIPTION_DAILY_FAILED',
      error: 'Daily subscription publishing failed. Check server logs.',
      request_id: requestId,
    }, { status: 500 });
  }
}
