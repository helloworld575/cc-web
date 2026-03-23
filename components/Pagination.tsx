'use client';
import { useLocale } from '@/components/useLocale';

interface Props {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
}

export default function Pagination({ total, page, pageSize, onPage }: Props) {
  const { t } = useLocale();
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  // Build windowed page list: always show first, last, and window around current
  const window = 2;
  const visible = new Set<number>();
  visible.add(1);
  visible.add(pages);
  for (let i = Math.max(1, page - window); i <= Math.min(pages, page + window); i++) visible.add(i);
  const sorted = Array.from(visible).sort((a, b) => a - b);

  const buttons: (number | 'gap')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) buttons.push('gap');
    buttons.push(p);
    prev = p;
  }

  return (
    <div className="flex gap-1 mt-6 items-center justify-center text-sm flex-wrap">
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        className="px-3 py-1 border rounded disabled:opacity-40">{t('prev')}</button>
      {buttons.map((b, i) =>
        b === 'gap'
          ? <span key={`gap-${i}`} className="px-1 text-gray-400">…</span>
          : <button key={b} onClick={() => onPage(b)}
              className={`px-3 py-1 border rounded ${b === page ? 'bg-black text-white' : ''}`}>{b}</button>
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === pages}
        className="px-3 py-1 border rounded disabled:opacity-40">{t('next')}</button>
    </div>
  );
}
