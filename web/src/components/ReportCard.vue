<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { workspaceFileUrl } from '@/api/client'
import type { AccidentReportView } from '@/types'

const props = defineProps<{ report: AccidentReportView; images?: string[]; reportId?: string }>()

const { t } = useI18n()

const imageSrcList = computed(() =>
  (props.images ?? []).map((img) =>
    props.reportId ? workspaceFileUrl(props.reportId, img) : `/uploads/${img}`,
  ),
)

const level = computed(() => {
  const map: Record<string, { text: string; type: 'success' | 'warning' | 'danger' | 'info' }> = {
    minor: { text: t('severity.minor'), type: 'success' },
    moderate: { text: t('severity.moderate'), type: 'warning' },
    severe: { text: t('severity.severe'), type: 'danger' },
  }
  return map[props.report.severityLevel ?? ''] ?? { text: t('severity.unknown'), type: 'info' as const }
})
</script>

<template>
  <el-card shadow="never" class="report-card">
    <template #header>
      <div class="report-header">
        <span class="report-title">{{ report.title || t('report.title') }}</span>
        <el-tag :type="level.type" effect="dark">{{ t('report.severityLabel') }}{{ level.text }}</el-tag>
      </div>
    </template>

    <div v-if="images && images.length" class="report-images">
      <el-image
        v-for="(img, i) in images"
        :key="img"
        :src="imageSrcList[i]"
        :preview-src-list="imageSrcList"
        fit="cover"
        class="thumb"
      />
    </div>

    <el-descriptions :column="1" border class="report-desc">
      <el-descriptions-item v-if="report.generatedAt" :label="t('report.generatedAt')">
        {{ report.generatedAt }}
      </el-descriptions-item>
      <el-descriptions-item v-if="report.location" :label="t('report.location')">
        {{ report.location }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('report.summary')">{{ report.summary || t('report.fallback') }}</el-descriptions-item>
      <el-descriptions-item :label="t('report.sceneSituation')">{{ report.sceneSummary || t('report.fallback') }}</el-descriptions-item>
      <el-descriptions-item :label="t('report.liabilityDetermination')">
        {{ report.liabilityConclusion || t('report.fallback') }}
      </el-descriptions-item>
    </el-descriptions>

    <div v-if="report.citedArticles?.length" class="report-section">
      <h4>{{ t('report.citedArticles') }}</h4>
      <div
        v-for="(a, i) in report.citedArticles"
        :key="i"
        class="article-item"
      >
        <div class="article-citation">{{ typeof a === 'string' ? a : a.citation }}</div>
        <div v-if="typeof a === 'object' && a.content" class="article-content">{{ a.content }}</div>
      </div>
    </div>

    <div v-if="report.recommendations?.length" class="report-section">
      <h4>{{ t('report.recommendations') }}</h4>
      <ul class="rec-list">
        <li v-for="(r, i) in report.recommendations" :key="i">{{ r }}</li>
      </ul>
    </div>
  </el-card>
</template>

<style scoped>
.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.report-title {
  font-size: 16px;
  font-weight: 700;
}
.report-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.thumb {
  width: 96px;
  height: 96px;
  border-radius: 6px;
}
.report-section {
  margin-top: 16px;
}
.report-section h4 {
  margin: 0 0 8px;
}
.article-item {
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}
.article-item:last-child {
  margin-bottom: 0;
}
.article-citation {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-color-primary);
  margin-bottom: 6px;
}
.article-content {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
}
.rec-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
}
</style>
