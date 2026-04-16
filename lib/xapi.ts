/**
 * X/Twitter OAuth 1.0a signature helper + posting.
 * Twitter API v2 tweet creation requires OAuth 1.0a User Context.
 * Media upload uses v1.1 media/upload endpoint (multipart/form-data).
 */
import crypto from 'crypto';

interface OAuthParams {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

export function buildOAuthHeader(
  method: string,
  url: string,
  params: OAuthParams,
  bodyParams: Record<string, string> = {},
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_token: params.accessToken,
    oauth_version: '1.0',
  };

  const allParams: Record<string, string> = { ...oauthParams, ...bodyParams };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map(k => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(params.consumerSecret)}&${percentEncode(params.accessTokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  oauthParams['oauth_signature'] = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

function getOAuthParams(): OAuthParams | { error: string } {
  const consumerKey = process.env.X_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.X_CONSUMER_SECRET?.trim();
  const accessToken = process.env.X_ACCESS_TOKEN?.trim();
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET?.trim();

  if (!consumerKey || !consumerSecret) {
    return { error: 'X_CONSUMER_KEY or X_CONSUMER_SECRET not configured' };
  }
  if (!accessToken || !accessTokenSecret) {
    return { error: 'X_ACCESS_TOKEN or X_ACCESS_TOKEN_SECRET not configured' };
  }
  return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
}

// ─── Media Upload (v1.1) ────────────────────────────────────────────────────
// Twitter requires media upload via v1.1 endpoint before attaching to v2 tweets.
// For images < 5MB: simple upload. For larger: chunked (INIT/APPEND/FINALIZE).

export async function uploadMedia(imageData: Buffer, mimeType: string): Promise<{ media_id_string: string } | { error: string }> {
  const params = getOAuthParams();
  if ('error' in params) return params;

  const sizeInMB = imageData.length / (1024 * 1024);

  if (sizeInMB > 15) {
    return { error: `Image too large: ${sizeInMB.toFixed(1)}MB (max 15MB)` };
  }

  // Use chunked upload for images > 3MB, simple for smaller
  if (sizeInMB > 3) {
    return chunkedUpload(imageData, mimeType, params);
  }
  return simpleUpload(imageData, mimeType, params);
}

async function simpleUpload(imageData: Buffer, mimeType: string, params: OAuthParams): Promise<{ media_id_string: string } | { error: string }> {
  const url = 'https://upload.twitter.com/1.1/media/upload.json';

  // For simple upload with multipart/form-data, OAuth signature is computed
  // WITHOUT the multipart body params (only OAuth params are signed).
  const authHeader = buildOAuthHeader('POST', url, params);

  // Use native FormData — it properly encodes binary data and sets the boundary header
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageData)], { type: mimeType });
  formData.append('media', blob, 'image');
  formData.append('media_category', 'tweet_image');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      // Don't set Content-Type — fetch will set it with the correct boundary
    },
    body: formData,
    signal: AbortSignal.timeout(60000),
  });

  // Safely read response — Twitter sometimes returns empty body or HTML on errors
  const rawText = await res.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    // Not JSON — use the raw text as error
    if (!res.ok) {
      return { error: `HTTP ${res.status}: ${rawText.slice(0, 200) || 'empty response'}` };
    }
  }

  if (!res.ok) {
    console.error(`[X media upload] HTTP ${res.status}:`, rawText.slice(0, 500));
    const errMsg = data.errors?.[0]?.message
      || data.error
      || (rawText && rawText !== '{}' ? rawText.slice(0, 300) : null)
      || `HTTP ${res.status} — Check your X app permissions: go to developer.x.com → Your App → Settings → App permissions must be "Read and Write". Also ensure "Elevated" access under User authentication settings.`;
    return { error: errMsg };
  }

  if (!data.media_id_string) {
    return { error: `Upload succeeded but no media_id returned: ${rawText.slice(0, 200)}` };
  }

  return { media_id_string: data.media_id_string };
}

async function chunkedUpload(imageData: Buffer, mimeType: string, params: OAuthParams): Promise<{ media_id_string: string } | { error: string }> {
  const url = 'https://upload.twitter.com/1.1/media/upload.json';

  // Helper to safely parse a response that might have empty/non-JSON body
  async function safeJson(res: Response): Promise<{ data: any; rawText: string }> {
    const rawText = await res.text();
    try {
      return { data: rawText ? JSON.parse(rawText) : {}, rawText };
    } catch {
      return { data: {}, rawText };
    }
  }

  // INIT — uses application/x-www-form-urlencoded so params ARE signed
  const initParams = {
    command: 'INIT',
    total_bytes: imageData.length.toString(),
    media_type: mimeType,
    media_category: 'tweet_image',
  };
  const initAuth = buildOAuthHeader('POST', url, params, initParams);

  const initRes = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': initAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(initParams).toString(),
    signal: AbortSignal.timeout(30000),
  });

  const { data: initData, rawText: initRaw } = await safeJson(initRes);
  if (!initRes.ok) {
    return { error: `INIT failed: ${initData.errors?.[0]?.message || initData.error || initRaw.slice(0, 200) || `HTTP ${initRes.status}`}` };
  }
  const mediaId = initData.media_id_string;
  if (!mediaId) {
    return { error: `INIT succeeded but no media_id: ${initRaw.slice(0, 200)}` };
  }

  // APPEND (in 4MB chunks) — multipart/form-data, OAuth signs only OAuth params
  const chunkSize = 4 * 1024 * 1024;
  for (let i = 0; i * chunkSize < imageData.length; i++) {
    const chunk = imageData.subarray(i * chunkSize, (i + 1) * chunkSize);
    const appendAuth = buildOAuthHeader('POST', url, params);

    const formData = new FormData();
    formData.append('command', 'APPEND');
    formData.append('media_id', mediaId);
    formData.append('segment_index', i.toString());
    formData.append('media', new Blob([new Uint8Array(chunk)], { type: mimeType }), 'chunk');

    const appendRes = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': appendAuth },
      body: formData,
      signal: AbortSignal.timeout(120000),
    });

    if (!appendRes.ok) {
      const { data: err, rawText } = await safeJson(appendRes);
      return { error: `APPEND chunk ${i} failed: ${err.errors?.[0]?.message || rawText.slice(0, 200) || `HTTP ${appendRes.status}`}` };
    }
  }

  // FINALIZE
  const finalParams = { command: 'FINALIZE', media_id: mediaId };
  const finalAuth = buildOAuthHeader('POST', url, params, finalParams);

  const finalRes = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': finalAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(finalParams).toString(),
    signal: AbortSignal.timeout(30000),
  });

  const { data: finalData, rawText: finalRaw } = await safeJson(finalRes);
  if (!finalRes.ok) {
    return { error: `FINALIZE failed: ${finalData.errors?.[0]?.message || finalRaw.slice(0, 200) || `HTTP ${finalRes.status}`}` };
  }

  return { media_id_string: mediaId };
}

// ─── Post Tweet (with optional media) ───────────────────────────────────────

export async function postTweet(
  text: string,
  mediaIds?: string[],
): Promise<{ id: string; text: string } | { error: string }> {
  const params = getOAuthParams();
  if ('error' in params) return params;

  const url = 'https://api.x.com/2/tweets';
  const bodyObj: any = { text };
  if (mediaIds && mediaIds.length > 0) {
    bodyObj.media = { media_ids: mediaIds };
  }

  const authHeader = buildOAuthHeader('POST', url, params);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj),
  });

  const data = await res.json();
  if (!res.ok) {
    return { error: data.detail || data.title || JSON.stringify(data) };
  }
  return data.data;
}

export async function postThread(
  tweets: { text: string; mediaIds?: string[] }[] | string[],
): Promise<{ results: any[]; errors: string[] }> {
  const results: any[] = [];
  const errors: string[] = [];
  let replyToId: string | undefined;

  const params = getOAuthParams();
  if ('error' in params) return { results: [], errors: [params.error] };

  for (const item of tweets) {
    const text = typeof item === 'string' ? item : item.text;
    const mediaIds = typeof item === 'string' ? undefined : item.mediaIds;

    const url = 'https://api.x.com/2/tweets';
    const bodyObj: any = { text };
    if (replyToId) bodyObj.reply = { in_reply_to_tweet_id: replyToId };
    if (mediaIds && mediaIds.length > 0) bodyObj.media = { media_ids: mediaIds };

    const authHeader = buildOAuthHeader('POST', url, params);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
    });

    const data = await res.json();
    if (!res.ok) {
      errors.push(data.detail || data.title || JSON.stringify(data));
      break;
    }
    results.push(data.data);
    replyToId = data.data.id;
  }

  return { results, errors };
}
