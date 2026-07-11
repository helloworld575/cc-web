'use client';
import { useDeferredValue, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MarkdownEditor from '@/components/MarkdownEditor';
import { useLocale } from '@/components/useLocale';
import {
  formatSkillPath,
  groupSkillSummaries,
  matchSkillSummary,
  type InvocableSkillSummary,
} from '@/lib/skill-taxonomy';

interface AiProviderSummary {
  id: number;
  name: string;
  model: string;
  is_default: number;
}

export default function AdminBlogEditor() {
  const { slug } = useParams<{ slug: string }>();
  const { locale, t } = useLocale();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [brief, setBrief] = useState('');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [skills, setSkills] = useState<InvocableSkillSummary[]>([]);
  const [providers, setProviders] = useState<AiProviderSummary[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [skillQuery, setSkillQuery] = useState('');
  const deferredSkillQuery = useDeferredValue(skillQuery);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiError, setAiError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<'titles' | 'tags' | 'append' | null>(null);
  const [suggestionLabel, setSuggestionLabel] = useState('');

  useEffect(() => {
    fetch(`/api/blog/${slug}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(post => {
        setTitle(post.title ?? '');
        setDate(post.date ?? '');
        setBrief(post.brief ?? '');
        setContent(post.content ?? '');
      })
      .catch(() => {});

    fetch('/api/skills')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(setSkills)
      .catch(() => {});

    fetch('/api/ai-providers')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then((items: AiProviderSummary[]) => {
        setProviders(items);
        setSelectedProviderId(current => {
          if (current !== null && items.some(provider => provider.id === current)) return current;
          return items.find(provider => provider.is_default)?.id ?? items[0]?.id ?? null;
        });
      })
      .catch(() => {});
  }, [slug]);

  async function save() {
    const response = await fetch(`/api/blog/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, brief, content }),
    });

    if (!response.ok) {
      alert('Save failed');
      return;
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  async function runAi(skill: InvocableSkillSummary) {
    if (!content.trim()) {
      setAiError(t('writeContentFirst'));
      return;
    }

    setAiError('');
    setSuggestions([]);
    setSuggestionMode(null);
    setAiLoading(skill.id);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: skill.lookup.invoke,
          content,
          provider_id: selectedProviderId ?? undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setAiError(data.error ?? 'AI error');
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setAiError('Stream is unavailable.');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let outputType = skill.output;

      const streamDirectly = outputType === 'content' || outputType === 'brief';
      if (streamDirectly) {
        if (outputType === 'content') setContent('');
        if (outputType === 'brief') setBrief('');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const message = JSON.parse(line.slice(6));
            if (message.output) {
              outputType = message.output;
              continue;
            }

            if (!message.text) continue;
            accumulated += message.text;

            if (outputType === 'content') setContent(accumulated);
            if (outputType === 'brief') setBrief(accumulated);
          } catch {
            continue;
          }
        }
      }

      if (outputType === 'titles' || outputType === 'tags') {
        try {
          const parsed = JSON.parse(accumulated) as string[];
          setSuggestions(parsed);
          setSuggestionMode(outputType);
          setSuggestionLabel(outputType === 'titles' ? t('clickToApplyTitle') : t('clickToCopyTag'));
        } catch {
          setAiError('Could not parse response');
        }
      } else if (outputType === 'text') {
        setSuggestions([accumulated]);
        setSuggestionMode('append');
        setSuggestionLabel('append');
      }
    } catch {
      setAiError('Network error');
    } finally {
      setAiLoading(null);
    }
  }

  const filteredSkills = skills.filter(skill => matchSkillSummary(skill, deferredSkillQuery));
  const skillGroups = groupSkillSummaries(filteredSkills);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <section className="glass-panel rounded-[32px] px-6 py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('adminEditor')}</p>
            <h1 className="mt-2 font-display text-4xl text-slate-950">{t('adminBlogWorkspace')}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Skill prompts stay on the server; the editor only pulls a lightweight skill index and resolves the final tool by invoke path.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button data-testid="admin-blog-save" onClick={save} className="rounded-[20px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg">
              {t('save')}
            </button>
            {saved && <span data-testid="admin-blog-saved" className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">{t('saved')}</span>}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <input
            data-testid="admin-blog-editor-title"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder={t('colTitle')}
            className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
          <input
            data-testid="admin-blog-editor-date"
            value={date}
            onChange={event => setDate(event.target.value)}
            placeholder="YYYY-MM-DD"
            className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
        </div>

        <textarea
          data-testid="admin-blog-editor-brief"
          value={brief}
          onChange={event => setBrief(event.target.value)}
          placeholder={t('briefPlaceholder')}
          rows={3}
          className="mt-4 w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="glass-panel rounded-[32px] px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('aiTools')}</p>
          <h2 className="mt-2 font-display text-3xl text-slate-950">{t('adminSkillFinder')}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Browse by hierarchy or type a capability, then invoke the resolved skill path without loading every prompt into the client.
          </p>

          <input
            data-testid="admin-blog-skill-search"
            value={skillQuery}
            onChange={event => setSkillQuery(event.target.value)}
            placeholder="Find by name, path, or keyword"
            className="mt-5 w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />

          {providers.length > 0 && (
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('aiChatProvider')}</span>
              <select
                data-testid="admin-blog-skill-provider"
                value={selectedProviderId ?? ''}
                onChange={event => setSelectedProviderId(Number(event.target.value))}
                disabled={!!aiLoading}
                className="mt-2 w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {providers.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} - {provider.model}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div data-testid="admin-blog-skill-list" className="mt-5 max-h-[calc(100vh-260px)] min-h-[320px] space-y-4 overflow-y-auto pr-2">
            {skillGroups.map(group => (
              <section key={group.key} className="rounded-[24px] border border-white/70 bg-white/90 px-4 py-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{group.label}</p>
                <div className="mt-3 space-y-2">
                  {group.skills.map(skill => (
                    <button
                      key={skill.id}
                      onClick={() => runAi(skill)}
                      disabled={!!aiLoading}
                      className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">
                            {locale === 'zh' && skill.name_zh ? skill.name_zh : skill.name}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {locale === 'zh' && skill.description_zh ? skill.description_zh : skill.description}
                          </p>
                          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                            {formatSkillPath(skill)}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                          aiLoading === skill.id
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-500'
                        }`}>
                          {aiLoading === skill.id ? 'Running' : skill.output}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {skillGroups.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
                No skills matched the current search.
              </div>
            )}
          </div>

          {aiError && (
            <div className="mt-4 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {aiError}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="mt-4 rounded-[24px] border border-white/70 bg-white/90 px-4 py-4 shadow-sm">
              {suggestionLabel === 'append' ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('appendToArticle')}</p>
                  <pre className="max-h-48 overflow-y-auto rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-xs whitespace-pre-wrap text-slate-700">
                    {suggestions[0]}
                  </pre>
                  <button
                    onClick={() => {
                      setContent(current => `${current}\n\n${suggestions[0]}`);
                      setSuggestions([]);
                      setSuggestionMode(null);
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-900 hover:text-white"
                  >
                    {t('appendToArticle')}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{suggestionLabel}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion}-${index}`}
                        onClick={async () => {
                          if (suggestionMode === 'tags') {
                            try {
                              await navigator.clipboard.writeText(suggestion);
                            } catch {}
                          } else {
                            setTitle(suggestion);
                          }
                          setSuggestions([]);
                          setSuggestionMode(null);
                        }}
                        className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-900 hover:text-white"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        <section className="glass-panel rounded-[32px] px-5 py-5">
          <MarkdownEditor
            value={content}
            onChange={setContent}
            rows={32}
            minHeight={640}
            textareaTestId="admin-blog-editor-content"
            previewTestId="admin-blog-editor-preview"
          />
        </section>
      </section>
    </main>
  );
}
