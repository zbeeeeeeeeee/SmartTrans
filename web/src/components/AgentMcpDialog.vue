<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  listMcpConnections,
  getAgentMcpSettings,
  updateAgentMcpSetting,
  type McpConnectionStatus,
  type AgentMcpSetting,
} from '@/api/client'

defineOptions({ name: 'AgentMcpDialog' })

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  agentName: string
  agentLabel: string
}>()
const emit = defineEmits<{ 'update:visible': [v: boolean] }>()

const dialogVisible = ref(props.visible)
watch(() => props.visible, (v) => { dialogVisible.value = v })
watch(dialogVisible, (v) => emit('update:visible', v))

const connections = ref<McpConnectionStatus[]>([])
const settings = ref<AgentMcpSetting[]>([])
const loading = ref(false)
const saving = ref(false)
const expandedTools = ref<Record<string, boolean>>({})

const enabledMap = computed(() => {
  const map: Record<string, boolean> = {}
  for (const s of settings.value) {
    map[s.mcpConnectionId] = s.enabled
  }
  for (const c of connections.value) {
    if (!(c.id in map)) map[c.id] = false
  }
  return map
})

async function load() {
  loading.value = true
  try {
    const [conns, sets] = await Promise.all([
      listMcpConnections(),
      getAgentMcpSettings(props.agentName),
    ])
    connections.value = conns.filter((c) => c.status === 'connected')
    settings.value = sets
  } catch {
    ElMessage.error(t('mcpDialog.loadFail'))
  } finally {
    loading.value = false
  }
}

async function toggleMcp(mcpId: string, enabled: boolean) {
  saving.value = true
  try {
    await updateAgentMcpSetting(props.agentName, mcpId, enabled)
    // Update local state
    const existing = settings.value.find((s) => s.mcpConnectionId === mcpId)
    if (existing) {
      existing.enabled = enabled
    } else {
      settings.value.push({ agentName: props.agentName, mcpConnectionId: mcpId, enabled })
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('mcpDialog.saveFail'))
  } finally {
    saving.value = false
  }
}

watch(dialogVisible, (v) => {
  if (v) load()
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('mcpDialog.title', { label: agentLabel })"
    width="560px"
    :close-on-click-modal="false"
  >
    <div v-loading="loading">
      <el-empty v-if="!loading && connections.length === 0" :description="t('mcpDialog.noMcp')" />
      <div v-else class="mcp-list">
        <div v-for="conn in connections" :key="conn.id" class="mcp-item">
          <div class="mcp-info">
            <div class="mcp-name">{{ conn.name }}</div>
            <div v-if="conn.tools.length" class="mcp-tools">
              <span class="tools-toggle" @click="expandedTools[conn.id] = !expandedTools[conn.id]">
                {{ conn.tools.length }} 个工具
                <span class="toggle-arrow">{{ expandedTools[conn.id] ? '▾' : '▸' }}</span>
              </span>
              <div v-if="expandedTools[conn.id]" class="tools-scroll">
                <el-tag
                  v-for="t in conn.tools"
                  :key="t.name"
                  size="small"
                  type="info"
                  effect="plain"
                  class="tool-tag"
                >
                  {{ t.name }}
                </el-tag>
              </div>
            </div>
            <span v-else class="no-tools">{{ t('mcpDialog.noTools') }}</span>
          </div>
          <el-switch
            :model-value="enabledMap[conn.id]"
            :loading="saving"
            @change="toggleMcp(conn.id, $event as unknown as boolean)"
          />
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">{{ t('mcpDialog.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.mcp-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mcp-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}
.mcp-info {
  flex: 1;
}
.mcp-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
}
.mcp-tools {
  font-size: 12px;
}
.tools-toggle {
  color: var(--el-color-primary);
  cursor: pointer;
  user-select: none;
}
.tools-toggle:hover {
  text-decoration: underline;
}
.toggle-arrow {
  font-size: 10px;
  margin-left: 2px;
}
.tools-scroll {
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.8;
  margin-top: 4px;
  padding: 4px 6px;
  background: var(--el-fill-color);
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
}
.tool-tag {
  margin: 0 4px 2px 0;
}
.no-tools {
  font-style: italic;
}
</style>
