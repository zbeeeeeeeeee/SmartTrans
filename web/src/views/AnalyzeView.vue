<script setup lang="ts">
import { ref, inject } from 'vue'
import type { UploadInstance } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { Plus, Refresh, Picture } from '@element-plus/icons-vue'
import { useAnalysisPipeline } from '@/composables/useAnalysisPipeline'
import AgentProgress from '@/components/AgentProgress.vue'
import AgentSettingsDialog from '@/components/AgentSettingsDialog.vue'

defineOptions({ name: 'AnalyzeView' })

const { t } = useI18n()
const mcpEnabled = inject<boolean>('mcpEnabled', false)

const {
  fileList,
  description,
  coordinates,
  running,
  errorMsg,
  finalReport,
  expandedKey,
  steps,
  presetLoading,
  run,
  resetAll,
  loadPresetImage,
} = useAnalysisPipeline()

const uploadRef = ref<UploadInstance>()

function triggerUpload(): void {
  const root = (uploadRef.value as unknown as { $el?: HTMLElement })?.$el
  root?.querySelector<HTMLInputElement>('input[type="file"]')?.click()
}

// Agent settings dialog state (MCP + Skills)
const settingsDialogVisible = ref(false)
const settingsDialogAgent = ref('')
const settingsDialogLabel = ref('')

function onConfigureAgent(agentKey: string) {
  settingsDialogAgent.value = agentKey
  settingsDialogLabel.value = t(`agent.${agentKey}.label`) ?? agentKey
  settingsDialogVisible.value = true
}
</script>

<template>
  <div class="analyze">
    <el-row :gutter="20">
      <el-col :xs="24" :md="10">
        <el-card shadow="never">
          <template #header>{{ t('analyze.infoEntry') }}</template>
          <el-form label-position="top">
            <el-form-item :label="t('analyze.images')">
              <div v-if="fileList.length === 0" class="upload-empty" @click="triggerUpload">
                <el-icon class="empty-icon"><Picture /></el-icon>
                <p class="empty-hint">{{ t('analyze.emptyHint') }}</p>
                <div class="empty-actions">
                  <el-button type="primary" :icon="Plus" @click.stop="triggerUpload">
                    {{ t('analyze.selectImages') }}
                  </el-button>
                  <el-button :icon="Picture" :loading="presetLoading" @click.stop="loadPresetImage">
                    {{ t('analyze.usePresetImage') }}
                  </el-button>
                </div>
              </div>
              <el-upload
                ref="uploadRef"
                v-model:file-list="fileList"
                list-type="picture-card"
                :auto-upload="false"
                accept="image/*"
                multiple
                :class="{ 'hide-trigger': fileList.length === 0 }"
              >
                <el-icon><Plus /></el-icon>
              </el-upload>
            </el-form-item>
            <el-form-item :label="t('analyze.description')">
              <el-input
                v-model="description"
                type="textarea"
                :rows="5"
                :placeholder="t('analyze.descriptionPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('analyze.coordinates')">
              <el-input
                v-model="coordinates"
                placeholder="lng,lat"
              />
            </el-form-item>
            <div class="actions">
              <el-button type="primary" :loading="running" @click="run">{{ t('analyze.startAnalysis') }}</el-button>
              <el-button v-if="finalReport" :icon="Refresh" @click="resetAll">{{ t('analyze.newAnalysis') }}</el-button>
            </div>
          </el-form>
          <el-alert
            v-if="errorMsg"
            :title="errorMsg"
            type="error"
            show-icon
            :closable="false"
            class="err"
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :md="14">
        <el-card shadow="never" class="pipeline">
          <template #header>{{ t('analyze.pipeline') }}</template>
          <AgentProgress
            v-model:expanded-key="expandedKey"
            :steps="steps"
            @configure-agent="onConfigureAgent"
          />
        </el-card>

      </el-col>

    <AgentSettingsDialog
      v-model:visible="settingsDialogVisible"
      :agent-name="settingsDialogAgent"
      :agent-label="settingsDialogLabel"
    />
    </el-row>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 10px;
}
.upload-empty {
  width: 100%;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.upload-empty:hover {
  border-color: var(--el-color-primary);
}
.empty-icon {
  font-size: 32px;
  color: var(--el-text-color-placeholder);
}
.empty-hint {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.empty-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
.hide-trigger :deep(.el-upload--picture-card) {
  display: none;
}
.err {
  margin-top: 16px;
}
</style>
