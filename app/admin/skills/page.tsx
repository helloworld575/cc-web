'use client';
import { useDeferredValue, useEffect, useState } from 'react';
import {
  formatSkillPath,
  groupSkillSummaries,
  matchSkillSummary,
  type SkillExecutionMode,
  type SkillOrchestrationRole,
  type Skill,
  type SkillSummary,
} from '@/lib/skill-taxonomy';
import { useLocale } from '@/components/useLocale';

interface SkillRouteEditorState {
  skill: string;
  when: string;
  mode: SkillExecutionMode;
}

interface SkillEditorState {
  id: string;
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  invocable: boolean;
  system: string;
  prompt: string;
  output: string;
  content: string;
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
  orchestration: {
    role: SkillOrchestrationRole;
    mode: SkillExecutionMode;
    children: SkillRouteEditorState[];
  };
}

const EMPTY_EDITOR: SkillEditorState = {
  id: '',
  name: '',
  name_zh: '',
  description: '',
  description_zh: '',
  invocable: true,
  system: '',
  prompt: '{{content}}',
  output: 'content',
  content: '# New Skill\n',
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
  orchestration: {
    role: 'leaf',
    mode: 'direct',
    children: [],
  },
};

function createEmptyRoute(): SkillRouteEditorState {
  return {
    skill: '',
    when: '',
    mode: 'reference',
  };
}

function toEditorState(skill: Skill): SkillEditorState {
  return {
    id: skill.id,
    name: skill.name,
    name_zh: skill.name_zh ?? '',
    description: skill.description,
    description_zh: skill.description_zh ?? '',
    invocable: skill.invocable,
    system: skill.system ?? '',
    prompt: skill.prompt ?? '{{content}}',
    output: skill.output ?? 'content',
    content: skill.content,
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
    orchestration: {
      role: skill.orchestration.role,
      mode: skill.orchestration.mode,
      children: skill.orchestration.children.map(child => ({
        skill: child.skill,
        when: child.when,
        mode: child.mode,
      })),
    },
  };
}

export default function AdminSkillsPage() {
  const { t } = useLocale();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [editing, setEditing] = useState<SkillEditorState | null>(null);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
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
    setActiveSkillId(summary.id);
    setLoadingId(summary.id);
    setError('');

    try {
      const response = await fetch(`/api/skills/${summary.id}`);
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? 'Failed to load skill');
        return;
      }

      const detail = await response.json() as Skill;
      setEditing(toEditorState(detail));
    } finally {
      setLoadingId(null);
    }
  }

  function startNew() {
    setEditing({ ...EMPTY_EDITOR });
    setActiveSkillId(null);
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
        invocable: editing.invocable,
        system: editing.invocable ? editing.system || undefined : undefined,
        prompt: editing.invocable ? editing.prompt : undefined,
        output: editing.invocable ? editing.output : undefined,
        content: editing.content,
        hierarchy: editing.hierarchy,
        lookup: {
          invoke: editing.lookup.invoke || undefined,
          aliases: editing.lookup.aliases,
          keywords: editing.lookup.keywords,
        },
        orchestration: {
          role: editing.orchestration.role,
          mode: editing.orchestration.mode,
          children: editing.orchestration.children
            .map(child => ({
              skill: child.skill.trim(),
              when: child.when.trim(),
              mode: child.mode,
            }))
            .filter(child => child.skill.length > 0),
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
    setActiveSkillId(editing.id);
    window.setTimeout(() => setSaved(false), 2000);
  }

  async function remove(id: string) {
    const response = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
    if (!response.ok) return;

    setSkills(current => current.filter(skill => skill.id !== id));
    if (editing?.id === id) setEditing(null);
    if (activeSkillId === id) setActiveSkillId(null);
  }

  const filteredSkills = skills.filter(skill => matchSkillSummary(skill, deferredQuery));
  const groups = groupSkillSummaries(filteredSkills);
  const editingExistingSkill = editing ? skills.some(skill => skill.id === editing.id) : false;
  const skillIds = skills.map(skill => skill.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="glass-panel rounded-[34px] px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('adminSkillsEyebrow')}</p>
            <h1 className="mt-2 font-display text-4xl text-slate-950">{t('adminSkillsTitle')}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Compact index for finding, routing, and editing skill metadata.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">{t('saved')}</span>}
            <button onClick={startNew} className="rounded-[20px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg">
              New skill
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <aside
          data-testid="admin-skills-list-panel"
          className="glass-panel flex flex-col rounded-[32px] px-5 py-5 lg:sticky lg:top-6 lg:h-[calc(100vh-2rem)]"
        >
          <input
            data-testid="admin-skills-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('adminSkillsSearch')}
            className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />

          <div
            data-testid="admin-skills-list-scroll"
            className="mt-4 space-y-2 pr-1"
            style={{ height: '28rem', overflowY: 'auto' }}
          >
            {groups.map(group => (
              <section key={group.key} className="rounded-[18px] border border-white/70 bg-white/90 px-3 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {group.skills.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {group.skills.map(skill => (
                    <button
                      key={skill.id}
                      data-testid="admin-skill-list-item"
                      onClick={() => startEdit(skill)}
                      className={`w-full rounded-[14px] border px-3 py-2 text-left transition ${
                        activeSkillId === skill.id
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm'
                      }`}
                      >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{skill.name}</p>
                          <p className={`mt-1 truncate text-[11px] font-medium uppercase tracking-[0.14em] ${activeSkillId === skill.id ? 'text-white/45' : 'text-slate-400'}`}>
                            {formatSkillPath(skill)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                              activeSkillId === skill.id
                                ? 'bg-white/10 text-white/75'
                                : 'bg-violet-100 text-violet-700'
                            }`}>
                              {skill.orchestration.role}
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                              activeSkillId === skill.id
                                ? 'bg-white/10 text-white/75'
                                : 'bg-slate-200 text-slate-500'
                            }`}>
                              {skill.orchestration.mode}
                            </span>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          activeSkillId === skill.id
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

        <section
          data-testid="admin-skill-detail-panel"
          className="glass-panel rounded-[32px] px-5 py-5 lg:sticky lg:top-6 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto"
        >
          {editing ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  editing.invocable
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {editing.invocable ? 'Invocable app skill' : 'Catalog guide'}
                </span>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                  {editing.orchestration.role}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {editing.orchestration.mode}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {editing.hierarchy.domain || 'domain'} / {editing.hierarchy.category || 'category'} / {editing.hierarchy.subcategory || 'subcategory'}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">ID</span>
                  <input
                    data-testid="admin-skill-id"
                    value={editing.id}
                    onChange={event => setEditing({ ...editing, id: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-mono text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="my-skill"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsType')}</span>
                  <select
                    value={editing.invocable ? 'invocable' : 'guide'}
                    onChange={(event) => {
                      const invocable = event.target.value === 'invocable';
                      setEditing({
                        ...editing,
                        invocable,
                        orchestration: {
                          ...editing.orchestration,
                          mode: editing.orchestration.children.length > 0
                            ? (invocable ? 'hybrid' : 'route')
                            : (invocable ? 'direct' : 'reference'),
                        },
                      });
                    }}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  >
                    <option value="invocable">{t('adminInvocableSkill')}</option>
                    <option value="guide">{t('adminGuideSkill')}</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsName')}</span>
                  <input
                    value={editing.name}
                    onChange={event => setEditing({ ...editing, name: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsName')} (zh)</span>
                  <input
                    value={editing.name_zh}
                    onChange={event => setEditing({ ...editing, name_zh: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsDescription')}</span>
                  <input
                    value={editing.description}
                    onChange={event => setEditing({ ...editing, description: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsDescription')} (zh)</span>
                  <input
                    value={editing.description_zh}
                    onChange={event => setEditing({ ...editing, description_zh: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>

              {editing.invocable && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsOutput')}</span>
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
              )}

              <div className="rounded-[28px] border border-white/70 bg-white/90 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsHierarchy')}</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_120px]">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillDomain')}</span>
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
                    <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillCategory')}</span>
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
                    <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillSubcategory')}</span>
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
                    <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillOrder')}</span>
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
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsLookup')}</p>
                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillInvokePath')}</span>
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
                    <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillAliases')}</span>
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
                    <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillKeywords')}</span>
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

              <div className="rounded-[28px] border border-white/70 bg-white/90 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsOrchestration')}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Root and router skills can hand off to more specific skills. Keep leaf skills direct when the web app or agent should execute them immediately.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing({
                      ...editing,
                      orchestration: {
                        ...editing.orchestration,
                        role: editing.orchestration.role === 'leaf' ? 'router' : editing.orchestration.role,
                        mode: editing.invocable ? 'hybrid' : 'route',
                        children: [...editing.orchestration.children, createEmptyRoute()],
                      },
                    })}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-100"
                  >
                    Add route
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillRole')}</span>
                    <select
                      data-testid="admin-skill-role"
                      value={editing.orchestration.role}
                      onChange={(event) => {
                        const role = event.target.value as SkillOrchestrationRole;
                        setEditing({
                          ...editing,
                          orchestration: {
                            ...editing.orchestration,
                            role,
                            mode: role === 'leaf' && editing.orchestration.children.length === 0
                              ? (editing.invocable ? 'direct' : 'reference')
                              : editing.orchestration.mode,
                          },
                        });
                      }}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    >
                      <option value="root">root</option>
                      <option value="router">router</option>
                      <option value="leaf">leaf</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillMode')}</span>
                    <select
                      data-testid="admin-skill-mode"
                      value={editing.orchestration.mode}
                      onChange={(event) => setEditing({
                        ...editing,
                        orchestration: {
                          ...editing.orchestration,
                          mode: event.target.value as SkillExecutionMode,
                        },
                      })}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    >
                      <option value="direct">direct</option>
                      <option value="route">route</option>
                      <option value="hybrid">hybrid</option>
                      <option value="reference">reference</option>
                    </select>
                  </label>
                </div>

                <datalist id="admin-skill-route-options">
                  {skillIds.map(id => (
                    <option key={id} value={id} />
                  ))}
                </datalist>

                <div className="mt-4 space-y-4">
                  {editing.orchestration.children.length === 0 && (
                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-500">
                      No child routes configured yet.
                    </div>
                  )}

                  {editing.orchestration.children.map((child, index) => (
                    <div key={`${index}-${child.skill || 'route'}`} className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,180px)_minmax(0,1fr)_160px_auto]">
                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillChild')}</span>
                          <input
                            list="admin-skill-route-options"
                            data-testid={`admin-skill-route-skill-${index}`}
                            value={child.skill}
                            onChange={(event) => setEditing({
                              ...editing,
                              orchestration: {
                                ...editing.orchestration,
                                children: editing.orchestration.children.map((entry, entryIndex) => (
                                  entryIndex === index
                                    ? { ...entry, skill: event.target.value }
                                    : entry
                                )),
                              },
                            })}
                            className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-mono text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                            placeholder="article-faq"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillWhen')}</span>
                          <input
                            data-testid={`admin-skill-route-when-${index}`}
                            value={child.when}
                            onChange={(event) => setEditing({
                              ...editing,
                              orchestration: {
                                ...editing.orchestration,
                                children: editing.orchestration.children.map((entry, entryIndex) => (
                                  entryIndex === index
                                    ? { ...entry, when: event.target.value }
                                    : entry
                                )),
                              },
                            })}
                            className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                            placeholder="Use when the user needs an FAQ section for an article."
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-slate-500">{t('adminSkillChildMode')}</span>
                          <select
                            data-testid={`admin-skill-route-mode-${index}`}
                            value={child.mode}
                            onChange={(event) => setEditing({
                              ...editing,
                              orchestration: {
                                ...editing.orchestration,
                                children: editing.orchestration.children.map((entry, entryIndex) => (
                                  entryIndex === index
                                    ? { ...entry, mode: event.target.value as SkillExecutionMode }
                                    : entry
                                )),
                              },
                            })}
                            className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                          >
                            <option value="direct">direct</option>
                            <option value="route">route</option>
                            <option value="hybrid">hybrid</option>
                            <option value="reference">reference</option>
                          </select>
                        </label>

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => {
                              const children = editing.orchestration.children.filter((_, entryIndex) => entryIndex !== index);
                              setEditing({
                                ...editing,
                                orchestration: {
                                  ...editing.orchestration,
                                  children,
                                  role: children.length === 0 && editing.orchestration.role !== 'root' ? 'leaf' : editing.orchestration.role,
                                  mode: children.length === 0
                                    ? (editing.invocable ? 'direct' : 'reference')
                                    : editing.orchestration.mode,
                                },
                              });
                            }}
                            className="w-full rounded-full border border-red-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-red-600 transition hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {editing.invocable && (
                <>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsSystemPrompt')}</span>
                    <textarea
                      value={editing.system}
                      onChange={event => setEditing({ ...editing, system: event.target.value })}
                      rows={6}
                      className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-mono text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsPrompt')}</span>
                    <textarea
                      value={editing.prompt}
                      onChange={event => setEditing({ ...editing, prompt: event.target.value })}
                      rows={10}
                      className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-mono text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('adminSkillsBody')}</span>
                <textarea
                  data-testid="admin-skill-body"
                  value={editing.content}
                  onChange={event => setEditing({ ...editing, content: event.target.value })}
                  rows={16}
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
                  {editing.lookup.invoke || 'invoke path will be inferred'}
                </div>
                <div className="flex items-center gap-2">
                  {editingExistingSkill && (
                    <button
                      onClick={() => remove(editing.id)}
                      className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditing(null);
                      setActiveSkillId(null);
                      setError('');
                    }}
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
          ) : (
            <div className="flex min-h-[720px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 text-center">
              <div>
                <p className="font-display text-4xl text-slate-950">{t('adminSkillsSelect')}</p>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {t('adminSkillsSelectDesc')}
                </p>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
