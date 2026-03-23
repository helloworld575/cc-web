'use client';
import { useLocale } from '@/components/useLocale';

interface Props {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onReset: () => void;
}

export default function DateRangeFilter({ from, to, onFrom, onTo, onReset }: Props) {
  const { t } = useLocale();
  const active = from || to;
  return (
    <div className={`flex flex-wrap gap-2 items-center mb-4 px-3 py-2 rounded-lg border text-sm transition-colors ${active ? 'border-black bg-gray-50 dark:bg-gray-900 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'}`}>
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="text-gray-500 text-xs font-medium">{t('dateFrom')}</span>
      <input type="date" value={from} onChange={e => onFrom(e.target.value)}
        className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black dark:bg-transparent dark:border-gray-600" />
      <span className="text-gray-300">→</span>
      <span className="text-gray-500 text-xs font-medium">{t('dateTo')}</span>
      <input type="date" value={to} onChange={e => onTo(e.target.value)}
        className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black dark:bg-transparent dark:border-gray-600" />
      {active && (
        <button onClick={onReset} className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-black transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {t('dateReset')}
        </button>
      )}
    </div>
  );
}
