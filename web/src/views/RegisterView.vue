<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api/client'

const router = useRouter()
const form = reactive({ username: '', email: '', password: '' })
const loading = ref(false)

async function handleRegister() {
  loading.value = true
  try {
    const res = await apiClient('POST /api/auth/register', form)
    localStorage.setItem('accessToken', res.accessToken)
    localStorage.setItem('user', JSON.stringify(res.user))
    ElMessage.success('注册成功')
    router.push('/')
  } catch (e: any) {
    ElMessage.error(e.message || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="never">
      <template #header>
        <h2 style="margin:0;text-align:center">注册</h2>
      </template>
      <el-form label-position="top" @submit.prevent="handleRegister">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" type="email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="至少6位" show-password />
        </el-form-item>
        <el-button type="primary" :loading="loading" native-type="submit" style="width:100%">注册</el-button>
      </el-form>
      <div style="text-align:center;margin-top:16px">
        <router-link to="/login">已有账号？去登录</router-link>
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
