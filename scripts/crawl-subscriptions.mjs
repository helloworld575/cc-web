#!/usr/bin/env node

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

const target = normalizeTarget(readArg('--target', process.env.SUBSCRIPTION_CRON_TARGET || 'http://127.0.0.1:3000'));
const loop = args.includes('--loop');
const intervalSeconds = Number(readArg('--interval-seconds', process.env.SUBSCRIPTION_CRON_INTERVAL_SECONDS || '86400'));
const startupRetries = Number(readArg('--startup-retries', process.env.SUBSCRIPTION_CRON_STARTUP_RETRIES || '10'));
const retrySeconds = Number(readArg('--retry-seconds', process.env.SUBSCRIPTION_CRON_RETRY_SECONDS || '30'));
const runOnStart = process.env.SUBSCRIPTION_CRON_RUN_ON_START !== '0';
const token = process.env.SUBSCRIPTION_CRON_SECRET || process.env.ADMIN_PASSWORD || '';

if (!token) {
  console.error('SUBSCRIPTION_CRON_SECRET or ADMIN_PASSWORD is required.');
  process.exit(1);
}

if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
  console.error('SUBSCRIPTION_CRON_INTERVAL_SECONDS must be a positive number.');
  process.exit(1);
}

if (!Number.isFinite(startupRetries) || startupRetries < 0 || !Number.isFinite(retrySeconds) || retrySeconds <= 0) {
  console.error('SUBSCRIPTION_CRON_STARTUP_RETRIES and SUBSCRIPTION_CRON_RETRY_SECONDS must be positive numbers.');
  process.exit(1);
}

async function crawlOnce() {
  const response = await fetch(`${target}/api/subscriptions/crawl`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Subscription crawl failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  console.log(`[${new Date().toISOString()}] Subscription crawl completed: ${text}`);
}

async function crawlWithStartupRetry() {
  for (let attempt = 0; attempt <= startupRetries; attempt += 1) {
    try {
      await crawlOnce();
      return;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ${error instanceof Error ? error.message : String(error)}`);
      if (attempt >= startupRetries) return;
      await sleep(retrySeconds * 1000);
    }
  }
}

if (!loop) {
  await crawlOnce();
  process.exit(0);
}

if (runOnStart) {
  await crawlWithStartupRetry();
}

while (true) {
  await sleep(intervalSeconds * 1000);
  try {
    await crawlOnce();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ${error instanceof Error ? error.message : String(error)}`);
  }
}
