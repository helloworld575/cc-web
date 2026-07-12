import { describe, expect, it } from 'vitest';
import { apiErrorTranslationKey, readSafeApiError } from '@/lib/client-api-error';

describe('readSafeApiError', () => {
  it('never returns HTML response bodies to the UI', async () => {
    const result = await readSafeApiError(new Response(
      '<!doctype html><html><body>proxy login</body></html>',
      { status: 502, headers: { 'Content-Type': 'text/html' } },
    ), 'Safe fallback');

    expect(result).toEqual({ code: null, message: 'Safe fallback' });
  });

  it('keeps bounded structured JSON errors', async () => {
    const result = await readSafeApiError(Response.json({
      code: 'AI_PROVIDER_FORBIDDEN',
      error: 'The configured API key cannot use this channel.',
    }, { status: 502 }), 'Safe fallback');

    expect(result).toEqual({
      code: 'AI_PROVIDER_FORBIDDEN',
      message: 'The configured API key cannot use this channel.',
    });
  });

  it('normalizes lowercase server error codes for client translation lookup', async () => {
    const result = await readSafeApiError(Response.json({
      code: 'upstream_forbidden',
      error: 'Image provider rejected the credentials or channel access.',
    }, { status: 502 }), 'Safe fallback');

    expect(result.code).toBe('UPSTREAM_FORBIDDEN');
  });

  it('replaces HTML-like or oversized JSON error strings', async () => {
    const result = await readSafeApiError(Response.json({
      code: 'UPSTREAM_INVALID_RESPONSE',
      error: `<html>${'x'.repeat(1000)}</html>`,
    }, { status: 502 }), 'Safe fallback');

    expect(result).toEqual({ code: 'UPSTREAM_INVALID_RESPONSE', message: 'Safe fallback' });
  });

  it('maps lowercase streaming timeout codes to the localized timeout message', () => {
    expect(apiErrorTranslationKey('upstream_first_token_timeout', 'apiErrorGeneric'))
      .toBe('apiErrorProviderTimeout');
    expect(apiErrorTranslationKey('upstream_stream_idle_timeout', 'apiErrorGeneric'))
      .toBe('apiErrorProviderTimeout');
  });
});
