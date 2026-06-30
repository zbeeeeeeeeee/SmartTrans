import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import type { SupportedLanguage } from './types'

export const elementLocales: Record<SupportedLanguage, typeof en> = {
  en,
  'zh-CN': zhCn,
  'zh-TW': zhTw,
}
