<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SeverityAssessment } from '@/types'

const props = defineProps<{ data: SeverityAssessment }>()

const { t } = useI18n()

const levelConfig = computed(() => {
  const map: Record<string, { text: string; type: 'success' | 'warning' | 'danger' }> = {
    minor: { text: t('severity.minor'), type: 'success' },
    moderate: { text: t('severity.moderate'), type: 'warning' },
    severe: { text: t('severity.severe'), type: 'danger' },
  }
  return map[props.data.level] ?? { text: t('severity.unknown'), type: 'danger' as const }
})

const confidencePercent = computed(() => Math.round(props.data.confidence * 100))
</script>

<template>
  <div class="severity-card">
    <!-- Severity level + confidence -->
    <div class="level-row">
      <div class="level-tag">
        <span class="level-label">{{ t('severity.level') }}</span>
        <el-tag :type="levelConfig.type" effect="dark" size="large">
          {{ levelConfig.text }}
        </el-tag>
      </div>
      <div class="confidence">
        <span class="level-label">{{ t('severity.confidence') }}</span>
        <el-progress
          :percentage="confidencePercent"
          :color="levelConfig.type === 'danger' ? '#f56c6c' : levelConfig.type === 'warning' ? '#e6a23c' : '#67c23a'"
          :stroke-width="16"
        />
      </div>
    </div>

    <!-- Detailed assessment -->
    <div class="section">
      <h4 class="section-title">{{ t('severity.detailedAssessment') }}</h4>
      <el-descriptions :column="1" size="small" border>
        <el-descriptions-item :label="t('severity.injuryRisk')">
          {{ data.injuryRisk || t('severity.fallback') }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('severity.propertyDamage')">
          {{ data.propertyDamage || t('severity.fallback') }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- Reasoning -->
    <div class="section">
      <h4 class="section-title">{{ t('severity.reasoning') }}</h4>
      <p class="reasoning-text">{{ data.reasoning || t('severity.fallback') }}</p>
    </div>
  </div>
</template>

<style scoped>
.severity-card {
  padding: 12px 14px;
  background: var(--el-bg-color);
}
.level-row {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.level-tag {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.level-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.confidence {
  flex: 1;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.section {
  margin-bottom: 14px;
}
.section:last-child {
  margin-bottom: 0;
}
.section-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.reasoning-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}
</style>
