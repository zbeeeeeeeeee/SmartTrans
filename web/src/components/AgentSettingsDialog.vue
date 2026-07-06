<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  listMcpConnections,
  getAgentMcpSettings,
  updateAgentMcpSetting,
  listSkills,
  getAgentSkillSettings,
  updateAgentSkillSetting,
  type McpConnectionStatus,
  type AgentMcpSetting,
  type SkillMeta,
  type AgentSkillSetting,
} from '@/api/client'

defineOptions({ name: 'AgentSettingsDialog' })

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

const showMcpSection = computed(() => props.agentName === 'report')

// ---- MCP ----
const connections = ref<McpConnectionStatus[]>([])
const mcpSettings = ref<AgentMcpSetting[]>([])
const loadingMcp = ref(false)
const savingMcp = ref(false)
const expandedTools = ref<Record<string, boolean>>({})

const mcpEnabledMap = computed(() => {
  const map: Record<string, boolean> = {}
  for (const s of mcpSettings.value) map[s.mcpConnectionId] = s.enabled
  for (const c of connections.value) {
    if (!(c.id in map)) map[c.id] = false
  }
  return map
})

async function loadMcp() {
  loadingMcp.value = true
  try {
    const [conns, sets] = await Promise.all([
      listMcpConnections(),
      getAgentMcpSettings(props.agentName),
    ])
    connections.value = conns.filter((c) => c.status === 'connected')
    mcpSettings.value = sets
  } catch {
    ElMessage.error(t('settings.mcpLoadFail'))
  } finally {
    loadingMcp.value = false
  }
}

async function toggleMcp(mcpId: string, enabled: boolean) {
  savingMcp.value = true
  try {
    await updateAgentMcpSetting(props.agentName, mcpId, enabled)
    const existing = mcpSettings.value.find((s) => s.mcpConnectionId === mcpId)
    if (existing) {
      existing.enabled = enabled
    } else {
      mcpSettings.value.push({ agentName: props.agentName, mcpConnectionId: mcpId, enabled })
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('settings.saveFail'))
  } finally {
    savingMcp.value = false
  }
}

// ---- Skills ----
const skills = ref<SkillMeta[]>([])
const skillSettings = ref<AgentSkillSetting[]>([])
const loadingSkills = ref(false)
const savingSkill = ref<string | null>(null)

const skillEnabledMap = computed(() => {
  const map: Record<string, boolean> = {}
  for (const s of skillSettings.value) map[s.skillId] = s.enabled
  return map
})

async function loadSkills() {
  loadingSkills.value = true
  try {
    const [allSkills, sets] = await Promise.all([
      listSkills(),
      getAgentSkillSettings(props.agentName),
    ])
    // Only show globally enabled skills that belong to this agent
    skills.value = allSkills.filter((s) => s.enabled && s.name.startsWith(props.agentName))
    skillSettings.value = sets.filter((s) => skills.value.some((sk) => sk.id === s.skillId))
  } catch {
    ElMessage.error(t('settings.skillsLoadFail'))
  } finally {
    loadingSkills.value = false
  }
}

async function toggleSkill(skillId: string, enabled: boolean) {
  savingSkill.value = skillId
  try {
    await updateAgentSkillSetting(props.agentName, skillId, enabled)
    const existing = skillSettings.value.find((s) => s.skillId === skillId)
    if (existing) {
      existing.enabled = enabled
    } else {
      skillSettings.value.push({ agentName: props.agentName, skillId, enabled })
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('settings.saveFail'))
  } finally {
    savingSkill.value = null
  }
}

watch(dialogVisible, (v) => {
  if (v) {
    loadMcp()
    loadSkills()
  }
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('settings.title', { label: agentLabel })"
    width="580px"
    :close-on-click-modal="false"
  >
    <!-- MCP Tools (only for report agent) -->
    <div v-if="showMcpSection" v-loading="loadingMcp" class="section">
      <h4 class="section-title">{{ t('settings.mcpTools') }}</h4>
      <el-empty v-if="!loadingMcp && connections.length === 0" :description="t('settings.noMcp')" />
      <div v-else class="item-list">
        <div v-for="conn in connections" :key="conn.id" class="item-row">
          <div class="item-info">
            <div class="item-name">{{ conn.name }}</div>
            <div v-if="conn.tools.length" class="item-tools">
              <span class="tools-toggle" @click="expandedTools[conn.id] = !expandedTools[conn.id]">
                {{ conn.tools.length }} 个工具
                <span class="toggle-arrow">{{ expandedTools[conn.id] ? '▾' : '▸' }}</span>
              </span>
              <div v-if="expandedTools[conn.id]" class="tools-scroll">
                <el-tag
                  v-for="tool in conn.tools"
                  :key="tool.name"
                  size="small"
                  type="info"
                  effect="plain"
                  class="tag"
                >
                  {{ tool.name }}
                </el-tag>
              </div>
            </div>
            <span v-else class="no-items">{{ t('settings.noTools') }}</span>
          </div>
          <el-switch
            :model-value="mcpEnabledMap[conn.id]"
            :loading="savingMcp"
            @change="toggleMcp(conn.id, $event as unknown as boolean)"
          />
        </div>
      </div>
    </div>

    <el-divider v-if="showMcpSection" />

    <!-- Skills -->
    <div v-loading="loadingSkills" class="section">
      <h4 class="section-title">
        {{ t('settings.skills') }}
        <span class="section-hint">{{ t('settings.skillsHint') }}</span>
      </h4>
      <el-empty v-if="!loadingSkills && skills.length === 0" :description="t('settings.noSkills')" />
      <div v-else class="item-list">
        <div v-for="skill in skills" :key="skill.id" class="item-row">
          <div class="item-info">
            <div class="item-name">
              {{ skill.name }}
              <el-tag v-if="skill.isSystem" size="small" type="info" effect="plain" class="sys-tag">{{ t('skills.system') }}</el-tag>
            </div>
            <div class="item-desc">{{ skill.description }}</div>
          </div>
          <el-switch
            :model-value="!!skillEnabledMap[skill.id]"
            :loading="savingSkill === skill.id"
            @change="toggleSkill(skill.id, $event as unknown as boolean)"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">{{ t('settings.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.section {
  min-height: 40px;
}
.section-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.section-hint {
  font-weight: 400;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}
.item-info {
  flex: 1;
  min-width: 0;
}
.item-name {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}
.item-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-tools {
  font-size: 12px;
}
.tools-toggle {
  color: var(--el-color-primary);
  cursor: pointer;
  user-select: none;
  padding: 1px 0;
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
.tag {
  margin: 0 4px 2px 0;
}
.sys-tag {
  margin-left: 6px;
}
.no-items {
  font-style: italic;
  font-size: 12px;
}
</style>
