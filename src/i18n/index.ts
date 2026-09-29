/**
 * Internationalisation configuration (#116, #282)
 * Supports English, Spanish, French, Chinese, Japanese, German, and Yoruba via react-i18next.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import de from './locales/de.json';
import yo from './locales/yo.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'de', label: 'Deutsch' },
  { code: 'yo', label: 'Yorùbá' },
] as const;

export type SupportedLang = (typeof SUPPORTED_LANGUAGES)[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      zh: { translation: zh },
      ja: { translation: ja },
      de: { translation: de },
      yo: { translation: yo },
    },
    fallbackLng: 'en',
    defaultNS: 'translation',
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'ph-lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
