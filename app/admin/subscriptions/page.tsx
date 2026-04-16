'use client';
import { useEffect, useState } from 'react';

interface Source {
  id?: number;
  name: string;
  url: string;
  category: string;
  enabled: number;
  fetch_interval: number;
  last_fetched_at?: string;
}

const EMPTY: Source = { name: '', url: '', category: 'other', enabled: 1, fetch_interval: 3600 };

const CATEGORIES = ['github', 'x', 'selfblog', 'rss', 'newsletter', 'reddit', 'other'];

export default function AdminSubscriptionsPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [editing, setEditing] = useState<Source | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [fetching, setFetching] = useState<number | null>(null);
  const [fetchMsg, setFetchMsg] = useState('');

  async function load() {
    const res = await fetch('/api/subscriptions');
    if (res.ok) setSources(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    setError('');
    const isNew = !editing.id;
    const res = await fetch(isNew ? '/api/subscriptions' : `/api/subscriptions/${editing.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return; }
    await load();
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function del(id: number) {
    if (!confirm('Delete this subscription?')) return;
    await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    setSources(sources.filter(s => s.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  async function fetchNow(id: number) {
    setFetching(id);
    setFetchMsg('');
    const res = await fetch('/api/subscriptions/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFetchMsg(`Error: ${data.error}`);
    } else {
      const r = data.results?.[0];
      setFetchMsg(r?.cached ? 'Already up to date' : r?.success ? `Fetched: ${r.title}` : `Failed: ${r?.error}`);
      await load();
    }
    setFetching(null);
  }

  async function fetchAll() {
    setFetching(-1);
    setFetchMsg('');
    const res = await fetch('/api/subscriptions/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      setFetchMsg(`Error: ${data.error}`);
    } else {
      const ok = data.results?.filter((r: any) => r.success).length ?? 0;
      setFetchMsg(`Fetched ${ok}/${data.total} sources`);
      await load();
    }
    setFetching(null);
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Admin — Subscriptions</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-600 text-sm">Saved!</span>}
          {fetchMsg && <span className="text-blue-600 text-sm">{fetchMsg}</span>}
          <button onClick={fetchAll} disabled={fetching !== null}
            className="border border-blue-500 text-blue-500 px-3 py-1 rounded text-sm hover:bg-blue-50 disabled:opacity-50">
            {fetching === -1 ? 'Fetching...' : 'Fetch All'}
          </button>
          <button onClick={() => { setEditing({ ...EMPTY }); setError(''); }}
            className="bg-black text-white px-3 py-1 rounded text-sm">+ New Source</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source list */}
        <div className="space-y-3">
          {sources.map(s => (
            <div key={s.id}
              className={`border rounded-lg px-4 py-3 cursor-pointer transition-colors ${editing?.id === s.id ? 'border-black bg-gray-50' : 'hover:border-gray-400'}`}
              onClick={() => { setEditing({ ...s }); setError(''); }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{s.name}</span>
                  {!s.enabled && <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded">Disabled</span>}
                  <span className="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded">{s.category}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={e => { e.stopPropagation(); fetchNow(s.id!); }}
                    disabled={fetching !== null}
                    className="text-blue-400 hover:text-blue-600 text-xs disabled:opacity-50">
                    {fetching === s.id ? '...' : 'Fetch'}
                  </button>
                  <button onClick={e => { e.stopPropagation(); del(s.id!); }}
                    className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                </div>
              </div>
              <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{s.url}</p>
              {s.last_fetched_at && (
                <p className="text-xs text-gray-300 mt-0.5">Last: {new Date(s.last_fetched_at).toLocaleString()}</p>
              )}
            </div>
          ))}
          {sources.length === 0 && <p className="text-gray-400 text-sm">No subscriptions yet. Add a URL to get started.</p>}
        </div>

        {/* Editor */}
        {editing && (
          <div className="border rounded-lg px-4 py-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                className="border rounded px-2 py-1 text-sm w-full" placeholder="My Blog" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">URL</label>
              <input value={editing.url} onChange={e => setEditing({ ...editing, url: e.target.value })}
                className="border rounded px-2 py-1 text-sm w-full font-mono"
                placeholder="https://example.com/blog" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Category</label>
                <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}
                  className="border rounded px-2 py-1 text-sm w-full">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fetch Interval (sec)</label>
                <input type="number" value={editing.fetch_interval}
                  onChange={e => setEditing({ ...editing, fetch_interval: parseInt(e.target.value) || 3600 })}
                  className="border rounded px-2 py-1 text-sm w-full" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Enabled</label>
              <input type="checkbox" checked={!!editing.enabled}
                onChange={e => setEditing({ ...editing, enabled: e.target.checked ? 1 : 0 })} />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={save} className="bg-black text-white px-4 py-1 rounded text-sm">Save</button>
              <button onClick={() => setEditing(null)} className="text-sm text-gray-500">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
