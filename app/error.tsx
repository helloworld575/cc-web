'use client';

import { useLocale } from '@/components/useLocale';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useLocale();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">{t('errorTitle')}</h2>
      <p className="text-gray-500">{error.message || t('errorDesc')}</p>
      <button onClick={reset} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        {t('retry')}
      </button>
    </div>
  );
}
