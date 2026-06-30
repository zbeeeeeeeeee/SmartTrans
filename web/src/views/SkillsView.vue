<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  listSkills,
  createSkill,
  deleteSkill,
  updateSkillEnabled,
  getProviderCapabilities,
  type SkillMeta,
  type ProviderCapabilities,
} from '@/api/client'

defineOptions({ name: 'SkillsView' })

const { t } = useI18n()

const skills = ref<SkillMeta[]>([])
const loading = ref(false)
const providerCaps = ref<ProviderCapabilities>({ supportsNativeSkills: false })

// Create skill dialog
const createDialogVisible = ref(false)
const createForm = ref({
  skillMd: `---
name: my-skill
description: ${t('skills.description')}
---

# Skill Name

## Instructions
1. Step 1
2. Step 2
`,
})
const creating = ref(false)
const toggling = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    const [list, caps] = await Promise.all([
      listSkills(),
      getProviderCapabilities().catch(() => ({ supportsNativeSkills: false })),
    ])
    skills.value = list
    providerCaps.value = caps
  } catch {
    ElMessage.error(t('skills.loadFail'))
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  creating.value = true
  try {
    await createSkill(createForm.value.skillMd)
    ElMessage.success(t('skills.createSuccess'))
    createDialogVisible.value = false
    createForm.value.skillMd = `---
name: my-skill
description: ${t('skills.description')}
---

# Skill Name

## Instructions
1. Step 1
2. Step 2
`
    await load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('skills.createFail'))
  } finally {
    creating.value = false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      t('skills.deleteConfirm', { name: row.name }),
      t('mcp.confirmTitle'),
      { type: 'warning' },
    )
    await deleteSkill(row.id)
    ElMessage.success(t('skills.deleted'))
    await load()
  } catch {
    // cancelled
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleToggle(row: any) {
  const id = row.id as string
  const newVal = !row.enabled
  toggling.value = id
  try {
    await updateSkillEnabled(id, newVal)
    row.enabled = newVal
    ElMessage.success(newVal ? t('skills.enabledStatus') : t('skills.disabledStatus'))
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('skills.toggleFail'))
  } finally {
    toggling.value = null
  }
}

const uploadStatusTag = (s: string) => (s === 'uploaded' ? 'success' : 'info')
const uploadStatusText = (s: string): string => {
  const map: Record<string, string> = {
    uploaded: t('skills.uploaded'),
    failed: t('skills.uploadFailed'),
    local: t('skills.local'),
  }
  return map[s] ?? s
}

onMounted(load)
</script>

<template>
  <div class="skills-view">
    <el-alert
      v-if="!providerCaps.supportsNativeSkills"
      :title="t('skills.modeAlert')"
      :description="t('skills.modeAlertDesc')"
      type="info"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>{{ t('skills.title') }}</span>
          <el-button type="primary" :icon="Plus" @click="createDialogVisible = true">
            {{ t('skills.newSkill') }}
          </el-button>
        </div>
      </template>

      <el-table :data="skills" v-loading="loading" stripe>
        <el-table-column :label="t('skills.name')" min-width="160">
          <template #default="{ row }">
            {{ row.name }}
            <el-tag v-if="row.isSystem" size="small" type="info" effect="plain" style="margin-left:6px">
              {{ t('skills.system') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" :label="t('skills.description')" min-width="260" show-overflow-tooltip />
        <el-table-column :label="t('skills.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="uploadStatusTag(row.uploadStatus)" size="small" effect="light">
              {{ uploadStatusText(row.uploadStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('skills.enabled')" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :loading="toggling === row.id"
              @change="handleToggle(row)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('skills.actions')" width="100">
          <template #default="{ row }">
            <el-button v-if="!row.isSystem" size="small" type="danger" @click="handleDelete(row)">
              {{ t('skills.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && skills.length === 0" :description="t('skills.noSkills')">
        <template #description>
          <div style="max-width: 400px; margin: 0 auto; color: var(--el-text-color-secondary)">
            <p>{{ t('skills.noSkillsHint1') }}</p>
            <p>{{ t('skills.noSkillsHint2') }}</p>
          </div>
        </template>
      </el-empty>
    </el-card>

    <!-- Create Skill dialog -->
    <el-dialog v-model="createDialogVisible" :title="t('skills.createTitle')" width="640px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item :label="t('skills.createLabel')">
          <el-input
            v-model="createForm.skillMd"
            type="textarea"
            :rows="16"
            :placeholder="t('skills.createPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">{{ t('knowledge.cancel') }}</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">{{ t('skills.create') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.skills-view {
  max-width: 1000px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
