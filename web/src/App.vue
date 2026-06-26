<script setup lang="ts">
import { computed, ref, onMounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import { Van } from '@element-plus/icons-vue'
import { getMcpStatus } from '@/api/client'

const route = useRoute()
const active = computed(() => route.path)

const mcpEnabled = ref(false)
provide('mcpEnabled', mcpEnabled)

onMounted(async () => {
  try {
    const status = await getMcpStatus()
    mcpEnabled.value = status.mcpEnabled
  } catch {
    // 获取失败时默认隐藏
  }
})
</script>

<template>
  <el-container class="app">
    <el-header class="header">
      <div class="brand">
        <el-icon :size="22"><Van /></el-icon>
        <span>SmartTrans · 交通事故识别多智能体系统</span>
      </div>
      <el-menu :default-active="active" mode="horizontal" router :ellipsis="false" class="nav">
        <el-menu-item index="/">事故分析</el-menu-item>
        <el-menu-item index="/history">历史报告</el-menu-item>
        <el-menu-item index="/knowledge">法规知识库</el-menu-item>
        <el-menu-item v-if="mcpEnabled" index="/mcp">MCP设置</el-menu-item>
      </el-menu>
    </el-header>
    <el-main>
      <router-view v-slot="{ Component }">
        <keep-alive include="AnalyzeView">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </el-main>
  </el-container>
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
