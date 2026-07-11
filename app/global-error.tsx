'use client';

import { useLocale } from '@/components/useLocale';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const { locale, t } = useLocale();

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <body>
        <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <h2>{t('errorTitle')}</h2>
          <p>{error.message || t('errorDesc')}</p>
          <button onClick={reset} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}>
            {t('retry')}
          </button>
        </div>
      </body>
    </html>
  );
}
