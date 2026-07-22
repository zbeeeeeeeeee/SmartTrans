<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Document, View, FolderOpened, Download } from '@element-plus/icons-vue'
import { downloadReportPdf, getReport, listReports, listWorkspace, workspaceFileUrl } from '@/api/client'
import type { ReportRecord, ReportSummary, WorkspaceFile } from '@/api/client'
import type { AccidentReportView } from '@/types'
import ReportCard from '@/components/ReportCard.vue'

const { t } = useI18n()

const rows = ref<ReportSummary[]>([])
const dialogVisible = ref(false)
const current = ref<ReportRecord | null>(null)
const loading = ref(false)

// Workspace dialog state
const wsDialogVisible = ref(false)
const wsFiles = ref<WorkspaceFile[]>([])
const wsLoading = ref(false)
const wsReportId = ref('')

const levelText = (severity: unknown): string => {
  const level = (severity as { level?: string } | null)?.level
  return level ? t(`severity.${level}`) : '-'
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

async function openWorkspace(id: string): Promise<void> {
  wsReportId.value = id
  wsDialogVisible.value = true
  wsLoading.value = true
  try {
    wsFiles.value = await listWorkspace(id)
  } catch {
    wsFiles.value = []
  } finally {
    wsLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="history">
    <el-card shadow="never">
      <template #header>
        <div class="card-head">
          <span>{{ t('history.title') }}</span>
          <el-button :loading="loading" @click="load">{{ t('history.refresh') }}</el-button>
        </div>
      </template>
      <el-table :data="rows" stripe>
        <el-table-column prop="id" label="ID" width="300" show-overflow-tooltip />
        <el-table-column :label="t('history.severity')" width="100">
          <template #default="{ row }">
            {{ levelText(row.severity) }}
          </template>
        </el-table-column>
        <el-table-column prop="description" :label="t('history.description')" show-overflow-tooltip />
        <el-table-column prop="createdAt" :label="t('history.time')" width="180" />
        <el-table-column :label="t('history.actions')" width="240" align="center">
          <template #default="{ row }">
            <div class="actions-cell">
              <div class="action-btn" @click="open(row.id)">
                <el-icon><View /></el-icon>
                <span>{{ t('history.view') }}</span>
              </div>
              <div class="action-btn" @click="openWorkspace(row.id)">
                <el-icon><FolderOpened /></el-icon>
                <span>{{ t('history.viewWorkspace') }}</span>
              </div>
              <div v-if="row.hasPdf" class="action-btn" @click="downloadReportPdf(row.id)">
                <el-icon><Download /></el-icon>
                <span>{{ t('history.downloadPdf') }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="t('history.reportTitle')" width="720px">
      <ReportCard
        v-if="current"
        :report="(current.report as AccidentReportView)"
        :images="current.imagePaths"
        :report-id="current.id"
      />
    </el-dialog>

    <!-- Workspace dialog -->
    <el-dialog v-model="wsDialogVisible" :title="t('workspace.title')" width="680px">
      <div v-loading="wsLoading" style="min-height: 120px">
        <el-empty v-if="!wsLoading && wsFiles.length === 0" :description="t('workspace.empty')" />
        <div v-else class="ws-list">
          <div v-for="file in wsFiles" :key="file.name" class="ws-item">
            <template v-if="['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(file.ext)">
              <el-image
                :src="workspaceFileUrl(wsReportId, file.name)"
                :preview-src-list="[workspaceFileUrl(wsReportId, file.name)]"
                fit="cover"
                class="ws-thumb"
              />
              <span class="ws-name">{{ file.name }}</span>
            </template>
            <template v-else-if="file.ext === 'pdf'">
              <el-icon class="ws-icon"><Document /></el-icon>
              <span class="ws-name">{{ file.name }}</span>
              <el-button size="small" type="primary" link @click="downloadReportPdf(wsReportId)">
                {{ t('workspace.download') }}
              </el-button>
            </template>
            <template v-else>
              <el-icon class="ws-icon"><Document /></el-icon>
              <a class="ws-name ws-link" :href="workspaceFileUrl(wsReportId, file.name)" target="_blank">{{ file.name }}</a>
            </template>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.actions-cell {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  justify-content: center;
  align-items: center;
}
.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  transition: all 0.2s;
}
.action-btn:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.action-btn .el-icon {
  font-size: 16px;
}
.ws-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.ws-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 120px;
  padding: 10px 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}
.ws-thumb {
  width: 96px;
  height: 96px;
  border-radius: 6px;
}
.ws-icon {
  font-size: 48px;
  color: var(--el-color-primary);
}
.ws-name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
  text-align: center;
  line-height: 1.4;
}
.ws-link {
  color: var(--el-color-primary);
  text-decoration: none;
}
.ws-link:hover {
  text-decoration: underline;
}
</style>
