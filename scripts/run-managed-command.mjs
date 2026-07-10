#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn, spawnSync } from 'node:child_process';

function printUsage() {
  console.log(`Usage:
  node scripts/run-managed-command.mjs [options] -- <command> [args...]

Options:
  --label <name>         Log label. Default: managed-task
  --cwd <path>           Working directory for the child process
  --clear-port <port>    Kill any TCP listeners on this port before start and after exit
                         Repeat for multiple ports.
  --timeout-ms <ms>      Stop the child after the given timeout
  --help                 Show this help message

Examples:
  node scripts/run-managed-command.mjs --label vitest -- node ./node_modules/vitest/vitest.mjs run
  node scripts/run-managed-command.mjs --label next-dev --clear-port 3000 -- node ./node_modules/next/dist/bin/next dev
`);
}

function parseArgs(argv) {
  const parsed = {
    label: 'managed-task',
    cwd: process.cwd(),
    clearPorts: [],
    timeoutMs: null,
    command: [],
  };

  const separatorIndex = argv.indexOf('--');
  const optionArgs = separatorIndex === -1 ? argv : argv.slice(0, separatorIndex);
  parsed.command = separatorIndex === -1 ? [] : argv.slice(separatorIndex + 1);

  for (let index = 0; index < optionArgs.length; index += 1) {
    const arg = optionArgs[index];
    switch (arg) {
      case '--help':
        parsed.help = true;
        break;
      case '--label':
        parsed.label = optionArgs[index + 1] ?? parsed.label;
        index += 1;
        break;
      case '--cwd':
        parsed.cwd = optionArgs[index + 1] ? path.resolve(optionArgs[index + 1]) : parsed.cwd;
        index += 1;
        break;
      case '--clear-port': {
        const value = optionArgs[index + 1];
        if (!value || Number.isNaN(Number(value))) {
          throw new Error(`Invalid --clear-port value: ${value ?? '<missing>'}`);
        }
        parsed.clearPorts.push(Number(value));
        index += 1;
        break;
      }
      case '--timeout-ms': {
        const value = optionArgs[index + 1];
        if (!value || Number.isNaN(Number(value)) || Number(value) <= 0) {
          throw new Error(`Invalid --timeout-ms value: ${value ?? '<missing>'}`);
        }
        parsed.timeoutMs = Number(value);
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'managed-task';
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/:/g, '-').replace(/\..+/, '');
}

function timestampForLog(date = new Date()) {
  return date.toISOString();
}

function createLogger(label) {
  const logDir = path.join(process.cwd(), 'log', 'automation');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${timestampForFile()}-${slugify(label)}.log`);
  const stream = fs.createWriteStream(logPath, { flags: 'a' });

  const write = (level, message) => {
    const line = `[${timestampForLog()}] [${label}] [${level}] ${message}`;
    const target = level === 'ERROR' || level === 'WARN' ? process.stderr : process.stdout;
    target.write(`${line}\n`);
    stream.write(`${line}\n`);
  };

  const close = async () => {
    await new Promise((resolve) => stream.end(resolve));
  };

  return { logPath, write, close };
}

function resolveCommand(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (/[\\/]/.test(command) || path.extname(command)) {
    return command;
  }

  const pathext = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((value) => value.toLowerCase());

  if (pathext.includes('.cmd') && (command === 'npm' || command === 'npx')) {
    return `${command}.cmd`;
  }

  return command;
}

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function getListeningPidsWindows(port) {
  const result = runCommand('netstat', ['-ano', '-p', 'tcp']);
  if (result.error) {
    throw result.error;
  }

  const pids = new Set();
  for (const rawLine of result.stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes('LISTENING')) {
      continue;
    }
    const columns = line.split(/\s+/);
    if (columns.length < 5) {
      continue;
    }
    const localAddress = columns[1];
    const pid = Number(columns[4]);
    if (localAddress.endsWith(`:${port}`) && Number.isInteger(pid)) {
      pids.add(pid);
    }
  }
  return [...pids];
}

function getListeningPidsUnix(port) {
  const lsofResult = runCommand('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
  if (lsofResult.status === 0) {
    return [...new Set(lsofResult.stdout.split(/\r?\n/).map((value) => Number(value.trim())).filter(Number.isInteger))];
  }

  const ssResult = runCommand('ss', ['-ltnp', `sport = :${port}`]);
  if (ssResult.status !== 0) {
    return [];
  }

  const pids = new Set();
  for (const line of ssResult.stdout.split(/\r?\n/)) {
    const match = line.match(/pid=(\d+)/);
    if (match) {
      pids.add(Number(match[1]));
    }
  }
  return [...pids];
}

function getListeningPids(port) {
  return process.platform === 'win32'
    ? getListeningPidsWindows(port)
    : getListeningPidsUnix(port);
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function killPid(pid, logger) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return;
  }

  if (!isPidAlive(pid)) {
    return;
  }

  logger.write('WARN', `Stopping PID ${pid}`);

  if (process.platform === 'win32') {
    runCommand('taskkill', ['/PID', String(pid), '/T', '/F']);
    await sleep(250);
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }

  await sleep(500);
  if (isPidAlive(pid)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Ignore race with already-exited processes.
    }
  }
}

async function clearPorts(ports, logger, phase) {
  for (const port of ports) {
    const pids = getListeningPids(port).filter((pid) => pid !== process.pid);
    if (pids.length === 0) {
      logger.write('INFO', `Port ${port} is clear during ${phase}`);
      continue;
    }
    logger.write('WARN', `Port ${port} has listeners during ${phase}: ${pids.join(', ')}`);
    for (const pid of pids) {
      await killPid(pid, logger);
    }
    await sleep(250);
    const remaining = getListeningPids(port).filter((pid) => pid !== process.pid);
    if (remaining.length > 0) {
      throw new Error(`Port ${port} is still occupied after cleanup: ${remaining.join(', ')}`);
    }
    logger.write('INFO', `Port ${port} cleared during ${phase}`);
  }
}

async function terminateChild(child, logger) {
  if (!child?.pid || child.exitCode !== null) {
    return;
  }

  logger.write('WARN', `Stopping child PID ${child.pid}`);

  if (process.platform === 'win32') {
    runCommand('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      process.kill(child.pid, 'SIGTERM');
    } catch {
      return;
    }
  }

  await sleep(500);
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch {
        // Ignore race with already-exited processes.
      }
    }
  }
}

function pipeChildStream(stream, logger, level) {
  const reader = readline.createInterface({ input: stream });
  reader.on('line', (line) => {
    logger.write(level, line);
  });
  return reader;
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    printUsage();
    process.exit(1);
  }

  if (parsed.help) {
    printUsage();
    return;
  }

  if (parsed.command.length === 0) {
    printUsage();
    process.exit(1);
  }

  const logger = createLogger(parsed.label);
  let child;
  let timeoutHandle;
  let cleanupPromise;
  let timedOut = false;
  let signalExitCode = null;

  const cleanup = async (reason) => {
    if (cleanupPromise) {
      return cleanupPromise;
    }

    cleanupPromise = (async () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      logger.write('INFO', `Cleanup starting (${reason})`);
      if (child) {
        await terminateChild(child, logger);
      }
      if (parsed.clearPorts.length > 0) {
        await clearPorts(parsed.clearPorts, logger, `cleanup:${reason}`);
      }
      logger.write('INFO', `Cleanup finished (${reason})`);
    })();

    return cleanupPromise;
  };

  const handleSignal = async (signal, exitCode) => {
    signalExitCode = exitCode;
    logger.write('WARN', `Received ${signal}`);
    try {
      await cleanup(signal);
    } finally {
      await logger.close();
      process.exit(exitCode);
    }
  };

  process.on('SIGINT', () => {
    void handleSignal('SIGINT', 130);
  });
  process.on('SIGTERM', () => {
    void handleSignal('SIGTERM', 143);
  });

  try {
    logger.write('INFO', `Managed log file: ${path.relative(process.cwd(), logger.logPath)}`);
    logger.write('INFO', `Working directory: ${parsed.cwd}`);
    logger.write('INFO', `Command: ${parsed.command.join(' ')}`);

    if (parsed.clearPorts.length > 0) {
      await clearPorts(parsed.clearPorts, logger, 'preflight');
    }

    const resolvedCommand = resolveCommand(parsed.command[0]);
    if (resolvedCommand !== parsed.command[0]) {
      logger.write('INFO', `Resolved executable: ${resolvedCommand}`);
    }
    const childEnv = { ...process.env };
    if (parsed.command.some(part => part.toLowerCase().includes('playwright'))) {
      delete childEnv.NO_COLOR;
    }
    child = spawn(resolvedCommand, parsed.command.slice(1), {
      argv0: parsed.command[0],
      cwd: parsed.cwd,
      env: childEnv,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
      detached: process.platform !== 'win32',
    });

    const stdoutReader = pipeChildStream(child.stdout, logger, 'STDOUT');
    const stderrReader = pipeChildStream(child.stderr, logger, 'STDERR');

    if (parsed.timeoutMs) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        logger.write('WARN', `Timeout reached after ${parsed.timeoutMs}ms`);
        void cleanup('timeout');
      }, parsed.timeoutMs);
    }

    const result = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code, signal) => resolve({ code, signal }));
    });

    stdoutReader.close();
    stderrReader.close();

    await cleanup('child-exit');

    if (signalExitCode !== null) {
      process.exitCode = signalExitCode;
    } else if (timedOut) {
      process.exitCode = 124;
    } else {
      process.exitCode = result.code ?? 1;
    }

    logger.write(
      process.exitCode === 0 ? 'INFO' : 'WARN',
      `Managed command finished with exit code ${process.exitCode}`
    );
  } finally {
    await logger.close();
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
