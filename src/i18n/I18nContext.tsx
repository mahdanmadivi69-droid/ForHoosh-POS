// src/i18n/I18nContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SupportedLocale,
  TextDirection,
  SUPPORTED_LOCALES,
  dictionary,
  TranslationSchema,
} from './translations';

export interface I18nContextType {
  locale: SupportedLocale;
  dir: TextDirection;
  setLocale: (nextLocale: SupportedLocale) => void;
  t: TranslationSchema;
  interpolate: (template: string, params: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'karwand_preferred_locale';

export const I18nProvider: React.FC<{
  children: React.ReactNode;
  defaultLocale?: SupportedLocale;
}> = ({ children, defaultLocale = 'en' }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLocale;
      if (saved && SUPPORTED_LOCALES[saved]) return saved;
    }
    return defaultLocale;
  });

  const dir = SUPPORTED_LOCALES[locale].dir;

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    if (SUPPORTED_LOCALES[nextLocale]) {
      setLocaleState(nextLocale);
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, nextLocale);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
    }
  }, [locale, dir]);

  // Interpolation helper for string variables like {table} or {code}
  const interpolate = useCallback(
    (template: string, params: Record<string, string | number>): string => {
      return template.replace(/\{(\w+)\}/g, (_, key) =>
        params[key] !== undefined ? String(params[key]) : `{${key}}`
      );
    },
    []
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        dir,
        setLocale,
        t: dictionary[locale] as TranslationSchema,
        interpolate,
      }}
    >
      <div dir={dir} className="w-full h-full">
        {children}
      </div>
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
