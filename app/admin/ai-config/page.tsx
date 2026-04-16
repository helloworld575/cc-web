'use client';
import { useEffect, useState } from 'react';

interface Provider {
  id?: number;
  name: string;
  api_type: 'openai' | 'anthropic';
  api_url: string;
  api_key: string;
  model: string;
  system_prompt: string;
  max_tokens: number;
  is_default: number;
}

const EMPTY: Provider = {
  name: '', api_type: 'openai', api_url: '', api_key: '', model: '',
  system_prompt: '', max_tokens: 4096, is_default: 0,
};

export default function AdminAIConfigPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function loadProviders() {
    const res = await fetch('/api/ai-providers');
    if (res.ok) setProviders(await res.json());
  }

  useEffect(() => { loadProviders(); }, []);

  function startNew() { setEditing({ ...EMPTY }); setError(''); setTestResult(null); }
  function startEdit(p: Provider) { setEditing({ ...p }); setError(''); setTestResult(null); }

  async function save() {
    if (!editing) return;
    setError('');
    const isNew = !editing.id;
    const url = isNew ? '/api/ai-providers' : `/api/ai-providers/${editing.id}`;
    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return; }
    await loadProviders();
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function del(id: number) {
    if (!confirm('Delete this AI provider?')) return;
    await fetch(`/api/ai-providers/${id}`, { method: 'DELETE' });
    setProviders(providers.filter(p => p.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  async function testProvider() {
    if (!editing) return;
    setTesting(true);
    setTestResult(null);
    try {
      // For new providers, we need to save first
      if (!editing.id) {
        setTestResult({ ok: false, msg: 'Please save the provider first before testing.' });
        setTesting(false);
        return;
      }
      const res = await fetch('/api/ai-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: editing.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, msg: `${data.model}: ${data.text}` });
      } else {
        setTestResult({ ok: false, msg: data.error || 'Test failed' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message || 'Connection failed' });
    }
    setTesting(false);
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Admin — AI Providers</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-600 text-sm">Saved!</span>}
          <button onClick={startNew} className="bg-black text-white px-3 py-1 rounded text-sm">+ New Provider</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Provider list */}
        <div className="space-y-3">
          {providers.map(p => (
            <div key={p.id}
              className={`border rounded-lg px-4 py-3 cursor-pointer transition-colors ${editing?.id === p.id ? 'border-black bg-gray-50' : 'hover:border-gray-400'}`}
              onClick={() => startEdit(p)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{p.name}</span>
                  {p.is_default ? <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded">Default</span> : null}
                </div>
                <button onClick={e => { e.stopPropagation(); del(p.id!); }}
                  className="text-red-400 hover:text-red-600 text-xs">Delete</button>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="bg-gray-100 px-1 rounded font-mono">{p.api_type}</span>{' '}
                {p.model}
              </p>
              <p className="text-xs text-gray-300 font-mono truncate">{p.api_url}</p>
            </div>
          ))}
          {providers.length === 0 && <p className="text-gray-400 text-sm">No providers configured. Add one to start chatting.</p>}
        </div>

        {/* Editor */}
        {editing && (
          <div className="border rounded-lg px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="border rounded px-2 py-1 text-sm w-full" placeholder="My GPT-4" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">API Type</label>
                <select value={editing.api_type} onChange={e => setEditing({ ...editing, api_type: e.target.value as any })}
                  className="border rounded px-2 py-1 text-sm w-full">
                  <option value="openai">OpenAI Compatible</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">API URL (base URL)</label>
              <input value={editing.api_url} onChange={e => setEditing({ ...editing, api_url: e.target.value })}
                className="border rounded px-2 py-1 text-sm w-full font-mono"
                placeholder={editing.api_type === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com'} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">API Key</label>
              <input value={editing.api_key} onChange={e => setEditing({ ...editing, api_key: e.target.value })}
                type="password" className="border rounded px-2 py-1 text-sm w-full font-mono"
                placeholder="sk-..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Model</label>
                <input value={editing.model} onChange={e => setEditing({ ...editing, model: e.target.value })}
                  className="border rounded px-2 py-1 text-sm w-full font-mono"
                  placeholder={editing.api_type === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o'} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Max Tokens</label>
                <input type="number" value={editing.max_tokens}
                  onChange={e => setEditing({ ...editing, max_tokens: parseInt(e.target.value) || 4096 })}
                  className="border rounded px-2 py-1 text-sm w-full" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">System Prompt (optional)</label>
              <textarea value={editing.system_prompt} onChange={e => setEditing({ ...editing, system_prompt: e.target.value })}
                rows={4} className="border rounded px-2 py-1 text-sm w-full font-mono resize-y"
                placeholder="You are a helpful assistant..." />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Set as default</label>
              <input type="checkbox" checked={!!editing.is_default}
                onChange={e => setEditing({ ...editing, is_default: e.target.checked ? 1 : 0 })} />
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`text-xs p-2 rounded ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
              </div>
            )}

            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={save} className="bg-black text-white px-4 py-1 rounded text-sm">Save</button>
              <button onClick={testProvider} disabled={testing}
                className="border border-blue-500 text-blue-500 px-4 py-1 rounded text-sm hover:bg-blue-50 disabled:opacity-50">
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button onClick={() => { setEditing(null); setTestResult(null); }}
                className="text-sm text-gray-500">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
