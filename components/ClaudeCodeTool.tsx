'use client';
import { useState } from 'react';

interface ClaudeEvent {
  type?: string;
  text?: string;
  result?: string;
  error?: string;
  code?: number;
}

function eventText(event: ClaudeEvent) {
  if (typeof event.result === 'string') return event.result;
  if (typeof event.text === 'string') return event.text;
  if (typeof event.error === 'string') return `Error: ${event.error}`;
  if (event.type === 'exit') return `\n[worker exited with code ${event.code ?? 'unknown'}]`;
  return '';
}

async function readErrorResponse(response: Response) {
  try {
    const data = await response.clone().json();
    if (typeof data?.error === 'string') return data.error;
  } catch {
    const text = await response.text().catch(() => '');
    if (text.trim()) return text.trim();
  }
  return `Request failed with HTTP ${response.status}`;
}

export default function ClaudeCodeTool() {
  const [prompt, setPrompt] = useState('Summarize what this workspace contains. Do not edit files.');
  const [cwd, setCwd] = useState('default');
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');

  async function runClaudeCode() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setOutput('');
    setRaw('');
    setError('');

    try {
      const response = await fetch('/api/claude-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, cwd }),
      });

      if (!response.ok) {
        setError(await readErrorResponse(response));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError('Claude Code stream is unavailable.');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          setRaw(current => `${current}${line}\n`);
          try {
            const parsed = JSON.parse(line) as ClaudeEvent;
            const text = eventText(parsed);
            if (text) setOutput(current => `${current}${text}`);
          } catch {
            setOutput(current => `${current}${line}\n`);
          }
        }
      }
    } catch (caught: unknown) {
      const errorLike = caught as { message?: string };
      setError(errorLike?.message || 'Failed to call Claude Code.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Claude Code</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Claude Code Worker</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Run Claude Code through the NAS worker. The browser talks only to this site; the worker receives the prompt on the internal Docker network.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</span>
            <input
              value={cwd}
              onChange={event => setCwd(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="default"
              disabled={running}
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Prompt</span>
            <textarea
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              className="min-h-48 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400"
              disabled={running}
            />
          </label>

          <button
            type="button"
            onClick={runClaudeCode}
            disabled={running || !prompt.trim()}
            className="mt-4 w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? 'Running...' : 'Run Claude Code'}
          </button>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Result</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${running ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {running ? 'Streaming' : 'Idle'}
              </span>
            </div>
            <pre className="min-h-80 whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">
              {output || 'No output yet.'}
            </pre>
          </div>

          <details className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Raw NDJSON</summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              {raw || 'No raw events yet.'}
            </pre>
          </details>
        </div>
      </section>
    </div>
  );
}
