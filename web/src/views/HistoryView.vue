<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { downloadReportPdf, getReport, listReports } from '@/api/client'
import type { ReportRecord, ReportSummary } from '@/api/client'
import type { AccidentReportView } from '@/types'
import ReportCard from '@/components/ReportCard.vue'

const LEVEL_TEXT: Record<string, string> = { minor: '轻微', moderate: '一般', severe: '严重' }

const rows = ref<ReportSummary[]>([])
const dialogVisible = ref(false)
const current = ref<ReportRecord | null>(null)
const loading = ref(false)

const levelText = (severity: unknown): string => {
  const level = (severity as { level?: string } | null)?.level
  return LEVEL_TEXT[level ?? ''] ?? '-'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await listReports()
  } finally {
    loading.value = false
  }
}

async function open(id: string): Promise<void> {
  current.value = await getReport(id)
  dialogVisible.value = true
}

onMounted(load)
</script>

<template>
  <div class="history">
    <el-card shadow="never">
      <template #header>
        <div class="card-head">
          <span>历史分析报告</span>
          <el-button :loading="loading" @click="load">刷新</el-button>
        </div>
      </template>
      <el-table :data="rows" stripe>
        <el-table-column prop="id" label="ID" width="300" show-overflow-tooltip />
        <el-table-column label="严重等级" width="100">
          <template #default="{ row }">
            {{ levelText(row.severity) }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="时间" width="180" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="open(row.id)">查看</el-button>
            <el-button
              v-if="row.hasPdf"
              link
              type="success"
              @click="downloadReportPdf(row.id)"
            >
              下载PDF
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="事故分析报告" width="720px">
      <ReportCard
        v-if="current"
        :report="(current.report as AccidentReportView)"
        :images="current.imagePaths"
      />
    </el-dialog>
  </div>
</template>

<style scoped>
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
