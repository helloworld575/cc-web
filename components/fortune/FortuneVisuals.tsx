import { type BaziResult, ELEMENT_COLOR } from '@/lib/bazi';
import { type HexagramResult, TRIGRAMS } from '@/lib/yijing';
import { useLocale } from '@/components/useLocale';

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: `${String(hour).padStart(2, '0')}:00`,
}));

export function PillarCard({
  title,
  pillar,
  accent,
}: {
  title: string;
  pillar: BaziResult['year'];
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border px-4 py-4 text-center shadow-sm ${
        accent
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-white/80 bg-white/95 text-slate-800'
      }`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${accent ? 'text-white/50' : 'text-slate-400'}`}>
        {title}
      </p>
      <div className="mt-3 text-3xl font-semibold">{pillar.stem}</div>
      <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs ${ELEMENT_COLOR[pillar.stemElement] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
        {pillar.stemElement}
      </div>
      <div className={`mx-auto my-4 h-px w-full ${accent ? 'bg-white/15' : 'bg-slate-100'}`} />
      <div className="text-3xl font-semibold">{pillar.branch}</div>
      <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs ${ELEMENT_COLOR[pillar.branchElement] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
        {pillar.branchElement}
      </div>
    </div>
  );
}

export function ElementBar({ elements }: { elements: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(elements).map(([element, count]) => (
        <span
          key={element}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${ELEMENT_COLOR[element] || 'border-slate-200 bg-slate-50 text-slate-600'}`}
        >
          {element} x {count}
        </span>
      ))}
    </div>
  );
}

export function BirthInputs({
  year,
  month,
  day,
  hour,
  onYear,
  onMonth,
  onDay,
  onHour,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  onYear: (value: number) => void;
  onMonth: (value: number) => void;
  onDay: (value: number) => void;
  onHour: (value: number) => void;
}) {
  const { t } = useLocale();
  const inputClassName =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100';

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('fortuneYear')}</span>
        <input
          type="number"
          value={year}
          onChange={event => onYear(Number(event.target.value))}
          className={inputClassName}
          min={1900}
          max={new Date().getFullYear()}
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('fortuneMonth')}</span>
        <select value={month} onChange={event => onMonth(Number(event.target.value))} className={inputClassName}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('fortuneDay')}</span>
        <select value={day} onChange={event => onDay(Number(event.target.value))} className={inputClassName}>
          {Array.from({ length: 31 }, (_, index) => index + 1).map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('fortuneHour')}</span>
        <select value={hour} onChange={event => onHour(Number(event.target.value))} className={inputClassName}>
          {HOURS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function HexagramDisplay({ result }: { result: HexagramResult }) {
  const { t } = useLocale();
  const upper = TRIGRAMS[result.upperBinary];
  const lower = TRIGRAMS[result.lowerBinary];

  return (
    <section className="rounded-[30px] border border-white/70 bg-white/95 px-5 py-5 shadow-sm animate-slide-up">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('fortuneHexagram')}</p>
          <h3 className="mt-2 font-display text-3xl text-slate-900">{result.hexagram.fullName}</h3>
          <p className="mt-2 text-sm text-slate-500">
            {t('fortuneUpperTrigram')} {upper.name} / {upper.element}，{t('fortuneLowerTrigram')} {lower.name} / {lower.element}
          </p>
          {result.transformed && (
            <p className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {t('fortuneChangedHexagram')} {result.transformed.fullName}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          {result.lines.slice().reverse().map((line, index) => {
            const lineIndex = result.lines.length - index - 1;
            const changing = result.changingLines.includes(lineIndex);
            const isYang = line === 7 || line === 9;

            return (
              <div key={`${line}-${lineIndex}`} className="flex items-center gap-3 text-sm">
                <span className="w-12 text-xs uppercase tracking-[0.18em] text-slate-400">L{lineIndex + 1}</span>
                <div className={`flex items-center gap-2 ${changing ? 'text-rose-600' : 'text-slate-800'}`}>
                  <span className={`hex-line ${isYang ? 'hex-line-yang' : 'hex-line-yin'}`} />
                  {changing && <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{t('fortuneChanging')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
