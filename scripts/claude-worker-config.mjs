const DEFAULTS = {
  port: 8787,
  maxPromptChars: 20000,
  requestTimeoutMs: 8 * 60 * 1000,
  maxOutputBytes: 1024 * 1024,
  maxConcurrentRuns: 8,
};

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function getWorkerConfig(env = process.env) {
  const maxPromptChars = boundedInteger(env.CLAUDE_MAX_PROMPT_CHARS, DEFAULTS.maxPromptChars, 1, 100000);
  return {
    port: boundedInteger(env.CLAUDE_WORKER_PORT, DEFAULTS.port, 1, 65535),
    maxPromptChars,
    requestTimeoutMs: boundedInteger(env.CLAUDE_REQUEST_TIMEOUT_MS, DEFAULTS.requestTimeoutMs, 1000, 3600000),
    maxOutputBytes: boundedInteger(env.CLAUDE_MAX_OUTPUT_BYTES, DEFAULTS.maxOutputBytes, 1024, 16 * 1024 * 1024),
    maxConcurrentRuns: boundedInteger(env.CLAUDE_MAX_CONCURRENT_RUNS, DEFAULTS.maxConcurrentRuns, 1, 32),
    maxRequestBytes: boundedInteger(
      env.CLAUDE_MAX_REQUEST_BYTES,
      Math.max(64 * 1024, maxPromptChars * 4 + 8192),
      4096,
      2 * 1024 * 1024,
    ),
    shutdownGraceMs: boundedInteger(env.CLAUDE_SHUTDOWN_GRACE_MS, 5000, 250, 30000),
  };
}

export function getWorkerReadiness(env = process.env) {
  const hasToken = Boolean(String(env.CLAUDE_WORKER_TOKEN || '').trim());
  const hasApiKey = Boolean(String(env.CLAUDE_API_KEY || env.ANTHROPIC_API_KEY || '').trim());
  const missing = [];
  if (!hasToken) missing.push('CLAUDE_WORKER_TOKEN');
  if (!hasApiKey) missing.push('CLAUDE_API_KEY');
  return { ok: missing.length === 0, missing };
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
