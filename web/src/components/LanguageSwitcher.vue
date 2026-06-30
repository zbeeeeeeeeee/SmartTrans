<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { STORAGE_KEY } from '@/i18n'
import type { SupportedLanguage } from '@/i18n/types'
import { SUPPORTED_LANGUAGES } from '@/i18n/types'

const { locale } = useI18n()

const LANGUAGE_OPTIONS: { label: string; value: SupportedLanguage }[] = [
  { label: 'English', value: 'en' },
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
]

function setLocale(lang: SupportedLanguage) {
  locale.value = lang
  localStorage.setItem(STORAGE_KEY, lang)
}
</script>

<template>
  <el-select
    :model-value="(locale as SupportedLanguage)"
    @update:model-value="setLocale"
    class="locale-switcher"
    size="small"
  >
    <el-option
      v-for="opt in LANGUAGE_OPTIONS"
      :key="opt.value"
      :label="opt.label"
      :value="opt.value"
    />
  </el-select>
</template>

<style scoped>
.locale-switcher {
  width: 120px;
  margin-left: auto;
  flex-shrink: 0;
}
</style>
