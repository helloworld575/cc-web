'use client';
import { useEffect, useState } from 'react';

interface Skill { id: string; name: string; description: string; system?: string; prompt: string; output: string; }

const EMPTY: Skill = { id: '', name: '', description: '', system: '', prompt: '{{content}}', output: 'content' };

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetch('/api/skills').then(r => r.json()).then(setSkills); }, []);

  function startNew() { setEditing({ ...EMPTY }); setError(''); }
  function startEdit(s: Skill) { setEditing({ ...s }); setError(''); }

  async function save() {
    if (!editing) return;
    setError('');
    const isNew = !skills.find(s => s.id === editing.id);
    const res = await fetch(isNew ? '/api/skills' : `/api/skills/${editing.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return; }
    const updated = await fetch('/api/skills').then(r => r.json());
    setSkills(updated);
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function del(id: string) {
    await fetch(`/api/skills/${id}`, { method: 'DELETE' });
    setSkills(skills.filter(s => s.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Admin — Skills</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-600 text-sm">Saved!</span>}
          <button onClick={startNew} className="bg-black text-white px-3 py-1 rounded text-sm">+ New Skill</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Skill list */}
        <div className="space-y-3">
          {skills.map(s => (
            <div key={s.id} className={`border rounded-lg px-4 py-3 cursor-pointer transition-colors ${editing?.id === s.id ? 'border-black bg-gray-50' : 'hover:border-gray-400'}`}
              onClick={() => startEdit(s)}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{s.name}</span>
                <button onClick={e => { e.stopPropagation(); del(s.id); }} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
              <span className="text-xs text-gray-300 font-mono">id: {s.id}</span>
            </div>
          ))}
          {skills.length === 0 && <p className="text-gray-400 text-sm">No skills yet. Create one.</p>}
        </div>

        {/* Editor */}
        {editing && (
          <div className="border rounded-lg px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">ID (a-z, 0-9, -)</label>
                <input value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })}
                  className="border rounded px-2 py-1 text-sm w-full font-mono" placeholder="my-skill" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Output type</label>
                <select value={editing.output} onChange={e => setEditing({ ...editing, output: e.target.value })}
                  className="border rounded px-2 py-1 text-sm w-full">
                  <option value="content">content</option>
                  <option value="brief">brief</option>
                  <option value="titles">titles (JSON array)</option>
                  <option value="tags">tags (JSON array)</option>
                  <option value="text">text (display only)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                className="border rounded px-2 py-1 text-sm w-full" placeholder="Polish Blog Post" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Description</label>
              <input value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}
                className="border rounded px-2 py-1 text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">System Prompt (optional — sets the AI's role and rules)</label>
              <textarea value={editing.system ?? ''} onChange={e => setEditing({ ...editing, system: e.target.value })}
                rows={6} className="border rounded px-2 py-1 text-sm w-full font-mono resize-y" placeholder="You are an expert..." />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">User Prompt — use <code className="bg-gray-100 px-1 rounded">{"{{content}}"}</code> as placeholder</label>
              <textarea value={editing.prompt} onChange={e => setEditing({ ...editing, prompt: e.target.value })}
                rows={8} className="border rounded px-2 py-1 text-sm w-full font-mono resize-y" />
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
