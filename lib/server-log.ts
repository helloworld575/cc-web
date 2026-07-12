import { randomUUID } from 'node:crypto';

export type ServerLogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEY = /authorization|cookie|credential|password|secret|token|api[_-]?key/i;
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const MAX_LOG_STRING_CHARS = 500;

function sanitizeLogText(value: string) {
  return value
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/([?&](?:key|token|secret|password)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LOG_STRING_CHARS);
}

function sanitizeLogValue(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') return sanitizeLogText(value);
  if (value instanceof Error) return summarizeError(value);
  if (depth >= 4) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(item => sanitizeLogValue(item, '', depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([nestedKey, nestedValue]) => [
          nestedKey,
          sanitizeLogValue(nestedValue, nestedKey, depth + 1),
        ]),
    );
  }
  return sanitizeLogText(String(value));
}

export function sanitizeLogFields(fields: Record<string, unknown>) {
  return sanitizeLogValue(fields) as Record<string, unknown>;
}

export function summarizeError(caught: unknown) {
  const errorLike = caught as { name?: unknown; code?: unknown; message?: unknown };
  return {
    error_name: typeof errorLike?.name === 'string' ? sanitizeLogText(errorLike.name) : 'Error',
    error_code: typeof errorLike?.code === 'string' ? sanitizeLogText(errorLike.code) : undefined,
    error_message: typeof errorLike?.message === 'string'
      ? sanitizeLogText(errorLike.message)
      : sanitizeLogText(String(caught)),
  };
}

export function getRequestId(req: Request) {
  const incoming = req.headers.get('x-request-id')?.trim() || '';
  return SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

export function logServerEvent(
  level: ServerLogLevel,
  scope: string,
  event: string,
  fields: Record<string, unknown> = {},
) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    event,
    ...sanitizeLogFields(fields),
  };
  console[level](JSON.stringify(entry));
}
