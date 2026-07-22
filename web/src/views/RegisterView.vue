<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { apiClient } from '@/api/client'

const { t } = useI18n()
const router = useRouter()
const form = reactive({ username: '', password: '' })
const loading = ref(false)

async function handleRegister() {
  loading.value = true
  try {
    const res = await apiClient('POST /api/auth/register', form)
    localStorage.setItem('accessToken', res.accessToken)
    localStorage.setItem('user', JSON.stringify(res.user))
    ElMessage.success(t('auth.registerSuccess'))
    router.push('/')
  } catch (e: any) {
    ElMessage.error(e.message || t('auth.registerFail'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="never">
      <template #header>
        <h2 style="margin:0;text-align:center">{{ t('auth.register') }}</h2>
      </template>
      <el-form label-position="top" @submit.prevent="handleRegister">
        <el-form-item :label="t('auth.username')">
          <el-input v-model="form.username" :placeholder="t('auth.usernamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('auth.password')">
          <el-input v-model="form.password" type="password" :placeholder="t('auth.passwordHint')" show-password />
        </el-form-item>
        <el-button type="primary" :loading="loading" native-type="submit" style="width:100%">{{ t('auth.register') }}</el-button>
      </el-form>
      <div style="text-align:center;margin-top:16px">
        <router-link to="/login">{{ t('auth.hasAccount') }}</router-link>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 120px);
}
.auth-card {
  width: 100%;
  max-width: 400px;
}
</style>
