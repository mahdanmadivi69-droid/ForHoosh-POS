// src/components/LanguageSelector.tsx
import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { SUPPORTED_LOCALES, SupportedLocale } from '../i18n/translations';

export const LanguageSelector: React.FC = () => {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700/60 rounded-lg p-1 text-xs">
      {(Object.keys(SUPPORTED_LOCALES) as SupportedLocale[]).map((code) => {
        const item = SUPPORTED_LOCALES[code];
        const isActive = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all font-medium ${
              isActive
                ? 'bg-[#D71921] text-white shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title={item.label}
          >
            <span>{item.flag}</span>
            <span className="uppercase font-mono tracking-wider">{code}</span>
          </button>
        );
      })}
    </div>
  );
};
