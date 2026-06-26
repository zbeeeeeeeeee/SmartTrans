<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { addMcpConnection, type AddMcpConfig } from '@/api/client'

defineOptions({ name: 'AddMcpDialog' })

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [v: boolean]; added: [] }>()

const dialogVisible = ref(props.visible)
watch(() => props.visible, (v) => { dialogVisible.value = v })
watch(dialogVisible, (v) => emit('update:visible', v))

const submitting = ref(false)

const form = ref<{
  name: string
  transport: 'http' | 'sse' | 'stdio'
  url: string
  command: string
  args: string
  headers: { key: string; value: string }[]
}>({
  name: '',
  transport: 'http',
  url: '',
  command: '',
  args: '',
  headers: [],
})

function resetForm() {
  form.value = { name: '', transport: 'http', url: '', command: '', args: '', headers: [] }
}

watch(dialogVisible, (v) => {
  if (!v) resetForm()
})

function addHeader() {
  form.value.headers.push({ key: '', value: '' })
}

function removeHeader(idx: number) {
  form.value.headers.splice(idx, 1)
}

async function submit() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入 MCP 名称')
    return
  }
  if ((form.value.transport === 'http' || form.value.transport === 'sse') && !form.value.url.trim()) {
    ElMessage.warning('请输入 URL')
    return
  }
  if (form.value.transport === 'stdio' && !form.value.command.trim()) {
    ElMessage.warning('请输入命令')
    return
  }

  submitting.value = true
  try {
    const headers: Record<string, string> = {}
    for (const h of form.value.headers) {
      if (h.key.trim()) headers[h.key.trim()] = h.value
    }

    const cfg: AddMcpConfig = {
      name: form.value.name.trim(),
      transport: form.value.transport,
      url: form.value.url.trim() || undefined,
      command: form.value.command.trim() || undefined,
      args: form.value.args.trim()
        ? form.value.args.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    }
    await addMcpConnection(cfg)
    ElMessage.success('MCP 连接已添加')
    dialogVisible.value = false
    emit('added')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '添加失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="添加 MCP 服务器"
    width="520px"
    :close-on-click-modal="false"
  >
    <el-form label-width="80px" :model="form">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="如：法律知识库" />
      </el-form-item>
      <el-form-item label="传输类型" required>
        <el-select v-model="form.transport" style="width: 100%">
          <el-option label="HTTP" value="http" />
          <el-option label="SSE" value="sse" />
          <el-option label="Stdio" value="stdio" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.transport === 'http' || form.transport === 'sse'" label="URL" required>
        <el-input v-model="form.url" placeholder="https://example.com/mcp" />
      </el-form-item>
      <el-form-item v-if="form.transport === 'stdio'" label="命令" required>
        <el-input v-model="form.command" placeholder="node" />
      </el-form-item>
      <el-form-item v-if="form.transport === 'stdio'" label="参数">
        <el-input v-model="form.args" placeholder="server.js, --port=3001（逗号分隔）" />
      </el-form-item>
      <el-form-item v-if="form.transport === 'http' || form.transport === 'sse'" label="Headers">
        <div class="headers">
          <div v-for="(h, idx) in form.headers" :key="idx" class="header-row">
            <el-input v-model="h.key" placeholder="Key" size="small" style="width: 180px" />
            <el-input v-model="h.value" placeholder="Value" size="small" style="width: 240px" />
            <el-button size="small" type="danger" :icon="'Delete'" circle @click="removeHeader(idx)" />
          </div>
          <el-button size="small" @click="addHeader">+ 添加 Header</el-button>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">添加</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.headers {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.header-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
</style>
