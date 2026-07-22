<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Refresh, DocumentCopy } from '@element-plus/icons-vue'
import { batchRegister, listUsers, deleteUser, type UserListItem, type BatchRegisterResult } from '@/api/client'

defineOptions({ name: 'AdminView' })

const { t } = useI18n()

// ---- Batch create ----
const batchText = ref('')
const defaultPassword = ref('')
const creating = ref(false)
const batchResult = ref<BatchRegisterResult | null>(null)

function parseBatchInput(): { username: string; password: string }[] {
  const lines = batchText.value.split('\n').map((l) => l.trim()).filter(Boolean)
  const users: { username: string; password: string }[] = []
  for (const line of lines) {
    const idx = line.indexOf(',')
    if (idx > 0) {
      const username = line.slice(0, idx).trim()
      const password = line.slice(idx + 1).trim()
      users.push({ username, password: password || defaultPassword.value })
    } else {
      users.push({ username: line, password: defaultPassword.value })
    }
  }
  return users
}

async function handleBatchCreate(): Promise<void> {
  const users = parseBatchInput()
  if (users.length === 0) {
    ElMessage.warning(t('admin.noInput'))
    return
  }
  if (!defaultPassword.value && users.some((u) => !u.password)) {
    ElMessage.warning(t('admin.needDefaultPassword'))
    return
  }
  creating.value = true
  try {
    batchResult.value = await batchRegister(users)
    ElMessage.success(t('admin.batchDone', { n: batchResult.value.created.length }))
    await loadUsers()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('admin.batchFail'))
  } finally {
    creating.value = false
  }
}

function copyAll(): void {
  if (!batchResult.value?.created.length) return
  const text = batchResult.value.created.map((u) => `${u.username} ${u.password}`).join('\n')
  navigator.clipboard.writeText(text).then(() => ElMessage.success(t('admin.copied')))
}

// ---- User list ----
const users = ref<UserListItem[]>([])
const loadingUsers = ref(false)

async function loadUsers(): Promise<void> {
  loadingUsers.value = true
  try {
    users.value = await listUsers()
  } catch {
    ElMessage.error(t('admin.loadUsersFail'))
  } finally {
    loadingUsers.value = false
  }
}

async function handleDelete(row: UserListItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('admin.deleteConfirm', { name: row.username }),
      t('admin.confirmTitle'),
      { type: 'warning' },
    )
    await deleteUser(row.id)
    ElMessage.success(t('admin.deleted'))
    await loadUsers()
  } catch {
    // cancelled
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="admin-view">
    <!-- Batch create -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('admin.batchCreate') }}</span>
        </div>
      </template>
      <el-form label-position="top">
        <el-form-item :label="t('admin.batchLabel')">
          <el-input
            v-model="batchText"
            type="textarea"
            :rows="8"
            :placeholder="t('admin.batchPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('admin.defaultPasswordLabel')">
          <el-input
            v-model="defaultPassword"
            type="password"
            :placeholder="t('admin.defaultPasswordPlaceholder')"
            show-password
            style="max-width: 300px"
          />
        </el-form-item>
        <el-button type="primary" :icon="Plus" :loading="creating" @click="handleBatchCreate">
          {{ t('admin.batchCreateBtn') }}
        </el-button>
      </el-form>

      <!-- Results -->
      <div v-if="batchResult" class="batch-result">
        <el-divider />
        <div class="result-summary">
          <span>{{ t('admin.createdCount', { n: batchResult.created.length }) }}</span>
          <span v-if="batchResult.skipped.length" class="skipped-count">
            {{ t('admin.skippedCount', { n: batchResult.skipped.length }) }}
          </span>
          <el-button v-if="batchResult.created.length" size="small" :icon="DocumentCopy" @click="copyAll">
            {{ t('admin.copyAll') }}
          </el-button>
        </div>

        <el-table v-if="batchResult.created.length" :data="batchResult.created" stripe size="small" class="result-table">
          <el-table-column prop="username" :label="t('admin.username')" />
          <el-table-column prop="password" :label="t('admin.password')" />
        </el-table>

        <el-alert
          v-if="batchResult.skipped.length"
          :title="t('admin.skippedTitle')"
          type="warning"
          :closable="false"
          class="skipped-alert"
        >
          <div v-for="(s, i) in batchResult.skipped" :key="i" class="skipped-item">
            {{ s.username }} - {{ s.reason }}
          </div>
        </el-alert>
      </div>
    </el-card>

    <!-- User list -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('admin.userList') }}</span>
          <el-button :icon="Refresh" :loading="loadingUsers" @click="loadUsers">{{ t('admin.refresh') }}</el-button>
        </div>
      </template>
      <el-table :data="users" v-loading="loadingUsers" stripe>
        <el-table-column prop="username" :label="t('admin.username')" min-width="180" />
        <el-table-column prop="createdAt" :label="t('admin.createdAt')" width="200" />
        <el-table-column :label="t('admin.actions')" width="100" align="center">
          <template #default="{ row }">
            <el-button size="small" :icon="Delete" type="danger" circle @click="handleDelete(row as UserListItem)" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.admin-view {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.result-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 14px;
}
.skipped-count {
  color: var(--el-color-warning);
}
.result-table {
  margin-bottom: 12px;
}
.skipped-alert {
  margin-top: 8px;
}
.skipped-item {
  font-size: 12px;
  line-height: 1.8;
}
</style>
