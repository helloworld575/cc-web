'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MarkdownEditor from '@/components/MarkdownEditor';
import { useLocale } from '@/components/useLocale';

interface Skill { id: string; name: string; name_zh?: string; output: string; }

export default function AdminBlogEditor() {
  const { slug } = useParams<{ slug: string }>();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [brief, setBrief] = useState('');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const { locale, t } = useLocale();
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiError, setAiError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionLabel, setSuggestionLabel] = useState('');

  useEffect(() => {
    fetch(`/api/blog/${slug}`).then(r => r.ok ? r.json() : Promise.reject()).then(p => {
      setTitle(p.title ?? '');
      setDate(p.date ?? '');
      setBrief(p.brief ?? '');
      setContent(p.content ?? '');
    }).catch(() => {});
    fetch('/api/skills').then(r => r.ok ? r.json() : Promise.reject()).then(setSkills).catch(() => {});
  }, [slug]);

  async function save() {
    const res = await fetch(`/api/blog/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, brief, content }),
    });
    if (!res.ok) { alert('Save failed'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function runAi(skill: Skill) {
    if (!content.trim()) { setAiError(t('writeContentFirst')); return; }
    setAiError('');
    setSuggestions([]);
    setAiLoading(skill.id);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill: skill.id, content }),
      });

      if (!res.ok) {
        const d = await res.json();
        setAiError(d.error ?? 'AI error');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setAiError('无法读取响应'); return; }
      const decoder = new TextDecoder();
      let buf = '';
      let accumulated = '';
      let outputType = skill.output;

      const isLive = outputType === 'content' || outputType === 'brief';
      if (isLive) {
        if (outputType === 'content') setContent('');
        if (outputType === 'brief') setBrief('');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          try {
            const msg = JSON.parse(raw);
            if (msg.output) { outputType = msg.output; continue; }
            if (msg.text) {
              accumulated += msg.text;
              if (outputType === 'content') setContent(accumulated);
              if (outputType === 'brief') setBrief(accumulated);
            }
          } catch { /* skip */ }
        }
      }

      if (outputType === 'titles' || outputType === 'tags') {
        try {
          const arr: string[] = JSON.parse(accumulated);
          setSuggestions(arr);
          setSuggestionLabel(outputType === 'titles' ? t('clickToApplyTitle') : t('clickToCopyTag'));
        } catch { setAiError('Could not parse response'); }
      } else if (outputType === 'text') {
        setSuggestions([accumulated]);
        setSuggestionLabel('append');
      }
    } catch {
      setAiError('Network error');
    } finally {
      setAiLoading(null);
    }
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('colTitle')}
          className="border rounded px-3 py-2 flex-1 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-black/10" />
        <div className="flex gap-2 items-center">
          <input value={date} onChange={e => setDate(e.target.value)} placeholder="YYYY-MM-DD"
            className="border rounded px-2 py-2 flex-1 sm:w-36 text-sm" />
          <button onClick={save} className="bg-black text-white px-4 py-2 rounded text-sm whitespace-nowrap">{t('save')}</button>
          {saved && <span className="text-green-600 text-sm whitespace-nowrap">{t('saved')}</span>}
        </div>
      </div>
      <textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder={t('briefPlaceholder')}
        className="w-full border rounded px-3 py-2 text-sm mb-3 resize-none" rows={2} />

      {/* AI Panel */}
      <div className="border rounded px-4 py-3 mb-4 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{t('aiTools')}</p>
        <div className="flex flex-wrap gap-2">
          {skills.map(skill => (
            <button key={skill.id} onClick={() => runAi(skill)} disabled={!!aiLoading}
              className="px-3 py-1 text-sm border rounded hover:bg-black hover:text-white transition-colors disabled:opacity-40">
              {aiLoading === skill.id ? (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {locale === 'zh' && skill.name_zh ? skill.name_zh : skill.name}
                </span>
              ) : (locale === 'zh' && skill.name_zh ? skill.name_zh : skill.name)}
            </button>
          ))}
        </div>
        {aiError && <p className="text-red-500 text-xs mt-2">{aiError}</p>}
        {suggestions.length > 0 && (
          <div className="mt-2">
            {suggestionLabel === 'append' ? (
              <div className="space-y-2">
                <pre className="text-xs bg-white border rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto">{suggestions[0]}</pre>
                <button onClick={() => { setContent(c => c + '\n\n' + suggestions[0]); setSuggestions([]); }}
                  className="text-xs border rounded px-2 py-1 hover:bg-black hover:text-white transition-colors">
                  {t('appendToArticle')}
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-1">{suggestionLabel}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setTitle(s); setSuggestions([]); }}
                      className="text-xs border rounded px-2 py-1 hover:bg-black hover:text-white transition-colors text-left">
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <MarkdownEditor value={content} onChange={setContent} rows={28} />
    </main>
  );
}
