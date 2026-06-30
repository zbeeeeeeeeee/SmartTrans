<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshRight } from '@element-plus/icons-vue'
import {
  getMcpStatus,
  listMcpConnections,
  deleteMcpConnection,
  reconnectMcpConnection,
  type McpConnectionStatus,
} from '@/api/client'
import AddMcpDialog from '@/components/AddMcpDialog.vue'

defineOptions({ name: 'McpSettingsView' })

const { t } = useI18n()

const mcpEnabled = ref(false)
const connections = ref<McpConnectionStatus[]>([])
const loading = ref(false)
const addDialogVisible = ref(false)

const statusTagType = (s: string) =>
  s === 'connected' ? 'success' : s === 'error' ? 'danger' : s === 'connecting' ? 'warning' : 'info'

const statusText = (s: string): string => {
  const map: Record<string, string> = {
    connected: t('mcp.connected'),
    error: t('mcp.error'),
    connecting: t('mcp.connecting'),
    stopped: t('mcp.stopped'),
  }
  return map[s] ?? s
}

async function load() {
  loading.value = true
  try {
    const [status, list] = await Promise.all([getMcpStatus(), listMcpConnections()])
    mcpEnabled.value = status.mcpEnabled
    connections.value = list
  } catch {
    ElMessage.error(t('mcp.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      t('mcp.confirmDelete', { name: row.name }),
      t('mcp.confirmTitle'),
      { type: 'warning' },
    )
    await deleteMcpConnection(row.id)
    ElMessage.success(t('mcp.deleted'))
    await load()
  } catch {
    // cancelled
  }
}

async function handleReconnect(row: any) {
  try {
    const updated = await reconnectMcpConnection(row.id)
    const idx = connections.value.findIndex((c) => c.id === row.id)
    if (idx >= 0) connections.value[idx] = updated
    ElMessage.success(t('mcp.reconnectSuccess'))
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('mcp.reconnectFailed'))
  }
}

onMounted(load)
</script>

<template>
  <div class="mcp-settings">
    <el-alert
      v-if="!mcpEnabled"
      :title="t('mcp.disabled')"
      :description="t('mcp.disabledHint')"
      type="info"
      show-icon
      :closable="false"
    />

    <template v-else>
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>{{ t('mcp.connectionManagement') }}</span>
            <el-button type="primary" :icon="Plus" @click="addDialogVisible = true">
              {{ t('mcp.addServer') }}
            </el-button>
          </div>
        </template>

        <el-table :data="connections" v-loading="loading" stripe>
          <el-table-column prop="name" :label="t('mcp.name')" min-width="180">
            <template #default="{ row }">
              {{ row.name }}
              <el-tag v-if="row.isSystem" size="small" type="info" effect="plain" style="margin-left:6px">
                {{ t('mcp.system') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="transport" :label="t('mcp.transport')" width="90" />
          <el-table-column prop="url" :label="t('mcp.address')" min-width="200">
            <template #default="{ row }">
              {{ row.url || row.transport === 'stdio' ? 'stdio' : '-' }}
            </template>
          </el-table-column>
          <el-table-column :label="t('mcp.status')" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small" effect="light">
                {{ statusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="toolCount" :label="t('mcp.toolCount')" width="80" align="center" />
          <el-table-column :label="t('mcp.actions')" width="160">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'error' || row.status === 'stopped'"
                size="small"
                :icon="RefreshRight"
                @click="handleReconnect(row)"
              >
                {{ t('mcp.reconnect') }}
              </el-button>
              <el-button v-if="!row.isSystem" size="small" type="danger" @click="handleDelete(row)">
                {{ t('mcp.delete') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!loading && connections.length === 0" :description="t('mcp.empty')" />
      </el-card>
    </template>

    <AddMcpDialog v-model:visible="addDialogVisible" @added="load" />
  </div>
</template>

<style scoped>
.mcp-settings {
  max-width: 1000px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
