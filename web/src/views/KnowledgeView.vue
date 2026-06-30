<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus, UploadFilled } from '@element-plus/icons-vue'
import {
  knowledgeStats,
  searchKnowledge,
  uploadKnowledgeFileWithProgress,
  listKnowledgeDocuments,
  deleteKnowledgeDocument,
} from '@/api/client'
import type { KnowledgeStats, LegalChunk, UploadedDocument } from '@/api/client'

const { t } = useI18n()

const ALLOWED_EXT = ['md', 'txt', 'markdown']

const stats = ref<KnowledgeStats>({ documents: 0, chunks: 0 })
const documents = ref<UploadedDocument[]>([])
const query = ref('')
const results = ref<LegalChunk[]>([])
const searching = ref(false)

// ---- Upload dialog ----
const dialogVisible = ref(false)
const dialogFile = ref<File | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function loadAll(): Promise<void> {
  try {
    const [s, docs] = await Promise.all([knowledgeStats(), listKnowledgeDocuments()])
    stats.value = s
    documents.value = docs
  } catch {
    /* ignore */
  }
}

function acceptFile(file: File): void {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXT.includes(ext)) {
    ElMessage.error(t('knowledge.invalidFormat'))
    return
  }
  dialogFile.value = file
}

/** Click drop zone → open file picker */
function onDropZoneClick(): void {
  fileInput.value?.click()
}

/** File input change event */
function onInputChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) acceptFile(file)
  input.value = '' // reset so same file re-select works
}

/** Drag enter */
function onDragEnter(e: DragEvent): void {
  e.preventDefault()
  dragOver.value = true
}

/** Drag over */
function onDragOver(e: DragEvent): void {
  e.preventDefault()
}

/** Drag leave */
function onDragLeave(): void {
  dragOver.value = false
}

/** Drop */
function onDrop(e: DragEvent): void {
  e.preventDefault()
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) acceptFile(file)
}

function openDialog(): void {
  dialogFile.value = null
  uploadProgress.value = 0
  dragOver.value = false
  dialogVisible.value = true
}

async function doUpload(): Promise<void> {
  if (!dialogFile.value) return
  uploading.value = true
  uploadProgress.value = 0
  try {
    await uploadKnowledgeFileWithProgress(dialogFile.value, (pct) => {
      uploadProgress.value = pct
    })
    ElMessage.success(t('knowledge.uploadSuccess', { name: dialogFile.value.name }))
    dialogVisible.value = false
    await loadAll()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('knowledge.uploadFailed'))
  } finally {
    uploading.value = false
  }
}

async function onDelete(id: number, _title: string): Promise<void> {
  try {
    await deleteKnowledgeDocument(id)
    ElMessage.success(t('knowledge.deleted'))
    await loadAll()
  } catch {
    /* cancelled */
  }
}

async function doSearch(): Promise<void> {
  if (!query.value.trim()) {
    ElMessage.warning(t('knowledge.searchRequired'))
    return
  }
  searching.value = true
  try {
    results.value = await searchKnowledge(query.value)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('knowledge.searchFailed'))
  } finally {
    searching.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="knowledge">
    <!-- Stats -->
    <el-card shadow="never">
      <template #header>{{ t('knowledge.title') }}</template>
      <el-descriptions :column="2" border class="stats">
        <el-descriptions-item :label="t('knowledge.docCount')">{{ stats.documents }}</el-descriptions-item>
        <el-descriptions-item :label="t('knowledge.chunkCount')">{{ stats.chunks }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Document management -->
    <el-card shadow="never" class="section">
      <template #header>
        <div class="card-head">
          <span>{{ t('knowledge.docManagement') }}</span>
          <el-button type="primary" :icon="Plus" @click="openDialog">{{ t('knowledge.addDocument') }}</el-button>
        </div>
      </template>
      <el-alert
        v-if="documents.length === 0"
        type="info"
        :closable="false"
        show-icon
        :title="t('knowledge.emptyHint')"
      />
      <el-table v-if="documents.length" :data="documents" stripe>
        <el-table-column prop="title" :label="t('knowledge.titleCol')" min-width="180" show-overflow-tooltip />
        <el-table-column prop="category" :label="t('knowledge.category')" width="80" />
        <el-table-column prop="chunkCount" :label="t('knowledge.chunks')" width="90" align="center" />
        <el-table-column prop="createdAt" :label="t('knowledge.uploadTime')" width="170" />
        <el-table-column :label="t('knowledge.actions')" width="80" align="center">
          <template #default="{ row }">
            <el-popconfirm
              :title="t('knowledge.confirmDelete', { title: row.title })"
              :confirm-button-text="t('knowledge.delete')"
              :cancel-button-text="t('knowledge.cancel')"
              @confirm="onDelete(row.id, row.title)"
            >
              <template #reference>
                <el-button link type="danger">{{ t('knowledge.delete') }}</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Search -->
    <el-card shadow="never" class="section">
      <template #header>{{ t('knowledge.semanticSearch') }}</template>
      <div class="search">
        <el-input
          v-model="query"
          :placeholder="t('knowledge.searchPlaceholder')"
          @keyup.enter="doSearch"
        >
          <template #append>
            <el-button :loading="searching" @click="doSearch">{{ t('knowledge.search') }}</el-button>
          </template>
        </el-input>
      </div>
      <div v-if="results.length" class="results">
        <el-card v-for="item in results" :key="item.id" shadow="never" class="result-item">
          <div class="result-head">
            <span class="result-source">《{{ item.source }}》{{ item.articleNo ?? '' }}</span>
            <el-tag size="small" type="info">distance {{ item.distance.toFixed(4) }}</el-tag>
          </div>
          <p class="result-content">{{ item.content }}</p>
        </el-card>
      </div>
    </el-card>

    <!-- Add document dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="t('knowledge.addDocTitle')"
      width="480px"
      :close-on-click-modal="false"
    >
      <div class="dialog-body">
        <!-- Drag / click upload area -->
        <div
          class="drop-zone"
          :class="{ 'drop-active': dragOver, 'has-file': !!dialogFile }"
          @click="onDropZoneClick"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".md,.txt,.markdown"
            style="display: none"
            @change="onInputChange"
          />
          <el-icon class="drop-icon" :size="36"><UploadFilled /></el-icon>
          <div class="drop-text" v-if="!dialogFile">
            <em>{{ t('knowledge.dropText1') }}</em> {{ t('knowledge.dropText2') }} <em>{{ t('knowledge.dropText3') }}</em>
            <p class="drop-hint">{{ t('knowledge.supportedFormats') }}</p>
          </div>
          <div class="drop-text" v-else>
            <span class="file-name">{{ dialogFile.name }}</span>
            <p class="drop-hint">{{ t('knowledge.clickToReselect') }}</p>
          </div>
        </div>

        <div v-if="uploading" class="progress-wrap">
          <span class="progress-label">{{ t('knowledge.uploading') }}</span>
          <el-progress :percentage="uploadProgress" :stroke-width="12" />
        </div>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false" :disabled="uploading">{{ t('knowledge.cancel') }}</el-button>
        <el-button type="primary" :loading="uploading" :disabled="!dialogFile" @click="doUpload">
          {{ t('knowledge.upload') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.section {
  margin-top: 16px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---- Drop zone ---- */
.drop-zone {
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.25s, background 0.25s;
  user-select: none;
}
.drop-zone:hover,
.drop-zone.drop-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.drop-zone.has-file {
  border-style: solid;
  border-color: var(--el-color-primary-light-3);
  background: var(--el-color-primary-light-9);
}
.drop-icon {
  color: var(--el-color-primary);
  margin-bottom: 8px;
}
.drop-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
}
.drop-text .file-name {
  font-weight: 600;
  color: var(--el-color-primary);
  word-break: break-all;
}
.drop-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* ---- Progress ---- */
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.progress-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.progress-wrap :deep(.el-progress) {
  flex: 1;
}

/* ---- Search ---- */
.search {
  margin-top: 8px;
}
.results {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.result-source {
  font-weight: 600;
}
.result-content {
  margin: 8px 0 0;
  white-space: pre-wrap;
  color: var(--el-text-color-regular);
}
</style>
