<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loading, Setting } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { AgentStep } from '@/types'
import SceneCard from './SceneCard.vue'
import SeverityCard from './SeverityCard.vue'
import LiabilityCard from './LiabilityCard.vue'
import ReportCard from './ReportCard.vue'

const props = defineProps<{
  steps: AgentStep[]
  expandedKey: string | null
}>()

const emit = defineEmits<{
  'update:expandedKey': [key: string | null]
  configureAgent: [agentKey: string]
}>()

const { t } = useI18n()
const mcpEnabled = inject<boolean>('mcpEnabled', false)

const tagType = (s: string): 'success' | 'warning' | 'danger' | 'info' =>
  s === 'finish' ? 'success' : s === 'process' ? 'warning' : s === 'error' ? 'danger' : 'info'

const tagText = (s: string): string => {
  const map: Record<string, string> = {
    wait: t('status.waiting'),
    process: t('status.analyzing'),
    finish: t('status.completed'),
    error: t('status.failed'),
  }
  return map[s] ?? s
}

/** Map step key to corresponding display component */
const displayComponent = (key: string): Component | null => {
  const map: Record<string, Component> = {
    vision: SceneCard,
    severity: SeverityCard,
    liability: LiabilityCard,
  }
  return map[key] ?? null
}

function toggle(key: string): void {
  emit('update:expandedKey', props.expandedKey === key ? null : key)
}
</script>

<template>
  <div class="agent-progress">
    <div
      v-for="step in steps"
      :key="step.key"
      class="step"
      :class="{ expanded: expandedKey === step.key }"
    >
      <div class="step-head" @click="toggle(step.key)">
        <span class="step-label">{{ step.label }}</span>
        <div class="step-head-right">
          <el-tag :type="tagType(step.status)" size="small" effect="light">
            <el-icon v-if="step.status === 'process'" class="is-loading"><Loading /></el-icon>
            {{ tagText(step.status) }}
          </el-tag>
          <el-tag
            v-for="sn in step.skillNames"
            :key="sn"
            size="small"
            type="warning"
            effect="plain"
            class="skill-tag"
          >
            {{ sn }}
          </el-tag>
          <el-icon v-if="step.data" class="toggle-icon" :class="{ rotated: expandedKey === step.key }">
            <svg viewBox="0 0 1024 1024" width="14" height="14">
              <path
                d="M340.864 341.312a42.667 42.667 0 0 1 56.939-2.24l3.413 2.88L682.667 600l-281.45 258.048a42.667 42.667 0 0 1-58.24-62.165l3.114-2.88L567.979 600 346.09 404.907a42.667 42.667 0 0 1-5.227-63.595z"
                fill="currentColor"
              />
            </svg>
          </el-icon>
          <el-icon
            v-if="mcpEnabled"
            class="gear-icon"
            :title="t('configMCP')"
            @click.stop="emit('configureAgent', step.key)"
          >
            <Setting />
          </el-icon>
        </div>
      </div>
      <!-- Expanded area: map key to corresponding display component -->
      <div v-if="expandedKey === step.key && step.data" class="step-body">
        <component
          v-if="displayComponent(step.key)"
          :is="displayComponent(step.key)"
          :data="step.data"
        />
        <ReportCard v-else-if="step.key === 'report'" :report="step.data" />
        <pre v-else class="step-data">{{ JSON.stringify(step.data, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.step {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.3s;
}
.step.expanded {
  border-color: var(--el-color-primary-light-3);
}
.step-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  background: var(--el-fill-color-lighter);
  transition: background 0.2s;
}
.step-head:hover {
  background: var(--el-fill-color-light);
}
.step-label {
  font-weight: 600;
  font-size: 14px;
}
.step-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toggle-icon {
  transition: transform 0.25s;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
}
.toggle-icon.rotated {
  transform: rotate(90deg);
}
.gear-icon {
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  transition: color 0.2s;
  display: flex;
  align-items: center;
}
.gear-icon:hover {
  color: var(--el-color-primary);
}
.step-body {
  padding: 0;
}
/* fallback raw JSON style */
.step-data {
  margin: 0;
  padding: 12px 14px;
  background: var(--el-bg-color);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow: auto;
}
</style>
