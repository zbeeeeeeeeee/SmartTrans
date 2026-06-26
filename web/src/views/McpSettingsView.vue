<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

const mcpEnabled = ref(false)
const connections = ref<McpConnectionStatus[]>([])
const loading = ref(false)
const addDialogVisible = ref(false)

const statusTagType = (s: string) =>
  s === 'connected' ? 'success' : s === 'error' ? 'danger' : s === 'connecting' ? 'warning' : 'info'

const statusText = (s: string) =>
  s === 'connected' ? '已连接' : s === 'error' ? '错误' : s === 'connecting' ? '连接中' : '已停止'

async function load() {
  loading.value = true
  try {
    const [status, list] = await Promise.all([getMcpStatus(), listMcpConnections()])
    mcpEnabled.value = status.mcpEnabled
    connections.value = list
  } catch (e) {
    ElMessage.error('加载 MCP 配置失败')
  } finally {
    loading.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除 MCP 连接「${row.name}」？`, '确认删除', {
      type: 'warning',
    })
    await deleteMcpConnection(row.id)
    ElMessage.success('已删除')
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
    ElMessage.success('重连成功')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '重连失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="mcp-settings">
    <el-alert
      v-if="!mcpEnabled"
      title="MCP 功能未启用"
      description="请在服务端 .env 中设置 MCP_ENABLED=true 以启用 MCP 功能。"
      type="info"
      show-icon
      :closable="false"
    />

    <template v-else>
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>MCP 连接管理</span>
            <el-button type="primary" :icon="Plus" @click="addDialogVisible = true">
              添加 MCP 服务器
            </el-button>
          </div>
        </template>

        <el-table :data="connections" v-loading="loading" stripe>
          <el-table-column prop="name" label="名称" min-width="180">
            <template #default="{ row }">
              {{ row.name }}
              <el-tag v-if="row.isSystem" size="small" type="info" effect="plain" style="margin-left:6px">
                系统
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="transport" label="传输类型" width="90" />
          <el-table-column prop="url" label="地址" min-width="200">
            <template #default="{ row }">
              {{ row.url || row.transport === 'stdio' ? 'stdio' : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small" effect="light">
                {{ statusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="toolCount" label="工具数" width="80" align="center" />
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'error' || row.status === 'stopped'"
                size="small"
                :icon="RefreshRight"
                @click="handleReconnect(row)"
              >
                重连
              </el-button>
              <el-button v-if="!row.isSystem" size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!loading && connections.length === 0" description="暂无 MCP 连接" />
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
