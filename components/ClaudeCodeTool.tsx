'use client';
import { useState } from 'react';

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
  const [prompt, setPrompt] = useState('帮我整理一下今天最应该优先处理的事情。');
  const [cwd, setCwd] = useState('default');
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  async function runClaudeCode() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setOutput('');
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) setOutput(current => `${current}${chunk}`);
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
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Personal Assistant</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">个人助理</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          通过 NAS 上的 Claude Code worker 进行纯文本沟通。默认身份是你的个人助理，网页不会展示底层 JSON 事件。
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">工作区</span>
            <input
              value={cwd}
              onChange={event => setCwd(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="default"
              disabled={running}
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">消息</span>
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
            {running ? '处理中...' : '发送给个人助理'}
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
              <h2 className="text-sm font-semibold text-slate-900">回复</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${running ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {running ? '生成中' : '空闲'}
              </span>
            </div>
            <pre className="min-h-80 whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">
              {output || '还没有回复。'}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
