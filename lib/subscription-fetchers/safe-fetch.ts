import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface PublicHttpFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
}

function stripIpv6Brackets(hostname: string) {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function parseIpv4(address: string) {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const bytes = parts.map(part => Number(part));
  if (bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) return null;
  return bytes;
}

function isBlockedIpv4(address: string) {
  const bytes = parseIpv4(address);
  if (!bytes) return true;
  const [a, b] = bytes;

  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function parseIpv6(address: string) {
  let normalized = address.toLowerCase().split('%')[0];
  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    const ipv4 = parseIpv4(normalized.slice(lastColon + 1));
    if (!ipv4) return null;
    normalized = `${normalized.slice(0, lastColon)}:${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }

  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const omitted = 8 - left.length - right.length;
  if ((halves.length === 1 && omitted !== 0) || omitted < 0) return null;

  const groups = halves.length === 2
    ? [...left, ...Array(omitted).fill('0'), ...right]
    : left;
  if (groups.length !== 8) return null;

  const values = groups.map(group => Number.parseInt(group, 16));
  if (values.some((value, index) => !/^[0-9a-f]{1,4}$/i.test(groups[index]) || value < 0 || value > 0xffff)) {
    return null;
  }

  return values.flatMap(value => [value >> 8, value & 0xff]);
}

function isBlockedIpv6(address: string) {
  const bytes = parseIpv6(address);
  if (!bytes) return true;

  const isUnspecified = bytes.every(byte => byte === 0);
  const isLoopback = bytes.slice(0, 15).every(byte => byte === 0) && bytes[15] === 1;
  const isUniqueLocal = (bytes[0] & 0xfe) === 0xfc;
  const isLinkLocal = bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80;
  const isSiteLocal = bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0;
  const isMulticast = bytes[0] === 0xff;
  const isDocumentation = bytes[0] === 0x20
    && bytes[1] === 0x01
    && bytes[2] === 0x0d
    && bytes[3] === 0xb8;
  const isDeprecated6to4 = bytes[0] === 0x20 && bytes[1] === 0x02;
  if (isUnspecified || isLoopback || isUniqueLocal || isLinkLocal || isSiteLocal || isMulticast || isDocumentation || isDeprecated6to4) {
    return true;
  }

  const isIpv4Mapped = bytes.slice(0, 10).every(byte => byte === 0)
    && bytes[10] === 0xff
    && bytes[11] === 0xff;
  const isIpv4Compatible = bytes.slice(0, 12).every(byte => byte === 0);
  if (isIpv4Mapped || isIpv4Compatible) {
    return isBlockedIpv4(bytes.slice(12).join('.'));
  }

  return false;
}

function isBlockedIp(address: string) {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

export async function validatePublicHttpUrl(value: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Subscription URL must use http or https');
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Subscription URL must use http or https');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Subscription URL must use http or https');
  }
  if (url.username || url.password) {
    throw new Error('Subscription URL host is not allowed');
  }

  const hostname = stripIpv6Brackets(url.hostname).toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Subscription URL host is not allowed');
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error('Subscription URL host is not allowed');
    return url.href;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Subscription URL host could not be resolved');
  }
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some(result => isBlockedIp(result.address))) {
    throw new Error('Subscription URL host is not allowed');
  }

  return url.href;
}

function createRequestSignal(source: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Subscription request timed out')), timeoutMs);
  const abortFromSource = () => controller.abort(source?.reason);
  if (source?.aborted) abortFromSource();
  else source?.addEventListener('abort', abortFromSource, { once: true });

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      source?.removeEventListener('abort', abortFromSource);
    },
  };
}

async function readBoundedBody(response: Response, maxResponseBytes: number) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
    await response.body?.cancel();
    throw new Error('Subscription response body is too large');
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxResponseBytes) {
      await reader.cancel();
      throw new Error('Subscription response body is too large');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function fetchPublicHttp(input: string | URL, options: PublicHttpFetchOptions = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    signal: sourceSignal,
    ...requestInit
  } = options;
  let currentUrl = typeof input === 'string' ? input : input.href;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    currentUrl = await validatePublicHttpUrl(currentUrl);
    const requestSignal = createRequestSignal(sourceSignal, timeoutMs);
    try {
      const response = await fetch(currentUrl, {
        ...requestInit,
        redirect: 'manual',
        signal: requestSignal.signal,
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location) throw new Error('Subscription redirect is missing a location');
        if (redirectCount === maxRedirects) throw new Error('Subscription request has too many redirects');
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      const body = await readBoundedBody(response, maxResponseBytes);
      return new Response(body.byteLength > 0 ? body : null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      requestSignal.cleanup();
    }
  }

  throw new Error('Subscription request has too many redirects');
}
