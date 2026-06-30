<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SceneDescription } from '@/types'

const props = defineProps<{ data: SceneDescription }>()

const { t } = useI18n()

const columns = computed(() => [
  { key: 'type', label: t('scene.type'), width: '100' },
  { key: 'color', label: t('scene.color'), width: '80' },
  { key: 'position', label: t('scene.position'), width: '120' },
  { key: 'visibleDamage', label: t('scene.visibleDamage'), minWidth: '140' },
])
</script>

<template>
  <div class="scene-card">
    <!-- Traffic participants -->
    <div class="section">
      <h4 class="section-title">{{ t('scene.participants') }}</h4>
      <el-table
        v-if="data.vehicles?.length"
        :data="data.vehicles"
        size="small"
        border
        stripe
        class="scene-table"
      >
        <el-table-column
          v-for="col in columns"
          :key="col.key"
          :prop="col.key"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
        />
      </el-table>
      <el-empty v-else :description="t('scene.noVehicles')" :image-size="48" />
    </div>

    <!-- Environment -->
    <div class="section">
      <h4 class="section-title">{{ t('scene.environment') }}</h4>
      <el-descriptions :column="1" size="small" border class="env-desc">
        <el-descriptions-item :label="t('scene.roadCondition')">
          {{ data.roadCondition || t('scene.fallback') }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('scene.weatherLighting')">
          {{ data.weather || t('scene.fallback') }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('scene.trafficSignals')">
          {{ data.trafficSignals || t('scene.fallback') }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- Scene summary -->
    <div class="section">
      <h4 class="section-title">{{ t('scene.summary') }}</h4>
      <p class="summary-text">{{ data.sceneSummary || t('scene.fallback') }}</p>
    </div>
  </div>
</template>

<style scoped>
.scene-card {
  padding: 12px 14px;
  background: var(--el-bg-color);
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
.scene-table {
  width: 100%;
}
.env-desc {
  font-size: 12px;
}
.summary-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}
</style>
