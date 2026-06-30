import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zhCN from './locales/zh-CN'
import zhTW from './locales/zh-TW'
import type { SupportedLanguage } from './types'
import { DEFAULT_LANGUAGE, isValidLanguage } from './types'

export const STORAGE_KEY = 'smarttrans-language'

function getStoredLanguage(): SupportedLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isValidLanguage(stored)) return stored
  } catch {
    /* localStorage not available */
  }
  return DEFAULT_LANGUAGE
}

const i18n = createI18n({
  legacy: false,
  locale: getStoredLanguage(),
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
  },
})

export { i18n }
export type { SupportedLanguage }
export { DEFAULT_LANGUAGE, isValidLanguage } from './types'
