export const runtime = 'nodejs';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getRequestId, logServerEvent } from '@/lib/server-log';

const UPSTREAM_TIMEOUT_MS = 120_000;
const RESOURCE_ID = '[A-Za-z0-9_-]{1,128}';
const GET_PATHS = [
  /^health$/,
  /^v1\/toolchains$/,
  /^v1\/projects$/,
  new RegExp(`^v1/projects/${RESOURCE_ID}$`),
  new RegExp(`^v1/artifacts/${RESOURCE_ID}$`),
  /^v1\/assessments$/,
  new RegExp(`^v1/assessments/${RESOURCE_ID}$`),
  new RegExp(`^v1/assessments/${RESOURCE_ID}/(?:evidence|findings|events)$`),
  new RegExp(`^v1/reports/${RESOURCE_ID}$`),
  new RegExp(`^v1/reports/${RESOURCE_ID}/download$`),
];
const POST_PATHS = [
  /^v1\/projects$/,
  /^v1\/artifacts$/,
  /^v1\/assessments$/,
  /^v1\/assessments\/(?:requirements|code|api|reverse-mobile|domain|components)$/,
  new RegExp(`^v1/assessments/${RESOURCE_ID}/(?:approve|cancel)$`),
  /^v1\/reports$/,
  /^v1\/gates\/evaluate$/,
];
const REQUEST_HEADERS = ['accept', 'content-type', 'idempotency-key'] as const;
const RESPONSE_HEADERS = ['content-type', 'content-disposition', 'retry-after'] as const;

type RouteContext = { params: Promise<{ path: string[] }> };

interface SecurityServiceConfig {
  baseUrl: URL;
  apiKey: string;
}

function securityError(status: number, code: string, error: string, requestId: string) {
  return Response.json(
    { code, error, requestId },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-ID': requestId,
      },
    },
  );
}

function serviceConfig(): SecurityServiceConfig | null {
  const rawUrl = process.env.SECURITY_API_URL?.trim();
  const apiKey = process.env.SECURITY_API_KEY?.trim();
  if (!rawUrl || !apiKey) return null;

  try {
    const baseUrl = new URL(rawUrl);
    if (
      !['http:', 'https:'].includes(baseUrl.protocol) ||
      baseUrl.username ||
      baseUrl.password ||
      baseUrl.pathname !== '/' ||
      baseUrl.search ||
      baseUrl.hash
    ) {
      return null;
    }
    return { baseUrl, apiKey };
  } catch {
    return null;
  }
}

function pathAllowed(method: 'GET' | 'POST', path: string) {
  const patterns = method === 'GET' ? GET_PATHS : POST_PATHS;
  return patterns.some((pattern) => pattern.test(path));
}

function requestHeaders(request: Request, apiKey: string, requestId: string) {
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('X-Request-ID', requestId);
  return headers;
}

function responseHeaders(upstream: Response, requestId: string) {
  const headers = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Request-ID', requestId);
  return headers;
}

async function discard(upstream: Response) {
  await upstream.body?.cancel().catch(() => undefined);
}

async function forward(request: Request, context: RouteContext, method: 'GET' | 'POST') {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const requestId = getRequestId(request);
  const limited = rateLimitByIp(request, 'security-bff', 120);
  if (limited) return limited;

  const { path: segments } = await context.params;
  const routePath = segments.join('/');
  if (!pathAllowed(method, routePath)) {
    return securityError(404, 'SECURITY_ROUTE_NOT_ALLOWED', 'Security route not found.', requestId);
  }

  const config = serviceConfig();
  if (!config) {
    return securityError(
      503,
      'SECURITY_NOT_CONFIGURED',
      'Security service is not configured.',
      requestId,
    );
  }

  const target = new URL(`/${segments.map(encodeURIComponent).join('/')}`, config.baseUrl);
  target.search = new URL(request.url).search;
  const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeoutSignal]);
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: requestHeaders(request, config.apiKey, requestId),
    redirect: 'manual',
    cache: 'no-store',
    signal,
  };
  if (method === 'POST' && request.body) {
    init.body = request.body;
    init.duplex = 'half';
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (caught: unknown) {
    logServerEvent('warn', 'security-bff', 'upstream_unavailable', {
      request_id: requestId,
      method,
      route: routePath,
      error_name: caught instanceof Error ? caught.name : 'Error',
    });
    return securityError(
      timeoutSignal.aborted ? 504 : 502,
      timeoutSignal.aborted ? 'SECURITY_UPSTREAM_TIMEOUT' : 'SECURITY_UPSTREAM_UNAVAILABLE',
      timeoutSignal.aborted
        ? 'Security service request timed out.'
        : 'Security service is unavailable.',
      requestId,
    );
  }

  const contentType = upstream.headers.get('content-type')?.toLowerCase() || '';
  const unexpectedStatus =
    (upstream.status >= 300 && upstream.status < 400) ||
    upstream.status === 401 ||
    upstream.status === 403 ||
    upstream.status >= 500;
  const unsafeClientError = upstream.status >= 400 && !contentType.includes('json');
  if (unexpectedStatus || unsafeClientError) {
    await discard(upstream);
    logServerEvent('warn', 'security-bff', 'upstream_rejected', {
      request_id: requestId,
      method,
      route: routePath,
      upstream_status: upstream.status,
      content_type: contentType,
    });
    return securityError(
      502,
      'SECURITY_UPSTREAM_FAILED',
      'Security service request failed.',
      requestId,
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders(upstream, requestId),
  });
}

export async function GET(request: Request, context: RouteContext) {
  return forward(request, context, 'GET');
}

export async function POST(request: Request, context: RouteContext) {
  return forward(request, context, 'POST');
}
