'use client';

import { createContext, useCallback, useMemo, useState } from 'react';
import {
  localeToHtmlLang,
  translations,
  type Locale,
  type TranslationKey,
} from '@/lib/i18n';

export type TranslationValues = Record<string, string | number>;

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggle: () => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
}

export const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function interpolate(message: string, values?: TranslationValues) {
  if (!values) return message;
  return message.replace(/\{(\w+)}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  );
}

export function createTranslator(locale: Locale) {
  return (key: TranslationKey, values?: TranslationValues) =>
    interpolate(translations[locale][key] ?? translations.en[key] ?? key, values);
}

export default function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    document.cookie = `locale=${nextLocale};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = localeToHtmlLang(nextLocale);
  }, []);

  const toggle = useCallback(() => {
    setLocale(locale === 'en' ? 'zh' : 'en');
  }, [locale, setLocale]);

  const t = useMemo(() => createTranslator(locale), [locale]);
  const value = useMemo(() => ({ locale, setLocale, toggle, t }), [locale, setLocale, toggle, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
