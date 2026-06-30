<script setup lang="ts">
import { computed, ref, onMounted, provide, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Van } from '@element-plus/icons-vue'
import { getMcpStatus } from '@/api/client'
import { elementLocales } from '@/i18n/element-locales'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import type { SupportedLanguage } from '@/i18n/types'

const { t, locale } = useI18n()
const route = useRoute()
const active = computed(() => route.path)

const mcpEnabled = ref(false)
provide('mcpEnabled', mcpEnabled)

const elLocale = computed(() => elementLocales[locale.value as SupportedLanguage])

// Keep document title in sync with current language
watch(
  locale,
  (lang) => {
    document.documentElement.lang = lang
    document.title = t('app.htmlTitle')
  },
  { immediate: true },
)

onMounted(async () => {
  try {
    const status = await getMcpStatus()
    mcpEnabled.value = status.mcpEnabled
  } catch {
    // Silently hide MCP nav item on fetch failure
  }
})
</script>

<template>
  <el-config-provider :locale="elLocale">
    <el-container class="app">
      <el-header class="header">
        <div class="brand">
          <el-icon :size="22"><Van /></el-icon>
          <span>{{ t('app.title') }}</span>
        </div>
        <el-menu
          :default-active="active"
          mode="horizontal"
          router
          :ellipsis="false"
          class="nav"
        >
          <el-menu-item index="/">{{ t('nav.analyze') }}</el-menu-item>
          <el-menu-item index="/history">{{ t('nav.history') }}</el-menu-item>
          <el-menu-item index="/knowledge">{{ t('nav.knowledge') }}</el-menu-item>
          <el-menu-item index="/skills">{{ t('nav.skills') }}</el-menu-item>
          <el-menu-item v-if="mcpEnabled" index="/mcp">{{ t('nav.mcp') }}</el-menu-item>
        </el-menu>
        <LanguageSwitcher />
      </el-header>
      <el-main>
        <router-view v-slot="{ Component }">
          <keep-alive include="AnalyzeView">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </el-main>
    </el-container>
  </el-config-provider>
</template>

<style>
body {
  margin: 0;
}
.app {
  min-height: 100vh;
}
.header {
  display: flex;
  align-items: center;
  gap: 24px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--el-color-primary);
}
.nav {
  border-bottom: none !important;
}
.el-main {
  background: var(--el-bg-color-page);
}
</style>
