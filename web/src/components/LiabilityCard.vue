<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LiabilityAnalysis } from '@/types'

const props = defineProps<{ data: LiabilityAnalysis }>()

const { t } = useI18n()

const faultColor = (pct: number): string => {
  if (pct >= 70) return '#f56c6c'
  if (pct >= 30) return '#e6a23c'
  return '#67c23a'
}
</script>

<template>
  <div class="liability-card">
    <!-- Party responsibility -->
    <div class="section">
      <h4 class="section-title">{{ t('liability.partiesResponsibility') }}</h4>
      <div
        v-for="(party, idx) in data.parties"
        :key="idx"
        class="party-item"
      >
        <div class="party-head">
          <span class="party-name">{{ party.party }}</span>
          <el-tag
            :color="faultColor(party.faultPercentage)"
            effect="dark"
            size="small"
            class="party-pct"
          >
            {{ party.faultPercentage }}%
          </el-tag>
        </div>
        <el-progress
          :percentage="party.faultPercentage"
          :color="faultColor(party.faultPercentage)"
          :stroke-width="10"
          :show-text="false"
          class="party-bar"
        />
        <p class="party-reason">{{ party.reasoning }}</p>
      </div>
    </div>

    <!-- Cited articles -->
    <div v-if="data.citedArticles?.length" class="section">
      <h4 class="section-title">{{ t('liability.citedArticles') }}</h4>
      <el-tag
        v-for="(a, i) in data.citedArticles"
        :key="i"
        type="info"
        effect="plain"
        class="article-tag"
      >
        {{ a }}
      </el-tag>
    </div>

    <!-- Conclusion -->
    <div class="section">
      <h4 class="section-title">{{ t('liability.conclusion') }}</h4>
      <p class="conclusion-text">{{ data.conclusion || t('liability.fallback') }}</p>
    </div>
  </div>
</template>

<style scoped>
.liability-card {
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
.party-item {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}
.party-item:last-child {
  margin-bottom: 0;
}
.party-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.party-name {
  font-weight: 600;
  font-size: 14px;
}
.party-pct {
  font-weight: 700;
}
.party-bar {
  margin: 6px 0;
}
.party-reason {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.article-tag {
  margin: 0 8px 6px 0;
}
.conclusion-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}
</style>
