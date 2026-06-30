<script setup lang="ts">
import { ref, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { useAnalysisPipeline } from '@/composables/useAnalysisPipeline'
import AgentProgress from '@/components/AgentProgress.vue'
import AgentSettingsDialog from '@/components/AgentSettingsDialog.vue'

defineOptions({ name: 'AnalyzeView' })

const { t } = useI18n()
const mcpEnabled = inject<boolean>('mcpEnabled', false)

const {
  fileList,
  description,
  running,
  errorMsg,
  finalReport,
  expandedKey,
  steps,
  run,
  resetAll,
} = useAnalysisPipeline()

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
              <el-upload
                v-model:file-list="fileList"
                list-type="picture-card"
                :auto-upload="false"
                accept="image/*"
                multiple
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
.err {
  margin-top: 16px;
}

</style>
