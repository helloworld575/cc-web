'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Pagination from '@/components/Pagination';
import { useLocale } from '@/components/useLocale';
import { apiErrorTranslationKey, readSafeApiError } from '@/lib/client-api-error';
import type { TranslationKey } from '@/lib/i18n';

type Topic = 'ai' | 'security';
type DigestTopic = Topic | 'all';

interface Brief {
  id: number;
  source_id: number;
  source_name: string;
  category: string;
  topic: Topic;
  title: string;
  url: string;
  brief: string;
  fetched_at: string;
}

interface DigestSource {
  id?: number;
  title: string;
  url: string;
  source_name?: string;
  published_at?: string;
}

interface Digest {
  id: number;
  topic: Topic;
  title: string;
  summary: string;
  content_hash?: string;
  source_items: DigestSource[];
  generated_at: string;
}

interface SubscriptionBriefsToolProps {
  canManage?: boolean;
}

const SUBSCRIPTION_PAGE_SIZE = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDigests(payload: unknown): Digest[] {
  const records = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.digests)
      ? payload.digests
      : isRecord(payload)
        ? [payload]
        : [];

  return records.flatMap(value => {
    if (!isRecord(value) || typeof value.summary !== 'string') return [];
    const sourceItems = Array.isArray(value.source_items)
      ? value.source_items.flatMap(source => {
        if (!isRecord(source) || typeof source.url !== 'string') return [];
        return [{
          id: typeof source.id === 'number' ? source.id : undefined,
          title: typeof source.title === 'string' && source.title ? source.title : source.url,
          url: source.url,
          source_name: typeof source.source_name === 'string' ? source.source_name : undefined,
          published_at: typeof source.published_at === 'string' ? source.published_at : undefined,
        }];
      })
      : [];

    return [{
      id: typeof value.id === 'number' ? value.id : 0,
      topic: value.topic === 'security' ? 'security' : 'ai',
      title: typeof value.title === 'string' && value.title ? value.title : 'Subscription digest',
      summary: value.summary,
      content_hash: typeof value.content_hash === 'string' ? value.content_hash : undefined,
      source_items: sourceItems,
      generated_at: typeof value.generated_at === 'string' ? value.generated_at : '',
    }];
  });
}

function formatDate(value: string, locale: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
}

export default function SubscriptionBriefsTool({ canManage = false }: SubscriptionBriefsToolProps) {
  const { locale, t } = useLocale();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [loading, setLoading] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [generatingTopic, setGeneratingTopic] = useState<DigestTopic | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
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
        setBriefs(data.map(brief => ({ ...brief, topic: brief.topic || 'ai' })));
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDigests() {
    setDigestLoading(true);
    try {
      const res = await fetch('/api/subscriptions/digests?topic=all&limit=20');
      if (res.ok) setDigests(parseDigests(await res.json()));
    } catch {
      // Digest loading is optional while older deployments are being upgraded.
    } finally {
      setDigestLoading(false);
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
      else await Promise.all([loadBriefs(), loadDigests()]);
    } catch {
      setErrorKey('apiErrorGeneric');
    } finally {
      setCrawling(false);
    }
  }

  async function generateDigests(topic: DigestTopic) {
    if (!canManage) return;
    setGeneratingTopic(topic);
    setErrorKey(null);
    try {
      const response = await fetch('/api/subscriptions/digests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      if (!response.ok) {
        await actionError(response);
        return;
      }
      const generated = parseDigests(await response.json());
      setDigests(current => {
        if (topic === 'all') return generated;
        return [...current.filter(digest => digest.topic !== topic), ...generated]
          .sort((a, b) => b.generated_at.localeCompare(a.generated_at));
      });
    } catch {
      setErrorKey('apiErrorGeneric');
    } finally {
      setGeneratingTopic(null);
    }
  }

  async function deleteBrief(id: number) {
    if (!confirm(t('subscriptionDeleteConfirm'))) return;
    await fetch(`/api/subscriptions/briefs?id=${id}`, { method: 'DELETE' });
    setBriefs(current => current.filter(brief => brief.id !== id));
  }

  useEffect(() => {
    void Promise.all([loadBriefs(), loadDigests()]);
  }, []);

  const sources = Array.from(new Set(briefs.map(brief => brief.source_name).filter(Boolean))).sort();
  const topicCounts = new Map<string, number>();
  for (const brief of briefs) {
    topicCounts.set(brief.topic, (topicCounts.get(brief.topic) || 0) + 1);
  }
  const filteredBriefs = briefs
    .filter(brief => (filter === 'all' ? true : brief.topic === filter))
    .filter(brief => (sourceFilter === 'all' ? true : brief.source_name === sourceFilter));
  const pagedBriefs = filteredBriefs.slice((page - 1) * SUBSCRIPTION_PAGE_SIZE, page * SUBSCRIPTION_PAGE_SIZE);

  if (loading) {
    return <div className="py-12 text-center text-gray-500">{t('loading')}</div>;
  }

  const digestButton = (topic: DigestTopic, label: TranslationKey, testId: string) => (
    <button
      type="button"
      data-testid={testId}
      onClick={() => void generateDigests(topic)}
      disabled={!canManage || generatingTopic !== null}
      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {generatingTopic === topic ? t('subscriptionDigestGenerating') : t(label)}
    </button>
  );

  return (
    <div className="space-y-6">
      {errorKey && (
        <div
          role="alert"
          data-testid="subscription-error"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {t(errorKey)}
        </div>
      )}

      <section data-testid="subscription-digests" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('subscriptionDigestTitle')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{t('subscriptionDigestDescription')}</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap justify-end gap-2">
              {digestButton('ai', 'subscriptionDigestAi', 'subscription-digest-generate-ai')}
              {digestButton('security', 'subscriptionDigestSecurity', 'subscription-digest-generate-security')}
              {digestButton('all', 'subscriptionDigestAll', 'subscription-digest-generate-all')}
            </div>
          )}
        </div>

        {digestLoading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">{t('loading')}</div>
        ) : digests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-3 py-5 text-sm text-slate-500">{t('subscriptionDigestEmpty')}</div>
        ) : (
          <div className="grid gap-3" data-testid="subscription-digest-list">
            {digests.map(digest => (
              <article
                key={`${digest.topic}-${digest.id}-${digest.content_hash || digest.generated_at}`}
                data-testid="subscription-digest-card"
                className="rounded-xl border border-slate-200 bg-white px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {digest.topic === 'security'
                          ? (locale === 'zh' ? '安全新闻主题摘要' : 'Security news digest')
                          : (locale === 'zh' ? 'AI 新闻主题摘要' : 'AI news digest')}
                      </h3>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${digest.topic === 'security' ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}>
                        {digest.topic === 'security' ? (locale === 'zh' ? '安全' : 'Security') : 'AI'}
                      </span>
                    </div>
                    {digest.generated_at && (
                      <p className="text-xs text-slate-400">
                        {t('subscriptionDigestGeneratedAt')}: {formatDate(digest.generated_at, locale)}
                      </p>
                    )}
                  </div>
                </div>
                <article className="prose prose-sm mt-3 max-w-none text-slate-700">
                  <ReactMarkdown>{digest.summary}</ReactMarkdown>
                </article>
                <details className="mt-3 text-sm text-slate-600" data-testid="subscription-digest-sources">
                  <summary className="cursor-pointer select-none font-medium hover:text-slate-900">
                    {t('subscriptionDigestSources')} ({digest.source_items.length})
                  </summary>
                  {digest.source_items.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-400">{t('subscriptionDigestNoSources')}</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5 border-l border-slate-200 pl-3">
                      {digest.source_items.slice(0, 8).map((source, index) => (
                        <li key={`${source.id ?? source.url}-${index}`} className="min-w-0">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {source.title}
                          </a>
                          <span className="block truncate text-xs text-slate-400">
                            {[source.source_name, source.published_at && formatDate(source.published_at, locale)].filter(Boolean).join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <section data-testid="subscription-raw-items" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('subscriptionRawItemsTitle')}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                data-testid="subscription-topic-filter"
                value={filter}
                onChange={event => {
                  setFilter(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
              >
                <option value="all">{t('all')}</option>
                <option value="ai">{locale === 'zh' ? 'AI 订阅' : 'AI'} ({topicCounts.get('ai') || 0})</option>
                <option value="security">{locale === 'zh' ? '安全订阅' : 'Security'} ({topicCounts.get('security') || 0})</option>
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
              <span className="text-xs text-gray-400">{filteredBriefs.length} {t('subscriptionBriefs')}</span>
            </div>
          </div>

          {canManage && (
            <button
              type="button"
              data-testid="subscription-crawl-all"
              onClick={() => void crawlAll()}
              disabled={crawling}
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {crawling ? t('subscriptionCrawling') : t('subscriptionCrawl')}
            </button>
          )}
        </div>

        {filteredBriefs.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
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
                        <span className={`rounded px-1.5 py-0.5 text-xs ${brief.topic === 'security' ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}>
                          {brief.topic === 'security'
                            ? (locale === 'zh' ? '安全订阅' : 'Security')
                            : (locale === 'zh' ? 'AI 订阅' : 'AI')}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{brief.category}</span>
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
                        <span>{formatDate(brief.fetched_at, locale)}</span>
                      </div>
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        data-testid="subscription-delete-brief"
                        onClick={() => void deleteBrief(brief.id)}
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
      </section>
    </div>
  );
}
