#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import {
  getNextShanghaiRun,
  shouldRunOnStart,
} from './subscription-schedule.mjs';

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
const dailyHour = Number(readArg('--daily-hour', process.env.SUBSCRIPTION_DAILY_HOUR || '8'));
const startupRetries = Number(readArg('--startup-retries', process.env.SUBSCRIPTION_CRON_STARTUP_RETRIES || '10'));
const retrySeconds = Number(readArg('--retry-seconds', process.env.SUBSCRIPTION_CRON_RETRY_SECONDS || '30'));
const requestTimeoutMs = Number(readArg('--request-timeout-ms', process.env.SUBSCRIPTION_CRON_REQUEST_TIMEOUT_MS || '600000'));
const runOnStart = process.env.SUBSCRIPTION_CRON_RUN_ON_START !== '0';
const token = process.env.SUBSCRIPTION_CRON_SECRET || process.env.ADMIN_PASSWORD || '';

if (!token) {
  logEvent('error', 'configuration_invalid', { error_code: 'TOKEN_MISSING' });
  process.exit(1);
}

if (!Number.isInteger(dailyHour) || dailyHour < 0 || dailyHour > 23) {
  logEvent('error', 'configuration_invalid', { error_code: 'DAILY_HOUR_INVALID' });
  process.exit(1);
}

if (!Number.isFinite(startupRetries) || startupRetries < 0
  || !Number.isFinite(retrySeconds) || retrySeconds <= 0
  || !Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
  logEvent('error', 'configuration_invalid', { error_code: 'RETRY_CONFIG_INVALID' });
  process.exit(1);
}

async function publishOnce() {
  const requestId = `subscription-cron-${randomUUID()}`;
  const startedAt = Date.now();
  logEvent('info', 'publish_started', { request_id: requestId, target_host: new URL(target).host });
  const response = await fetch(`${target}/api/subscriptions/daily`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: '{}',
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    const failure = new Error(`Subscription daily publishing failed with HTTP ${response.status}`);
    failure.code = `HTTP_${response.status}`;
    throw failure;
  }
  const data = JSON.parse(text);
  const publications = Array.isArray(data?.publications) ? data.publications : [];
  logEvent('info', 'publish_completed', {
    request_id: requestId,
    duration_ms: Date.now() - startedAt,
    run_date: data?.run_date,
    status: data?.status,
    crawl_total: Number(data?.crawl?.total) || 0,
    crawl_success: Number(data?.crawl?.success) || 0,
    crawl_failed: Number(data?.crawl?.failed) || 0,
    ai_status: publications.find(item => item?.topic === 'ai')?.status,
    security_status: publications.find(item => item?.topic === 'security')?.status,
  });
  if (data?.status !== 'published') {
    const failure = new Error(`Subscription daily publishing ended with status ${String(data?.status || 'unknown')}`);
    failure.code = `DAILY_${String(data?.status || 'unknown').toUpperCase()}`;
    throw failure;
  }
}

async function publishWithRetry() {
  for (let attempt = 0; attempt <= startupRetries; attempt += 1) {
    try {
      await publishOnce();
      return;
    } catch (error) {
      logEvent('warn', 'publish_attempt_failed', {
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
  await publishOnce();
  process.exit(0);
}

logEvent('info', 'scheduler_started', {
  timezone: 'Asia/Shanghai',
  daily_hour: dailyHour,
  run_on_start: runOnStart,
  startup_retries: startupRetries,
});

if (runOnStart) {
  const startupTime = new Date();
  if (shouldRunOnStart(startupTime, dailyHour)) {
    await publishWithRetry();
  } else {
    logEvent('info', 'startup_run_skipped', {
      reason: 'before_daily_hour',
      daily_hour: dailyHour,
    });
  }
}

while (true) {
  const nextRun = getNextShanghaiRun(new Date(), dailyHour);
  logEvent('info', 'next_run_scheduled', { next_run: nextRun.toISOString() });
  await sleep(Math.max(0, nextRun.getTime() - Date.now()));
  await publishWithRetry();
}
