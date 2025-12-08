/**
 * Internationalization Setup
 * i18next configuration for flow designer
 * @module lang
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './zh_CN.json';
import en from './en.json';

// ============================================================================
// Resources
// ============================================================================

const resources = {
  zh_CN: {
    translation: zhCN,
  },
  en: {
    translation: en,
  },
};

// ============================================================================
// Type Definitions
// ============================================================================

export type SupportedLanguage = 'zh_CN' | 'en';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Initialize i18n for flow designer
 */
export function initFlowI18n(lng: SupportedLanguage = 'zh_CN') {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      ns: ['translation'],
      defaultNS: 'translation',
    });
  } else {
    i18n.changeLanguage(lng);
  }
  
  return i18n;
}

/**
 * Change language
 */
export function changeLanguage(lng: SupportedLanguage) {
  return i18n.changeLanguage(lng);
}

/**
 * Get current language
 */
export function getCurrentLanguage(): string {
  return i18n.language;
}

/**
 * Add custom translations
 */
export function addTranslations(lng: string, translations: Record<string, unknown>) {
  i18n.addResourceBundle(lng, 'translation', translations, true, true);
}

// ============================================================================
// Exports
// ============================================================================

export { i18n, resources };
export { useTranslation } from 'react-i18next';

export default initFlowI18n;
