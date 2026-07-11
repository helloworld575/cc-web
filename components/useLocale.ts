'use client';

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createTranslator, LocaleContext } from '@/components/LocaleProvider';
import { localeToHtmlLang, resolveLocale, type Locale } from '@/lib/i18n';

function readClientLocale() {
  if (typeof document === 'undefined') return 'en';
  return resolveLocale(document.cookie.match(/(?:^|;\s*)locale=([^;]+)/)?.[1]);
}

export function useLocale() {
  const context = useContext(LocaleContext);
  const [fallbackLocale, setFallbackLocale] = useState<Locale>('en');

  useEffect(() => {
    if (!context) {
      const locale = readClientLocale();
      setFallbackLocale(locale);
      document.documentElement.lang = localeToHtmlLang(locale);
    }
  }, [context]);

  const setFallback = useCallback((locale: Locale) => {
    setFallbackLocale(locale);
    document.cookie = `locale=${locale};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = localeToHtmlLang(locale);
  }, []);
  const fallbackToggle = useCallback(() => {
    setFallback(fallbackLocale === 'en' ? 'zh' : 'en');
  }, [fallbackLocale, setFallback]);
  const fallbackTranslator = useMemo(() => createTranslator(fallbackLocale), [fallbackLocale]);

  return context ?? {
    locale: fallbackLocale,
    setLocale: setFallback,
    toggle: fallbackToggle,
    t: fallbackTranslator,
  };
}
