<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { addMcpConnection, type AddMcpConfig } from '@/api/client'

defineOptions({ name: 'AddMcpDialog' })

const { t } = useI18n()

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
    ElMessage.warning(t('addMcp.nameRequired'))
    return
  }
  if ((form.value.transport === 'http' || form.value.transport === 'sse') && !form.value.url.trim()) {
    ElMessage.warning(t('addMcp.urlRequired'))
    return
  }
  if (form.value.transport === 'stdio' && !form.value.command.trim()) {
    ElMessage.warning(t('addMcp.commandRequired'))
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
    ElMessage.success(t('addMcp.success'))
    dialogVisible.value = false
    emit('added')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t('addMcp.fail'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('addMcp.title')"
    width="520px"
    :close-on-click-modal="false"
  >
    <el-form label-width="80px" :model="form">
      <el-form-item :label="t('addMcp.name')" required>
        <el-input v-model="form.name" :placeholder="t('addMcp.namePlaceholder')" />
      </el-form-item>
      <el-form-item :label="t('addMcp.transport')" required>
        <el-select v-model="form.transport" style="width: 100%">
          <el-option :label="t('addMcp.http')" value="http" />
          <el-option :label="t('addMcp.sse')" value="sse" />
          <el-option :label="t('addMcp.stdio')" value="stdio" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.transport === 'http' || form.transport === 'sse'" :label="t('addMcp.url')" required>
        <el-input v-model="form.url" :placeholder="t('addMcp.urlPlaceholder')" />
      </el-form-item>
      <el-form-item v-if="form.transport === 'stdio'" :label="t('addMcp.command')" required>
        <el-input v-model="form.command" :placeholder="t('addMcp.commandPlaceholder')" />
      </el-form-item>
      <el-form-item v-if="form.transport === 'stdio'" :label="t('addMcp.args')">
        <el-input v-model="form.args" :placeholder="t('addMcp.argsPlaceholder')" />
      </el-form-item>
      <el-form-item v-if="form.transport === 'http' || form.transport === 'sse'" :label="t('addMcp.headers')">
        <div class="headers">
          <div v-for="(h, idx) in form.headers" :key="idx" class="header-row">
            <el-input v-model="h.key" :placeholder="t('addMcp.key')" size="small" style="width: 180px" />
            <el-input v-model="h.value" :placeholder="t('addMcp.value')" size="small" style="width: 240px" />
            <el-button size="small" type="danger" :icon="'Delete'" circle @click="removeHeader(idx)" />
          </div>
          <el-button size="small" @click="addHeader">{{ t('addMcp.addHeader') }}</el-button>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">{{ t('addMcp.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">{{ t('addMcp.submit') }}</el-button>
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
