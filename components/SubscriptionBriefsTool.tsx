'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocale } from '@/components/useLocale';

interface Brief {
  id: number;
  source_id: number;
  source_name: string;
  category: string;
  title: string;
  url: string;
  brief: string;
  fetched_at: string;
}

export default function SubscriptionBriefsTool() {
  const { t } = useLocale();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);

  async function loadBriefs() {
    setLoading(true);
    const res = await fetch('/api/subscriptions/briefs');
    if (res.ok) {
      const data = await res.json();
      setBriefs(data);
      // Extract unique categories
      const cats = Array.from(new Set(data.map((b: Brief) => b.category)));
      setCategories(cats as string[]);
    }
    setLoading(false);
  }

  async function refreshAll() {
    setRefreshing(true);
    await fetch('/api/subscriptions/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    await loadBriefs();
    setRefreshing(false);
  }

  async function deleteBrief(id: number) {
    if (!confirm(t('subscriptionDeleteConfirm'))) return;
    await fetch(`/api/subscriptions/briefs?id=${id}`, { method: 'DELETE' });
    setBriefs(briefs.filter(b => b.id !== id));
  }

  useEffect(() => { loadBriefs(); }, []);

  const filteredBriefs = filter === 'all'
    ? briefs
    : briefs.filter(b => b.category === filter);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">{t('loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option value="all">{t('all')}</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            {filteredBriefs.length} {t('subscriptionBriefs')}
          </span>
        </div>
        <button onClick={refreshAll} disabled={refreshing}
          className="border rounded px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50">
          {refreshing ? t('subscriptionRefreshing') : t('subscriptionRefresh')}
        </button>
      </div>

      {/* Briefs list */}
      {filteredBriefs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">{t('subscriptionNoBriefs')}</p>
          <a href="/admin/subscriptions" className="text-blue-500 hover:underline text-sm">
            {t('subscriptionGoConfig')}
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBriefs.map(brief => (
            <div key={brief.id} className="border rounded-lg px-4 py-4 hover:border-gray-400 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <a href={brief.url} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-base hover:text-blue-600 transition-colors">
                      {brief.title}
                    </a>
                    <span className="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded">
                      {brief.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{brief.source_name}</span>
                    <span>•</span>
                    <a href={brief.url} target="_blank" rel="noopener noreferrer"
                      className="font-mono truncate max-w-[300px] hover:text-blue-500 transition-colors">
                      {brief.url}
                    </a>
                    <span>•</span>
                    <span>{new Date(brief.fetched_at).toLocaleString()}</span>
                  </div>
                </div>
                <button onClick={() => deleteBrief(brief.id)}
                  className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">
                  {t('delete')}
                </button>
              </div>
              <article className="prose prose-sm max-w-none text-gray-700">
                <ReactMarkdown>{brief.brief}</ReactMarkdown>
              </article>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
