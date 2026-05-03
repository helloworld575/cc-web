import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const port = Number(process.env.CLAUDE_WORKER_PORT || 8787);
const workspaceRoot = path.resolve(process.env.CLAUDE_WORKSPACE_ROOT || '/workspaces');
const maxPromptChars = Number(process.env.CLAUDE_MAX_PROMPT_CHARS || 20000);
const requestTimeoutMs = Number(process.env.CLAUDE_REQUEST_TIMEOUT_MS || 600000);
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

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

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
    child.kill('SIGTERM');
  }, requestTimeoutMs);

  req.on('close', () => {
    if (!res.writableEnded) child.kill('SIGTERM');
  });

  child.stdout.on('data', chunk => {
    res.write(chunk);
  });

  child.stderr.on('data', chunk => {
    res.write(`\n[worker stderr]\n${chunk.toString('utf8')}`);
  });

  child.on('error', error => {
    clearTimeout(timeout);
    if (!res.writableEnded) {
      res.write(`\n[worker error] ${error.message}\n`);
      res.end();
    }
  });

  child.on('close', code => {
    clearTimeout(timeout);
    if (!res.writableEnded) {
      if (code !== 0) {
        res.write(`\n[worker exited with code ${code}]\n`);
      }
      res.end();
    }
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, {
      ok: true,
      workspaceRoot,
      role: process.env.CLAUDE_WORKER_ROLE || 'personal-assistant',
      model: process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL || null,
      hasApiKey: Boolean(process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/run') {
    await handleRun(req, res);
    return;
  }

  json(res, 404, { error: 'Not found' });
});

await mkdir(workspaceRoot, { recursive: true });
server.listen(port, '0.0.0.0', () => {
  console.log(`Claude Code worker listening on ${port}`);
});
