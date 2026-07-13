'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Pagination from '@/components/Pagination';
import { useLocale } from '@/components/useLocale';
import { apiErrorTranslationKey, readSafeApiError } from '@/lib/client-api-error';
import type { TranslationKey } from '@/lib/i18n';

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

interface SubscriptionBriefsToolProps {
  canManage?: boolean;
}

const SUBSCRIPTION_PAGE_SIZE = 6;

export default function SubscriptionBriefsTool({ canManage = false }: SubscriptionBriefsToolProps) {
  const { t } = useLocale();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [integrating, setIntegrating] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  async function actionError(response: Response) {
    const safe = await readSafeApiError(response, t('apiErrorGeneric'));
    setErrorKey(apiErrorTranslationKey(safe.code, 'apiErrorGeneric'));
  }

  async function loadBriefs() {
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions/briefs');
      if (res.ok) {
        const data = await res.json() as Brief[];
        setBriefs(data);
        setCategories(Array.from(new Set(data.map(brief => brief.category).filter(Boolean))));
      }
    } finally {
      setLoading(false);
    }
  }

  async function crawlAll() {
    setCrawling(true);
    setErrorKey(null);
    try {
      const response = await fetch('/api/subscriptions/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) await actionError(response);
    } finally {
      setCrawling(false);
    }
  }

  async function integrateAll() {
    setIntegrating(true);
    setErrorKey(null);
    try {
      const response = await fetch('/api/subscriptions/integrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        await actionError(response);
        return;
      }

      const result = await response.json() as { results?: Array<{ success?: boolean; code?: string }> };
      const failed = result.results?.find(item => item.success === false);
      if (failed) {
        setErrorKey(apiErrorTranslationKey(failed.code || null, 'apiErrorGeneric'));
      }
      await loadBriefs();
    } finally {
      setIntegrating(false);
    }
  }

  async function deleteBrief(id: number) {
    if (!confirm(t('subscriptionDeleteConfirm'))) return;
    await fetch(`/api/subscriptions/briefs?id=${id}`, { method: 'DELETE' });
    setBriefs(current => current.filter(brief => brief.id !== id));
  }

  useEffect(() => { loadBriefs(); }, []);

  const sources = Array.from(new Set(briefs.map(brief => brief.source_name).filter(Boolean))).sort();
  const categoryCounts = new Map<string, number>();
  for (const brief of briefs) {
    categoryCounts.set(brief.category, (categoryCounts.get(brief.category) || 0) + 1);
  }
  const filteredBriefs = briefs
    .filter(brief => (filter === 'all' ? true : brief.category === filter))
    .filter(brief => (sourceFilter === 'all' ? true : brief.source_name === sourceFilter));
  const pagedBriefs = filteredBriefs.slice((page - 1) * SUBSCRIPTION_PAGE_SIZE, page * SUBSCRIPTION_PAGE_SIZE);

  if (loading) {
    return <div className="py-12 text-center text-gray-500">{t('loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {errorKey && (
        <div
          role="alert"
          data-testid="subscription-error"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {t(errorKey)}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            data-testid="subscription-category-filter"
            value={filter}
            onChange={event => {
              setFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
          >
            <option value="all">{t('all')}</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category} ({categoryCounts.get(category) || 0})
              </option>
            ))}
          </select>
          <select
            data-testid="subscription-source-filter"
            value={sourceFilter}
            onChange={event => {
              setSourceFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
          >
            <option value="all">{t('allSources')}</option>
            {sources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            {filteredBriefs.length} {t('subscriptionBriefs')}
          </span>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              data-testid="subscription-crawl-all"
              onClick={crawlAll}
              disabled={crawling || integrating}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {crawling ? t('subscriptionCrawling') : t('subscriptionCrawl')}
            </button>
            <button
              data-testid="subscription-integrate-all"
              onClick={integrateAll}
              disabled={crawling || integrating}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {integrating ? t('subscriptionIntegrating') : t('subscriptionIntegrate')}
            </button>
          </div>
        )}
      </div>

      {filteredBriefs.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p className="mb-2">{t('subscriptionNoBriefs')}</p>
          {canManage && (
            <a href="/admin/subscriptions" className="text-sm text-blue-500 hover:underline">
              {t('subscriptionGoConfig')}
            </a>
          )}
        </div>
      ) : (
        <>
          <div
            data-testid="subscription-briefs-list"
            className="grid max-h-[min(620px,calc(100vh-220px))] gap-2 overflow-y-auto pr-1"
          >
            {pagedBriefs.map(brief => (
              <div
                key={brief.id}
                data-testid="subscription-brief-card"
                className="rounded-xl border border-slate-200 bg-white px-3 py-3 transition-colors hover:border-slate-400"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                      <a
                        href={brief.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium text-slate-900 transition-colors hover:text-blue-600"
                      >
                        {brief.title}
                      </a>
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                        {brief.category}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span>{brief.source_name}</span>
                      <a
                        href={brief.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[300px] truncate font-mono transition-colors hover:text-blue-500"
                      >
                        {brief.url}
                      </a>
                      <span>{new Date(brief.fetched_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {canManage && (
                    <button
                      data-testid="subscription-delete-brief"
                      onClick={() => deleteBrief(brief.id)}
                      className="flex-shrink-0 text-xs text-red-400 hover:text-red-600"
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>

                <article className="prose prose-sm mt-2 max-h-32 max-w-none overflow-y-auto text-gray-700">
                  <ReactMarkdown>{brief.brief}</ReactMarkdown>
                </article>
              </div>
            ))}
          </div>
          <div data-testid="subscription-pagination">
            <Pagination
              total={filteredBriefs.length}
              page={page}
              pageSize={SUBSCRIPTION_PAGE_SIZE}
              onPage={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
