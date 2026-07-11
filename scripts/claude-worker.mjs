import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';

const port = Number(process.env.CLAUDE_WORKER_PORT || 8787);
const workspaceRoot = path.resolve(process.env.CLAUDE_WORKSPACE_ROOT || '/workspaces');
const maxPromptChars = Number(process.env.CLAUDE_MAX_PROMPT_CHARS || 20000);
const requestTimeoutMs = Number(process.env.CLAUDE_REQUEST_TIMEOUT_MS || 600000);
const maxOutputBytes = Number(process.env.CLAUDE_MAX_OUTPUT_BYTES || 1024 * 1024);
const workerToken = process.env.CLAUDE_WORKER_TOKEN || '';
const WORKER_TOKEN_HEADER = 'X-Claude-Worker-Token';
const DEFAULT_PERSONAL_ASSISTANT_PROMPT = [
  '你是 ThomasLee 的个人助理。',
  '你的职责是用直接、清晰、可执行的文本帮助他处理日常事务、写作、代码分析、计划拆解和决策整理。',
  '默认使用中文回答，除非用户明确要求其他语言。',
  '不要输出 JSON 事件、工具调用日志或协议细节；面向用户只输出自然语言文本。',
  '在信息不足时先说明缺口，再给出最稳妥的下一步。',
].join('\n');

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxPromptChars + 4096) {
      throw new Error('Request body is too large');
    }
  }
  return JSON.parse(raw || '{}');
}

function resolveWorkspace(cwd) {
  const relative = typeof cwd === 'string' && cwd.trim() ? cwd.trim() : 'default';
  const resolved = path.resolve(workspaceRoot, relative);
  if (resolved !== workspaceRoot && !resolved.startsWith(`${workspaceRoot}${path.sep}`)) {
    throw new Error('cwd must stay inside the worker workspace root');
  }
  return resolved;
}

function buildClaudeEnv() {
  const env = { ...process.env };
  if (env.CLAUDE_API_KEY && !env.ANTHROPIC_API_KEY) {
    env.ANTHROPIC_API_KEY = env.CLAUDE_API_KEY;
  }
  if (env.CLAUDE_API_HOST && !env.ANTHROPIC_BASE_URL) {
    env.ANTHROPIC_BASE_URL = env.CLAUDE_API_HOST;
  }
  if (env.CLAUDE_MODEL && !env.ANTHROPIC_MODEL) {
    env.ANTHROPIC_MODEL = env.CLAUDE_MODEL;
  }
  return env;
}

function appendCsvOption(args, name, value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return;
  args.push(name, normalized);
}

function getSystemPrompt() {
  return process.env.CLAUDE_SYSTEM_PROMPT?.trim() || DEFAULT_PERSONAL_ASSISTANT_PROMPT;
}

function isAuthorized(req) {
  const provided = String(req.headers[WORKER_TOKEN_HEADER.toLowerCase()] || '');
  if (!workerToken || !provided) return false;
  const expectedBuffer = Buffer.from(workerToken);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

async function handleRun(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (caught) {
    json(res, 400, { error: caught?.message || 'Invalid JSON' });
    return;
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    json(res, 400, { error: 'Missing prompt' });
    return;
  }
  if (prompt.length > maxPromptChars) {
    json(res, 400, { error: `Prompt must be ${maxPromptChars} characters or fewer` });
    return;
  }

  let cwd;
  try {
    cwd = resolveWorkspace(body.cwd);
    await mkdir(cwd, { recursive: true });
  } catch (caught) {
    json(res, 400, { error: caught?.message || 'Invalid workspace' });
    return;
  }

  const args = [
    '-p',
    prompt,
    '--output-format',
    'text',
    '--append-system-prompt',
    getSystemPrompt(),
  ];
  if (process.env.CLAUDE_PERMISSION_MODE) {
    args.push('--permission-mode', process.env.CLAUDE_PERMISSION_MODE);
  }
  appendCsvOption(args, '--allowedTools', process.env.CLAUDE_ALLOWED_TOOLS);
  appendCsvOption(args, '--disallowedTools', process.env.CLAUDE_DISALLOWED_TOOLS);
  appendCsvOption(args, '--max-budget-usd', process.env.CLAUDE_MAX_BUDGET_USD);
  const child = spawn('claude', args, {
    cwd,
    env: buildClaudeEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, requestTimeoutMs);

  req.on('aborted', () => {
    child.kill('SIGTERM');
  });

  const stdout = [];
  const stderr = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let timedOut = false;
  let outputTooLarge = false;
  let finalized = false;

  child.stdout.on('data', chunk => {
    const buffer = Buffer.from(chunk);
    stdoutBytes += buffer.length;
    if (stdoutBytes > maxOutputBytes) {
      outputTooLarge = true;
      child.kill('SIGTERM');
      return;
    }
    stdout.push(buffer);
  });

  child.stderr.on('data', chunk => {
    if (stderrBytes >= 32 * 1024) return;
    const buffer = Buffer.from(chunk);
    stderrBytes += buffer.length;
    stderr.push(buffer.subarray(0, Math.max(0, 32 * 1024 - (stderrBytes - buffer.length))));
  });

  function finish(code, spawnError) {
    if (finalized) return;
    finalized = true;
    clearTimeout(timeout);
    const stderrText = Buffer.concat(stderr).toString('utf8').replace(/\s+/g, ' ').slice(0, 2000);
    if (stderrText) console.error('[claude-worker] claude stderr:', stderrText);
    if (spawnError) console.error('[claude-worker] spawn failed:', spawnError);

    if (timedOut) {
      json(res, 504, { code: 'CLAUDE_TIMEOUT', error: 'Claude request timed out.' });
      return;
    }
    if (outputTooLarge) {
      json(res, 502, { code: 'CLAUDE_OUTPUT_TOO_LARGE', error: 'Claude response exceeded the safe output limit.' });
      return;
    }
    if (spawnError || code !== 0) {
      json(res, 502, { code: 'CLAUDE_FAILED', error: 'Claude request failed. Check worker logs.' });
      return;
    }

    const output = Buffer.concat(stdout).toString('utf8');
    if (/<!doctype|<html|<body|<head/i.test(output)) {
      console.error('[claude-worker] rejected HTML-like Claude output');
      json(res, 502, { code: 'CLAUDE_INVALID_RESPONSE', error: 'Claude returned an invalid response.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': String(Buffer.byteLength(output)),
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(output);
  }

  child.on('error', error => finish(null, error));
  child.on('close', code => finish(code, null));
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/run') {
    if (!workerToken) {
      json(res, 503, { code: 'WORKER_NOT_CONFIGURED', error: 'Worker authentication is not configured.' });
      return;
    }
    if (!isAuthorized(req)) {
      json(res, 401, { code: 'UNAUTHORIZED', error: 'Unauthorized' });
      return;
    }
    await handleRun(req, res);
    return;
  }

  json(res, 404, { error: 'Not found' });
});

await mkdir(workspaceRoot, { recursive: true });
server.listen(port, '0.0.0.0', () => {
  console.log(`Claude Code worker listening on ${port}`);
});
