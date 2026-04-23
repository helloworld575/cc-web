'use client';
import { useDeferredValue, useEffect, useState } from 'react';
import {
  formatSkillPath,
  groupSkillSummaries,
  isInvocableSkillSummary,
  matchSkillSummary,
  type InvocableSkill,
  type SkillSummary,
} from '@/lib/skill-taxonomy';

interface SkillEditorState {
  id: string;
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  system: string;
  prompt: string;
  output: string;
  hierarchy: {
    domain: string;
    category: string;
    subcategory: string;
    order: number;
  };
  lookup: {
    invoke: string;
    aliases: string;
    keywords: string;
  };
}

const EMPTY_EDITOR: SkillEditorState = {
  id: '',
  name: '',
  name_zh: '',
  description: '',
  description_zh: '',
  system: '',
  prompt: '{{content}}',
  output: 'content',
  hierarchy: {
    domain: '',
    category: '',
    subcategory: '',
    order: 100,
  },
  lookup: {
    invoke: '',
    aliases: '',
    keywords: '',
  },
};

function toEditorState(skill: InvocableSkill): SkillEditorState {
  return {
    id: skill.id,
    name: skill.name,
    name_zh: skill.name_zh ?? '',
    description: skill.description,
    description_zh: skill.description_zh ?? '',
    system: skill.system ?? '',
    prompt: skill.prompt,
    output: skill.output,
    hierarchy: {
      domain: skill.hierarchy.domain,
      category: skill.hierarchy.category,
      subcategory: skill.hierarchy.subcategory,
      order: skill.hierarchy.order,
    },
    lookup: {
      invoke: skill.lookup.invoke,
      aliases: skill.lookup.aliases.join(', '),
      keywords: skill.lookup.keywords.join(', '),
    },
  };
}

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [editing, setEditing] = useState<SkillEditorState | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function loadSkills() {
    const response = await fetch('/api/skills?catalog=all');
    if (!response.ok) return;
    setSkills(await response.json());
  }

  useEffect(() => {
    loadSkills().catch(() => {});
  }, []);

  async function startEdit(summary: SkillSummary) {
    setSelectedSkill(summary);
    setLoadingId(summary.id);
    setError('');

    if (!isInvocableSkillSummary(summary)) {
      setEditing(null);
      setLoadingId(null);
      return;
    }

    try {
      const response = await fetch(`/api/skills/${summary.id}`);
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? 'Failed to load skill');
        return;
      }

      const detail = await response.json() as InvocableSkill;
      setEditing(toEditorState(detail));
    } finally {
      setLoadingId(null);
    }
  }

  function startNew() {
    setEditing({ ...EMPTY_EDITOR });
    setSelectedSkill(null);
    setError('');
  }

  async function save() {
    if (!editing) return;

    setError('');
    const isNew = !skills.find(skill => skill.id === editing.id);
    const response = await fetch(isNew ? '/api/skills' : `/api/skills/${editing.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing.id,
        name: editing.name,
        name_zh: editing.name_zh || undefined,
        description: editing.description,
        description_zh: editing.description_zh || undefined,
        system: editing.system || undefined,
        prompt: editing.prompt,
        output: editing.output,
        hierarchy: editing.hierarchy,
        lookup: {
          invoke: editing.lookup.invoke || undefined,
          aliases: editing.lookup.aliases,
          keywords: editing.lookup.keywords,
        },
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? 'Failed');
      return;
    }

    await loadSkills();
    setSaved(true);
    setEditing(null);
    setSelectedSkill(null);
    window.setTimeout(() => setSaved(false), 2000);
  }

  async function remove(id: string) {
    const response = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
    if (!response.ok) return;

    setSkills(current => current.filter(skill => skill.id !== id));
    if (editing?.id === id) setEditing(null);
    if (selectedSkill?.id === id) setSelectedSkill(null);
  }

  const filteredSkills = skills.filter(skill => matchSkillSummary(skill, deferredQuery));
  const groups = groupSkillSummaries(filteredSkills);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="glass-panel rounded-[34px] px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Skill system</p>
            <h1 className="mt-2 font-display text-4xl text-slate-950">Hierarchical skills</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              The list below is now a lightweight skill index. Domain, category, subcategory, aliases, and invoke path all live in metadata so callers can search and resolve the right skill without shipping every prompt to the client.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Saved</span>}
            <button onClick={startNew} className="rounded-[20px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg">
              New skill
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="glass-panel rounded-[32px] px-5 py-5">
          <input
            data-testid="admin-skills-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by skill name, invoke path, alias, or keyword"
            className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />

          <div className="mt-5 space-y-4">
            {groups.map(group => (
              <section key={group.key} className="rounded-[24px] border border-white/70 bg-white/90 px-4 py-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{group.label}</p>
                <div className="mt-3 space-y-2">
                  {group.skills.map(skill => (
                    <button
                      key={skill.id}
                      onClick={() => startEdit(skill)}
                      className={`w-full rounded-[20px] border px-3 py-3 text-left transition ${
                        editing?.id === skill.id
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{skill.name}</p>
                          <p className={`mt-1 text-xs leading-5 ${editing?.id === skill.id ? 'text-white/65' : 'text-slate-500'}`}>
                            {skill.description}
                          </p>
                          <p className={`mt-2 text-[11px] font-medium uppercase tracking-[0.18em] ${editing?.id === skill.id ? 'text-white/45' : 'text-slate-400'}`}>
                            {formatSkillPath(skill)}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                          editing?.id === skill.id
                            ? 'bg-white/15 text-white/75'
                            : 'bg-slate-200 text-slate-500'
                        }`}>
                          {loadingId === skill.id ? 'Loading' : skill.invocable ? skill.output : 'Guide'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {groups.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
                No skills matched the current search.
              </div>
            )}
          </div>
        </aside>

        <section className="glass-panel rounded-[32px] px-5 py-5">
          {editing ? (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">ID</span>
                  <input
                    value={editing.id}
                    onChange={event => setEditing({ ...editing, id: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-mono text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="my-skill"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Output</span>
                  <select
                    value={editing.output}
                    onChange={event => setEditing({ ...editing, output: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  >
                    <option value="content">content</option>
                    <option value="brief">brief</option>
                    <option value="titles">titles</option>
                    <option value="tags">tags</option>
                    <option value="text">text</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Name</span>
                  <input
                    value={editing.name}
                    onChange={event => setEditing({ ...editing, name: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Name (zh)</span>
                  <input
                    value={editing.name_zh}
                    onChange={event => setEditing({ ...editing, name_zh: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Description</span>
                  <input
                    value={editing.description}
                    onChange={event => setEditing({ ...editing, description: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Description (zh)</span>
                  <input
                    value={editing.description_zh}
                    onChange={event => setEditing({ ...editing, description_zh: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>

              <div className="rounded-[28px] border border-white/70 bg-white/90 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Hierarchy</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_120px]">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">Domain</span>
                    <input
                      value={editing.hierarchy.domain}
                      onChange={event => setEditing({
                        ...editing,
                        hierarchy: { ...editing.hierarchy, domain: event.target.value },
                      })}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">Category</span>
                    <input
                      value={editing.hierarchy.category}
                      onChange={event => setEditing({
                        ...editing,
                        hierarchy: { ...editing.hierarchy, category: event.target.value },
                      })}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">Subcategory</span>
                    <input
                      value={editing.hierarchy.subcategory}
                      onChange={event => setEditing({
                        ...editing,
                        hierarchy: { ...editing.hierarchy, subcategory: event.target.value },
                      })}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">Order</span>
                    <input
                      type="number"
                      value={editing.hierarchy.order}
                      onChange={event => setEditing({
                        ...editing,
                        hierarchy: { ...editing.hierarchy, order: Number(event.target.value) },
                      })}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/70 bg-white/90 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Lookup</p>
                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">Invoke path</span>
                    <input
                      value={editing.lookup.invoke}
                      onChange={event => setEditing({
                        ...editing,
                        lookup: { ...editing.lookup, invoke: event.target.value },
                      })}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      placeholder="content/article/faq"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">Aliases</span>
                    <input
                      value={editing.lookup.aliases}
                      onChange={event => setEditing({
                        ...editing,
                        lookup: { ...editing.lookup, aliases: event.target.value },
                      })}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      placeholder="faq, reader questions"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">Keywords</span>
                    <input
                      value={editing.lookup.keywords}
                      onChange={event => setEditing({
                        ...editing,
                        lookup: { ...editing.lookup, keywords: event.target.value },
                      })}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      placeholder="article, q&a, blog"
                    />
                  </label>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">System prompt</span>
                <textarea
                  value={editing.system}
                  onChange={event => setEditing({ ...editing, system: event.target.value })}
                  rows={6}
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-mono text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Prompt</span>
                <textarea
                  value={editing.prompt}
                  onChange={event => setEditing({ ...editing, prompt: event.target.value })}
                  rows={10}
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-mono text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              {error && (
                <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {editing.hierarchy.domain || 'domain'} / {editing.hierarchy.category || 'category'} / {editing.hierarchy.subcategory || 'subcategory'}
                </div>
                <div className="flex items-center gap-2">
                  {editing.id && (
                    <button
                      onClick={() => remove(editing.id)}
                      className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(null)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : selectedSkill ? (
            <div className="flex min-h-[720px] items-center justify-center rounded-[28px] border border-white/70 bg-white/90 px-6 py-10">
              <div className="w-full max-w-2xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {selectedSkill.invocable ? selectedSkill.output : 'Guide'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {formatSkillPath(selectedSkill)}
                  </span>
                </div>
                <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Skill</p>
                <h2 className="mt-2 font-display text-4xl text-slate-950">{selectedSkill.name}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{selectedSkill.description}</p>

                <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Invoke path</p>
                  <p className="mt-2 font-mono text-sm text-slate-700">{selectedSkill.lookup.invoke}</p>
                </div>

                {!selectedSkill.invocable && (
                  <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-800">
                    This skill is part of the Codex catalog, but it does not expose an app prompt contract. It is visible here for discovery and hierarchy review, while the editor remains limited to invocable web-app skills.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[720px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 text-center">
              <div>
                <p className="font-display text-4xl text-slate-950">Select a skill</p>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  The list on the left is the lightweight finder view. Open any entry to inspect or edit the full prompt and metadata.
                </p>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
