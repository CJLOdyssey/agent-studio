import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh-CN.json';
import en from './locales/en-US.json';

const saved = typeof window !== 'undefined' ? localStorage.getItem('language') : null;

const LANG_TO_HTML: Record<string, string> = {
  'zh-CN': 'zh-CN',
  'en-US': 'en',
};

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zh },
    'en-US': { translation: en },
  },
  lng: saved || 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false,
    prefix: '{{',
    suffix: '}}',
  },
});

// Sync HTML lang attribute on init
if (typeof document !== 'undefined') {
  document.documentElement.lang = LANG_TO_HTML[i18n.language] || i18n.language;
}

export function changeLanguage(lng: string) {
  localStorage.setItem('language', lng);
  i18n.changeLanguage(lng);
  // Dynamically update HTML lang for SEO and screen readers
  if (typeof document !== 'undefined') {
    document.documentElement.lang = LANG_TO_HTML[lng] || lng;
  }
}

export function getCurrentLanguage(): string {
  return i18n.language;
}

export default i18n;
