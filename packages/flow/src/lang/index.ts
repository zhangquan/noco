/**
 * Internationalization Setup
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh_CN from './zh_CN.json';

// Export language resources
export const resources = {
  en: { translation: en },
  zh_CN: { translation: zh_CN },
};

// Available locales
export const locales = [
  { code: 'en', name: 'English' },
  { code: 'zh_CN', name: '简体中文' },
] as const;

export type LocaleCode = (typeof locales)[number]['code'];

/**
 * Initialize i18n
 */
export function initI18n(lng: LocaleCode = 'en') {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
  } else {
    i18n.changeLanguage(lng);
  }
  
  return i18n;
}

/**
 * Change language
 */
export function changeLanguage(lng: LocaleCode) {
  i18n.changeLanguage(lng);
}

/**
 * Get current language
 */
export function getCurrentLanguage(): LocaleCode {
  return i18n.language as LocaleCode;
}

// Export i18n instance
export { i18n };
