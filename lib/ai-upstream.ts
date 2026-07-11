export interface SafeUpstreamError {
  code: string;
  error: string;
  retryable?: boolean;
}

export interface UpstreamFailure {
  payload: SafeUpstreamError;
  logDetail: string;
}

const MAX_ERROR_BODY_BYTES = 64 * 1024;

function errorMessage(label: string, suffix: string) {
  return `${label} ${suffix}`;
}

function extractJsonError(value: any): string {
  const candidates = [
    value?.error?.message,
    value?.error,
    value?.message,
    value?.detail,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 500);
    }
  }
  return '';
}

function looksLikeHtml(contentType: string, text: string) {
  return contentType.toLowerCase().includes('text/html')
    || /^\s*<!doctype html/i.test(text)
    || /^\s*<html[\s>]/i.test(text);
}

export function upstreamStatusError(status: number, label = 'AI provider'): SafeUpstreamError {
  if (status === 401) {
    return {
      code: 'upstream_unauthorized',
      error: errorMessage(label, 'rejected the credentials.'),
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      code: 'upstream_forbidden',
      error: errorMessage(label, 'rejected the credentials or channel access.'),
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      code: 'upstream_not_found',
      error: errorMessage(label, 'rejected the request.'),
      retryable: false,
    };
  }
  if (status === 408 || status === 429) {
    return {
      code: status === 429 ? 'upstream_rate_limited' : 'upstream_timeout',
      error: status === 429
        ? errorMessage(label, 'is rate limited. Try again later.')
        : errorMessage(label, 'request timed out.'),
      retryable: true,
    };
  }
  if (status >= 500) {
    return upstreamUnavailableError(label);
  }
  return {
    code: 'upstream_rejected',
    error: errorMessage(label, 'rejected the request.'),
    retryable: false,
  };
}

export function upstreamUnavailableError(label = 'AI provider'): SafeUpstreamError {
  const target = label === 'AI provider' ? label : label.toLowerCase();
  return {
    code: 'upstream_unavailable',
    error: `Unable to reach ${target}.`,
    retryable: true,
  };
}

export function upstreamTimeoutError(label = 'AI provider'): SafeUpstreamError {
  return {
    code: 'upstream_timeout',
    error: errorMessage(label, 'request timed out.'),
    retryable: true,
  };
}

export function upstreamInvalidResponseError(label = 'AI provider'): SafeUpstreamError {
  return {
    code: 'upstream_invalid_response',
    error: errorMessage(label, 'returned an invalid response.'),
    retryable: true,
  };
}

export function upstreamEmptyResponseError(label = 'AI provider'): SafeUpstreamError {
  return {
    code: 'upstream_empty_response',
    error: errorMessage(label, 'returned an empty response.'),
    retryable: true,
  };
}

export function upstreamResponseTooLargeError(label = 'AI provider'): SafeUpstreamError {
  return {
    code: 'upstream_response_too_large',
    error: errorMessage(label, 'response exceeded the allowed size.'),
    retryable: true,
  };
}

export function safeUpstreamResponse(payload: SafeUpstreamError, status = 502) {
  return Response.json(payload, { status });
}

export function safeFetchError(caught: unknown, label = 'AI provider'): SafeUpstreamError {
  const errorLike = caught as { name?: string };
  return errorLike?.name === 'AbortError' || errorLike?.name === 'TimeoutError'
    ? upstreamTimeoutError(label)
    : upstreamUnavailableError(label);
}

export async function readBoundedResponseText(
  response: Response,
  maxBytes = MAX_ERROR_BODY_BYTES,
) {
  if (!response.body) {
    return { text: '', empty: true, tooLarge: false };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { text: '', empty: false, tooLarge: true };
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return { text, empty: text.length === 0, tooLarge: false };
}

export async function readUpstreamFailure(
  response: Response,
  label = 'AI provider',
): Promise<UpstreamFailure> {
  const contentType = response.headers.get('content-type') || '';
  const body = await readBoundedResponseText(response);
  let logDetail = `status=${response.status}`;
  if (body.tooLarge) {
    logDetail += ' body=too-large';
  } else if (body.empty) {
    logDetail += ' body=empty';
  } else if (looksLikeHtml(contentType, body.text)) {
    logDetail += ' body=html-omitted';
  } else if (contentType.includes('application/json')) {
    try {
      const message = extractJsonError(JSON.parse(body.text));
      if (message) logDetail += ` message=${message}`;
    } catch {
      logDetail += ' body=invalid-json';
    }
  } else {
    logDetail += ' body=non-json-omitted';
  }
  return { payload: upstreamStatusError(response.status, label), logDetail };
}

export async function readUpstreamJson(
  response: Response,
  label = 'AI provider',
  maxBytes = MAX_ERROR_BODY_BYTES,
): Promise<{ ok: true; data: any } | { ok: false; failure: UpstreamFailure }> {
  const contentType = response.headers.get('content-type') || '';
  const body = await readBoundedResponseText(response, maxBytes);
  if (body.tooLarge) {
    return {
      ok: false,
      failure: { payload: upstreamResponseTooLargeError(label), logDetail: 'body=too-large' },
    };
  }
  if (body.empty) {
    return {
      ok: false,
      failure: { payload: upstreamEmptyResponseError(label), logDetail: 'body=empty' },
    };
  }
  if (!contentType.includes('application/json') || looksLikeHtml(contentType, body.text)) {
    return {
      ok: false,
      failure: { payload: upstreamInvalidResponseError(label), logDetail: 'body=invalid-content-type' },
    };
  }
  try {
    return { ok: true, data: JSON.parse(body.text) };
  } catch {
    return {
      ok: false,
      failure: { payload: upstreamInvalidResponseError(label), logDetail: 'body=invalid-json' },
    };
  }
}

export async function validateUpstreamSse(response: Response, label = 'AI provider') {
  const contentType = response.headers.get('content-type') || '';
  if (!response.body) {
    return { ok: false as const, payload: upstreamEmptyResponseError(label) };
  }
  if (!contentType.toLowerCase().includes('text/event-stream')) {
    await readBoundedResponseText(response).catch(() => undefined);
    return { ok: false as const, payload: upstreamInvalidResponseError(label) };
  }
  return { ok: true as const, body: response.body };
}

export function timeoutSignal(milliseconds: number) {
  return AbortSignal.timeout(milliseconds);
}
