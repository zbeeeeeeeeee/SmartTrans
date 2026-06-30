export type SupportedLanguage = 'en' | 'zh-CN' | 'zh-TW'

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'zh-CN', 'zh-TW']

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
}
