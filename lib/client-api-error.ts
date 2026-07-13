import type { TranslationKey } from '@/lib/i18n';

const MAX_ERROR_CHARS = 240;
const HTML_MARKER = /<!doctype|<html|<head|<body|<script|<style/i;

export interface SafeApiError {
  code: string | null;
  message: string;
}

function safeCode(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(value)
    ? value.toUpperCase()
    : null;
}

function safeMessage(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > MAX_ERROR_CHARS || HTML_MARKER.test(normalized)) {
    return fallback;
  }
  return normalized;
}

export async function readSafeApiError(response: Response, fallback: string): Promise<SafeApiError> {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('application/json')) {
    return { code: null, message: fallback };
  }

  try {
    const data = await response.json() as { code?: unknown; error?: unknown };
    return {
      code: safeCode(data.code),
      message: safeMessage(data.error, fallback),
    };
  } catch {
    return { code: null, message: fallback };
  }
}

export function apiErrorTranslationKey(code: string | null, fallback: TranslationKey): TranslationKey {
  const normalizedCode = code?.toUpperCase() || '';
  if (!normalizedCode) return fallback;
  if (normalizedCode === 'UNAUTHORIZED') return 'apiErrorUnauthorized';
  if (normalizedCode === 'RATE_LIMITED') return 'apiErrorRateLimited';
  if (normalizedCode === 'PROVIDER_NOT_CONFIGURED') return 'apiErrorProviderNotConfigured';
  if (normalizedCode.includes('IMAGE') && (normalizedCode.includes('FORBIDDEN') || normalizedCode.includes('PERMISSION'))) {
    return 'apiErrorImagePermission';
  }
  if (normalizedCode.includes('FORBIDDEN') || normalizedCode.includes('UNAUTHORIZED')) return 'apiErrorProviderForbidden';
  if (normalizedCode.includes('INVALID_RESPONSE') || normalizedCode.includes('EMPTY_RESPONSE')) return 'apiErrorProviderInvalidResponse';
  if (normalizedCode.startsWith('CLAUDE_WORKER') || normalizedCode.startsWith('CLAUDE_')) return 'apiErrorWorkerFailed';
  if (normalizedCode.includes('TIMEOUT')) return 'apiErrorProviderTimeout';
  if (normalizedCode.includes('UNAVAILABLE') || normalizedCode.includes('NETWORK')) return 'apiErrorProviderUnavailable';
  return fallback;
}
