#!/usr/bin/env node
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
}

function normalizeTarget(value) {
  return value.replace(/\/+$/, '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logEvent(level, event, fields = {}) {
  console[level](JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope: 'subscription-cron',
    event,
    ...fields,
  }));
}

function summarizeError(error) {
  return {
    error_name: error instanceof Error ? error.name : 'Error',
    error_code: typeof error?.code === 'string' ? error.code : undefined,
    error_message: error instanceof Error
      ? error.message.replace(/\s+/g, ' ').slice(0, 240)
      : String(error).replace(/\s+/g, ' ').slice(0, 240),
  };
}

const target = normalizeTarget(readArg('--target', process.env.SUBSCRIPTION_CRON_TARGET || 'http://127.0.0.1:3000'));
const loop = args.includes('--loop');
const intervalSeconds = Number(readArg('--interval-seconds', process.env.SUBSCRIPTION_CRON_INTERVAL_SECONDS || '86400'));
const startupRetries = Number(readArg('--startup-retries', process.env.SUBSCRIPTION_CRON_STARTUP_RETRIES || '10'));
const retrySeconds = Number(readArg('--retry-seconds', process.env.SUBSCRIPTION_CRON_RETRY_SECONDS || '30'));
const runOnStart = process.env.SUBSCRIPTION_CRON_RUN_ON_START !== '0';
const token = process.env.SUBSCRIPTION_CRON_SECRET || process.env.ADMIN_PASSWORD || '';

if (!token) {
  logEvent('error', 'configuration_invalid', { error_code: 'TOKEN_MISSING' });
  process.exit(1);
}

if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
  logEvent('error', 'configuration_invalid', { error_code: 'INTERVAL_INVALID' });
  process.exit(1);
}

if (!Number.isFinite(startupRetries) || startupRetries < 0 || !Number.isFinite(retrySeconds) || retrySeconds <= 0) {
  logEvent('error', 'configuration_invalid', { error_code: 'RETRY_CONFIG_INVALID' });
  process.exit(1);
}

async function crawlOnce() {
  const requestId = `subscription-cron-${randomUUID()}`;
  const startedAt = Date.now();
  logEvent('info', 'crawl_started', { request_id: requestId, target_host: new URL(target).host });
  const response = await fetch(`${target}/api/subscriptions/crawl`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: '{}',
  });
  const text = await response.text();
  if (!response.ok) {
    const failure = new Error(`Subscription crawl failed with HTTP ${response.status}`);
    failure.code = `HTTP_${response.status}`;
    throw failure;
  }
  const data = JSON.parse(text);
  const results = Array.isArray(data?.results) ? data.results : [];
  const successCount = results.filter(item => item?.success).length;
  logEvent('info', 'crawl_completed', {
    request_id: requestId,
    duration_ms: Date.now() - startedAt,
    source_count: Number(data?.total) || results.length,
    success_count: successCount,
    failure_count: results.length - successCount,
  });
}

async function crawlWithStartupRetry() {
  for (let attempt = 0; attempt <= startupRetries; attempt += 1) {
    try {
      await crawlOnce();
      return;
    } catch (error) {
      logEvent('warn', 'crawl_attempt_failed', {
        attempt: attempt + 1,
        max_attempts: startupRetries + 1,
        ...summarizeError(error),
      });
      if (attempt >= startupRetries) return;
      await sleep(retrySeconds * 1000);
    }
  }
}

if (!loop) {
  await crawlOnce();
  process.exit(0);
}

logEvent('info', 'scheduler_started', {
  interval_seconds: intervalSeconds,
  run_on_start: runOnStart,
  startup_retries: startupRetries,
});

if (runOnStart) {
  await crawlWithStartupRetry();
}

while (true) {
  await sleep(intervalSeconds * 1000);
  try {
    await crawlOnce();
  } catch (error) {
    logEvent('error', 'crawl_failed', summarizeError(error));
  }
}
