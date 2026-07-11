'use client';
import { useEffect, useState } from 'react';
import { type BaziResult } from '@/lib/bazi';
import { type ZiweiResult } from '@/lib/ziwei';
import { type HexagramResult } from '@/lib/yijing';
import StreamingMarkdown from '@/components/StreamingMarkdown';
import { BirthInputs, ElementBar, HexagramDisplay, PillarCard } from '@/components/fortune/FortuneVisuals';
import { useLocale } from '@/components/useLocale';
import { apiErrorTranslationKey, readSafeApiError } from '@/lib/client-api-error';
import type { TranslationKey } from '@/lib/i18n';

type Method = 'bazi' | 'ziwei' | 'liuyao' | 'meihua';

interface HistoryEntry {
  id: number;
  method: Method;
  input: Record<string, unknown>;
  preflight: Record<string, unknown>;
  analysis: string;
  created_at: string;
}

const METHOD_META: Record<Method, { label: string; icon: string; description: TranslationKey }> = {
  bazi: {
    label: 'BaZi',
    icon: 'BZ',
    description: 'fortuneBaziDesc',
  },
  ziwei: {
    label: 'Ziwei',
    icon: 'ZW',
    description: 'fortuneZiweiDesc',
  },
  liuyao: {
    label: 'Liuyao',
    icon: 'LY',
    description: 'fortuneLiuyaoDesc',
  },
  meihua: {
    label: 'Meihua',
    icon: 'MH',
    description: 'fortuneMeihuaDesc',
  },
};

const BAZI_ASPECTS = [
  { value: '性格特质', label: 'fortuneAspectPersonality' },
  { value: '事业财运', label: 'fortuneAspectCareer' },
  { value: '婚恋感情', label: 'fortuneAspectRomance' },
  { value: '健康养生', label: 'fortuneAspectHealth' },
  { value: '流年运势', label: 'fortuneAspectAnnual' },
] as const satisfies ReadonlyArray<{ value: string; label: TranslationKey }>;
const ZIWEI_ASPECTS = [
  { value: '性格命格', label: 'fortuneAspectDestiny' },
  { value: '事业官禄', label: 'fortuneAspectOffice' },
  { value: '婚姻夫妻', label: 'fortuneAspectMarriage' },
  { value: '财富走势', label: 'fortuneAspectWealth' },
  { value: '大限流年', label: 'fortuneAspectDecade' },
] as const satisfies ReadonlyArray<{ value: string; label: TranslationKey }>;

export default function FortuneTool() {
  const { t } = useLocale();
  const [tab, setTab] = useState<'fortune' | 'history'>('fortune');
  const [method, setMethod] = useState<Method>('bazi');

  const [birthYear, setBirthYear] = useState(1990);
  const [birthMonth, setBirthMonth] = useState(6);
  const [birthDay, setBirthDay] = useState(15);
  const [birthHour, setBirthHour] = useState(8);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [baziAspect, setBaziAspect] = useState<string>(BAZI_ASPECTS[0].value);
  const [ziweiAspect, setZiweiAspect] = useState<string>(ZIWEI_ASPECTS[0].value);
  const [liuyaoMethod, setLiuyaoMethod] = useState<'random' | 'time'>('random');
  const [liuyaoQuestion, setLiuyaoQuestion] = useState('');
  const [meihuaMethod, setMeihuaMethod] = useState<'random' | 'time' | 'number'>('random');
  const [meihuaQuestion, setMeihuaQuestion] = useState('');
  const [meihuaNum1, setMeihuaNum1] = useState('');
  const [meihuaNum2, setMeihuaNum2] = useState('');

  const [bazi, setBazi] = useState<BaziResult | null>(null);
  const [ziwei, setZiwei] = useState<ZiweiResult | null>(null);
  const [hexagram, setHexagram] = useState<HexagramResult | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);

  useEffect(() => {
    if (tab !== 'history') return;

    setHistoryLoading(true);
    fetch('/api/fortune/history')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [tab]);

  function resetResults() {
    setBazi(null);
    setZiwei(null);
    setHexagram(null);
    setAnalysis('');
    setError('');
    setSavedToHistory(false);
  }

  async function saveToHistory(
    finalAnalysis: string,
    input: Record<string, unknown>,
    preflight: Record<string, unknown>
  ) {
    try {
      await fetch('/api/fortune/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: input.method,
          input,
          preflight,
          analysis: finalAnalysis,
        }),
      });
      setSavedToHistory(true);
      window.setTimeout(() => setSavedToHistory(false), 2200);
    } catch {
      return;
    }
  }

  async function deleteEntry(id: number) {
    if (!confirm(t('fortuneDeleteConfirm'))) return;

    const response = await fetch(`/api/fortune/history/${id}`, { method: 'DELETE' });
    if (!response.ok) return;

    setHistory(current => current.filter(entry => entry.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function calculate() {
    resetResults();
    setLoading(true);

    const body: Record<string, unknown> = { method };

    if (method === 'bazi') {
      Object.assign(body, {
        year: birthYear,
        month: birthMonth,
        day: birthDay,
        hour: birthHour,
        gender,
        aspect: baziAspect,
      });
    }

    if (method === 'ziwei') {
      Object.assign(body, {
        year: birthYear,
        month: birthMonth,
        day: birthDay,
        hour: birthHour,
        gender,
        aspect: ziweiAspect,
      });
    }

    if (method === 'liuyao') {
      Object.assign(body, {
        inputMethod: liuyaoMethod,
        question: liuyaoQuestion,
      });

      if (liuyaoMethod === 'time') {
        Object.assign(body, {
          year: birthYear,
          month: birthMonth,
          day: birthDay,
          hour: birthHour,
        });
      }
    }

    if (method === 'meihua') {
      Object.assign(body, {
        inputMethod: meihuaMethod,
        question: meihuaQuestion,
      });

      if (meihuaMethod === 'number') {
        Object.assign(body, {
          num1: meihuaNum1 ? Number(meihuaNum1) : undefined,
          num2: meihuaNum2 ? Number(meihuaNum2) : undefined,
        });
      }

      if (meihuaMethod === 'time') {
        Object.assign(body, {
          year: birthYear,
          month: birthMonth,
          day: birthDay,
          hour: birthHour,
        });
      }
    }

    let preflight: Record<string, unknown> = {};

    try {
      const response = await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const safe = await readSafeApiError(response, t('fortuneRequestFailed'));
        setError(t(apiErrorTranslationKey(safe.code, 'fortuneRequestFailed')));
        setLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError(t('fortuneStreamUnavailable'));
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) {
              const code = typeof payload.code === 'string' ? payload.code : null;
              setError(t(apiErrorTranslationKey(code, 'fortuneRequestFailed')));
              continue;
            }

            if (payload.bazi) {
              setBazi(payload.bazi);
              preflight = { bazi: payload.bazi };
              continue;
            }

            if (payload.ziwei) {
              setZiwei(payload.ziwei);
              preflight = { ziwei: payload.ziwei };
              continue;
            }

            if (payload.hexagram) {
              setHexagram(payload.hexagram);
              preflight = { hexagram: payload.hexagram };
              continue;
            }

            if (payload.text) {
              accumulated += payload.text;
              setAnalysis(accumulated);
            }
          } catch {
            continue;
          }
        }
      }

      if (accumulated) {
        await saveToHistory(accumulated, body, preflight);
      }
    } catch {
      setError(t('fortuneNetworkError'));
    } finally {
      setLoading(false);
    }
  }

  const generationStage = (() => {
    if (!loading) return 'idle';
    if (!bazi && !ziwei && !hexagram) return 'chart';
    if (!analysis) return 'context';
    return 'writing';
  })();

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="glass-panel rounded-[32px] px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('fortuneStudio')}</p>
        <h2 className="mt-2 font-display text-4xl text-slate-950">{t('fortuneTitle')}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {t('fortuneStudioDesc')}
        </p>

        <div className="mt-6 flex rounded-[24px] border border-white/70 bg-white/90 p-1 shadow-sm">
          {([
            ['fortune', t('fortuneReading')],
            ['history', t('fortuneHistory')],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              data-testid={`fortune-tab-${value}`}
              onClick={() => setTab(value)}
              className={`flex-1 rounded-[20px] px-4 py-3 text-sm font-semibold transition ${
                tab === value
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'fortune' && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-2">
              {(Object.entries(METHOD_META) as [Method, (typeof METHOD_META)[Method]][]).map(([value, meta], index) => (
                <button
                  key={value}
                  data-testid={`fortune-method-${value}`}
                  onClick={() => {
                    setMethod(value);
                    resetResults();
                  }}
                  className={`rounded-[24px] border px-4 py-4 text-left transition animate-slide-up ${
                    method === value
                      ? 'border-amber-300 bg-amber-50 shadow-sm'
                      : 'border-white/70 bg-white/88 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-sm'
                  }`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold tracking-[0.2em] text-white">
                      {meta.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{t(meta.description)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/95 px-4 py-4 shadow-sm">
              {(method === 'bazi' || method === 'ziwei') && (
                <>
                  <BirthInputs
                    year={birthYear}
                    month={birthMonth}
                    day={birthDay}
                    hour={birthHour}
                    onYear={setBirthYear}
                    onMonth={setBirthMonth}
                    onDay={setBirthDay}
                    onHour={setBirthHour}
                  />

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {([
                      ['male', t('fortuneMale')],
                      ['female', t('fortuneFemale')],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setGender(value)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          gender === value
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {method === 'bazi' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {BAZI_ASPECTS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setBaziAspect(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        baziAspect === option.value
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              )}

              {method === 'ziwei' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {ZIWEI_ASPECTS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setZiweiAspect(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        ziweiAspect === option.value
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              )}

              {method === 'liuyao' && (
                <div className="mt-1 space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ['random', t('fortuneRandomCast')],
                      ['time', t('fortuneTimeCast')],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setLiuyaoMethod(value)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          liuyaoMethod === value
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {liuyaoMethod === 'time' && (
                    <BirthInputs
                      year={birthYear}
                      month={birthMonth}
                      day={birthDay}
                      hour={birthHour}
                      onYear={setBirthYear}
                      onMonth={setBirthMonth}
                      onDay={setBirthDay}
                      onHour={setBirthHour}
                    />
                  )}
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('fortuneQuestion')}</span>
                    <input
                      value={liuyaoQuestion}
                      onChange={event => setLiuyaoQuestion(event.target.value)}
                      placeholder={t('fortuneQuestionPlaceholder')}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                </div>
              )}

              {method === 'meihua' && (
                <div className="mt-1 space-y-4">
                  <div className="grid gap-2">
                    {([
                      ['random', t('fortuneRandom')],
                      ['time', t('fortuneTime')],
                      ['number', t('fortuneNumbers')],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setMeihuaMethod(value)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          meihuaMethod === value
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {meihuaMethod === 'time' && (
                    <BirthInputs
                      year={birthYear}
                      month={birthMonth}
                      day={birthDay}
                      hour={birthHour}
                      onYear={setBirthYear}
                      onMonth={setBirthMonth}
                      onDay={setBirthDay}
                      onHour={setBirthHour}
                    />
                  )}

                  {meihuaMethod === 'number' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('fortuneUpperNumber')}</span>
                        <input
                          value={meihuaNum1}
                          onChange={event => setMeihuaNum1(event.target.value)}
                          type="number"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('fortuneLowerNumber')}</span>
                        <input
                          value={meihuaNum2}
                          onChange={event => setMeihuaNum2(event.target.value)}
                          type="number"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                        />
                      </label>
                    </div>
                  )}

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('fortuneQuestion')}</span>
                    <input
                      value={meihuaQuestion}
                      onChange={event => setMeihuaQuestion(event.target.value)}
                      placeholder={t('fortuneQuestionPlaceholder')}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                </div>
              )}

              <button
                data-testid="fortune-start"
                onClick={calculate}
                disabled={loading}
                className="mt-5 w-full rounded-[22px] bg-amber-500 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-400 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? t('fortuneGenerating') : t('fortuneStart')}
              </button>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {savedToHistory && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 animate-fade-in">
                  {t('fortuneSaved')}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="mt-6">
            {historyLoading && (
              <div className="rounded-[28px] border border-white/70 bg-white/90 px-5 py-8 text-center text-sm text-slate-500">
                {t('fortuneLoadingHistory')}
              </div>
            )}

            {!historyLoading && history.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-5 py-8 text-center">
                <p className="font-display text-3xl text-slate-900">{t('fortuneNoHistory')}</p>
                <p className="mt-3 text-sm text-slate-500">{t('fortuneEmptyDesc')}</p>
              </div>
            )}

            {!historyLoading && history.length > 0 && (
              <div className="space-y-3">
                {history.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="rounded-[26px] border border-white/70 bg-white/92 shadow-sm animate-slide-up"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <button
                      onClick={() => setExpandedId(current => (current === entry.id ? null : entry.id))}
                      className="flex w-full items-start gap-4 px-4 py-4 text-left"
                    >
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold tracking-[0.2em] text-white">
                        {METHOD_META[entry.method].icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{METHOD_META[entry.method].label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                          {new Date(entry.created_at).toLocaleString()}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{entry.analysis}</p>
                      </div>
                      <span className={`mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 transition ${expandedId === entry.id ? 'rotate-180' : ''}`}>
                        {t('fortuneOpen')}
                      </span>
                    </button>

                    {expandedId === entry.id && (
                      <div className="border-t border-slate-100 px-4 py-4">
                        <StreamingMarkdown content={entry.analysis} />
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-600 transition hover:bg-red-50"
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      <section className="space-y-5">
        {tab === 'fortune' && (
          <>
            <section className="glass-panel rounded-[32px] px-5 py-5">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {METHOD_META[method].label}
                  </p>
                  <h3 className="mt-2 font-display text-4xl text-slate-950">{t('fortuneCanvas')}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{t(METHOD_META[method].description)}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    [t('fortuneStageChart'), generationStage === 'chart' || generationStage === 'context' || generationStage === 'writing'],
                    [t('fortuneStageContext'), generationStage === 'context' || generationStage === 'writing'],
                    [t('fortuneStageWriting'), generationStage === 'writing'],
                  ] as const).map(([title, active], index) => (
                    <div
                      key={title}
                      className={`rounded-[22px] border px-4 py-4 transition ${
                        active ? 'border-amber-200 bg-amber-50' : 'border-white/70 bg-white/90'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                          active ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{title}</p>
                          <p className="text-xs text-slate-500">
                            {active ? t('fortuneStageActive') : t('fortuneStageWaiting')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {loading && (
                <div className="mt-6 rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,247,237,0.92))] px-5 py-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700/60">{t('fortuneGeneration')}</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {generationStage === 'chart' && t('fortunePreparingChart')}
                        {generationStage === 'context' && t('fortuneBuildingContext')}
                        {generationStage === 'writing' && t('fortuneStreamingInterpretation')}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {t('fortuneGenerationDesc')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
                      <span className="h-3 w-3 rounded-full bg-amber-500/70 animate-pulse delay-150" />
                      <span className="h-3 w-3 rounded-full bg-amber-600/55 animate-pulse delay-300" />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {bazi && (
              <section className="glass-panel rounded-[32px] px-5 py-5 animate-slide-up">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('fortuneChart')}</p>
                    <h3 className="mt-2 font-display text-3xl text-slate-950">{t('fortuneBaziPillars')}</h3>
                  </div>
                  <ElementBar elements={bazi.elements} />
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-4">
                  <PillarCard title={t('fortuneYear')} pillar={bazi.year} />
                  <PillarCard title={t('fortuneMonth')} pillar={bazi.month} />
                  <PillarCard title={t('fortuneDay')} pillar={bazi.day} accent />
                  <PillarCard title={t('fortuneHour')} pillar={bazi.hour} />
                </div>

                <div className="mt-5 rounded-[24px] border border-white/70 bg-white/90 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('fortuneDayMaster')}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {bazi.dayMaster} <span className="text-sm text-slate-500">{bazi.dayMasterElement}</span>
                  </p>
                </div>
              </section>
            )}

            {ziwei && (
              <section className="glass-panel rounded-[32px] px-5 py-5 animate-slide-up">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('fortuneConstellation')}</p>
                    <h3 className="mt-2 font-display text-3xl text-slate-950">{t('fortuneZiweiLayout')}</h3>
                  </div>
                  <div className="rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
                    {ziwei.wuxingJu.name} · {ziwei.nayinName}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-white/70 bg-white/92 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t('fortuneLifePalace')}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{ziwei.mingGongBranch}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/70 bg-white/92 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t('fortuneBodyPalace')}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{ziwei.shenGongBranch}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {ziwei.palaces.map(palace => (
                    <div
                      key={`${palace.name}-${palace.branch}`}
                      className={`rounded-[22px] border px-4 py-4 text-sm ${
                        palace.name === '命宫'
                          ? 'border-amber-200 bg-amber-50'
                          : palace.name === '官禄'
                            ? 'border-sky-200 bg-sky-50'
                            : 'border-white/70 bg-white/90'
                      }`}
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{palace.branch}</p>
                      <p className="mt-2 font-semibold text-slate-800">{palace.name}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {hexagram && <HexagramDisplay result={hexagram} />}

            {(analysis || loading) && (
              <section className="glass-panel rounded-[32px] px-5 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('fortuneInterpretation')}</p>
                    <h3 className="mt-2 font-display text-3xl text-slate-950">{t('fortuneGeneratedAnalysis')}</h3>
                  </div>
                  {loading && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                      {t('fortuneStreaming')}
                    </span>
                  )}
                </div>

                {analysis ? (
                  <div data-testid="fortune-analysis" className="mt-5 rounded-[28px] border border-white/70 bg-white/92 px-5 py-5 shadow-sm">
                    <StreamingMarkdown content={analysis} streaming={loading} />
                  </div>
                ) : (
                  <div className="mt-5 rounded-[28px] border border-white/70 bg-white/92 px-5 py-5">
                    <div className="space-y-3">
                      <div className="skeleton-line w-32" />
                      <div className="skeleton-line w-full" />
                      <div className="skeleton-line w-5/6" />
                      <div className="skeleton-line w-4/6" />
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </section>
    </div>
  );
}
