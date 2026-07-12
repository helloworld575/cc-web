import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getRequestId,
  logServerEvent,
  sanitizeLogFields,
  summarizeError,
} from '@/lib/server-log';

describe('server logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts sensitive fields and bounded error details', () => {
    expect(sanitizeLogFields({
      request_id: 'req-safe-123',
      authorization: 'Bearer top-secret-token',
      nested: {
        api_key: 'sk-private-key',
        status: 502,
      },
    })).toEqual({
      request_id: 'req-safe-123',
      authorization: '[REDACTED]',
      nested: {
        api_key: '[REDACTED]',
        status: 502,
      },
    });

    expect(summarizeError(Object.assign(new Error('Bearer secret-value failed'), { code: 'UND_ERR_CONNECT_TIMEOUT' })))
      .toEqual({
        error_name: 'Error',
        error_code: 'UND_ERR_CONNECT_TIMEOUT',
        error_message: 'Bearer [REDACTED] failed',
      });
  });

  it('emits one-line JSON with stable diagnostic fields', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logServerEvent('info', 'ai-chat', 'request_completed', {
      request_id: 'req-log-123',
      duration_ms: 1234,
      text_chars: 42,
      token: 'must-not-appear',
    });

    expect(info).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(info.mock.calls[0][0]));
    expect(entry).toMatchObject({
      level: 'info',
      scope: 'ai-chat',
      event: 'request_completed',
      request_id: 'req-log-123',
      duration_ms: 1234,
      text_chars: 42,
      token: '[REDACTED]',
    });
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('accepts safe incoming request ids and replaces invalid values', () => {
    expect(getRequestId(new Request('http://localhost', {
      headers: { 'x-request-id': 'req-user-123_abc' },
    }))).toBe('req-user-123_abc');

    expect(getRequestId(new Request('http://localhost', {
      headers: { 'x-request-id': '<script>bad</script>' },
    }))).toMatch(/^[0-9a-f-]{36}$/);
  });
});
