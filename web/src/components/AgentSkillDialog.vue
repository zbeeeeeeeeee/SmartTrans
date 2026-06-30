<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getAgentSkillSettings, updateAgentSkillSetting, type AgentSkillSetting } from '@/api/client'

const props = defineProps<{
  visible: boolean
  skillId: string
  skillName: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  updated: []
}>()

const { t } = useI18n()

const AGENTS = computed(() => [
  { key: 'vision', label: t('skillDialog.agentVision') },
  { key: 'severity', label: t('skillDialog.agentSeverity') },
  { key: 'liability', label: t('skillDialog.agentLiability') },
  { key: 'report', label: t('skillDialog.agentReport') },
])

const settings = ref<AgentSkillSetting[]>([])
const loading = ref(false)
const saving = ref<string | null>(null)

watch(
  () => props.visible,
  async (v) => {
    if (v && props.skillId) {
      await loadSettings()
    }
  },
)

async function loadSettings() {
  loading.value = true
  try {
    const all = await getAgentSkillSettings()
    settings.value = all.filter((s) => s.skillId === props.skillId)
  } catch {
    ElMessage.error(t('skillDialog.loadFail'))
  } finally {
    loading.value = false
  }
}

function isEnabled(agentName: string): boolean {
  return settings.value.some((s) => s.agentName === agentName && s.enabled)
}

async function toggle(agentName: string) {
  saving.value = agentName
  try {
    const current = isEnabled(agentName)
    await updateAgentSkillSetting(agentName, props.skillId, !current)
    // Update local state
    const existing = settings.value.find((s) => s.agentName === agentName)
    if (existing) {
      existing.enabled = !current
    } else {
      settings.value.push({ agentName, skillId: props.skillId, enabled: !current })
    }
    const agentLabel = AGENTS.value.find((a) => a.key === agentName)?.label
    const statusText = !current ? t('skillDialog.enabled') : t('skillDialog.disabled')
    ElMessage.success(`${agentLabel} — ${statusText}`)
    emit('updated')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('skillDialog.operationFail'))
  } finally {
    saving.value = null
  }
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="t('skillDialog.title', { name: skillName })"
    width="480px"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading">
      <p style="color: var(--el-text-color-secondary); margin-bottom: 16px">
        {{ t('skillDialog.desc') }}
      </p>
      <div v-for="agent in AGENTS" :key="agent.key" class="agent-row">
        <span class="agent-label">{{ agent.label }}</span>
        <el-switch
          :model-value="isEnabled(agent.key)"
          :loading="saving === agent.key"
          @change="toggle(agent.key)"
        />
      </div>
    </div>
    <template #footer>
      <el-button @click="handleClose">{{ t('skillDialog.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.agent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.agent-row:last-child {
  border-bottom: none;
}
.agent-label {
  font-size: 14px;
}
</style>
