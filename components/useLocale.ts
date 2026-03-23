'use client';
import { useState, useEffect, useCallback } from 'react';
import { translations, type Locale, type TranslationKey } from '@/lib/i18n';

const COOKIE = 'locale';

function getCookie(): Locale {
  if (typeof document === 'undefined') return 'en';
  const m = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  return (m?.[1] as Locale) ?? 'en';
}

function setCookie(locale: Locale) {
  document.cookie = `${COOKIE}=${locale};path=/;max-age=31536000`;
}

// Global state so all components re-render together
type Listener = (l: Locale) => void;
const listeners = new Set<Listener>();
let current: Locale = 'en';

export function setLocale(locale: Locale) {
  current = locale;
  setCookie(locale);
  listeners.forEach(l => l(locale));
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const initial = getCookie();
    current = initial;
    setLocaleState(initial);
    listeners.add(setLocaleState);
    return () => { listeners.delete(setLocaleState); };
  }, []);

  const toggle = useCallback(() => setLocale(locale === 'en' ? 'zh' : 'en'), [locale]);

  const t = useCallback(
    (key: TranslationKey) => translations[locale][key] ?? translations.en[key] ?? key,
    [locale]
  );

  return { locale, setLocale, toggle, t };
}
