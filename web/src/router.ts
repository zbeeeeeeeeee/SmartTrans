import { createRouter, createWebHistory } from 'vue-router'
import AnalyzeView from './views/AnalyzeView.vue'
import HistoryView from './views/HistoryView.vue'
import KnowledgeView from './views/KnowledgeView.vue'
import { isAuthenticated } from './api/client'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'analyze', component: AnalyzeView, meta: { requiresAuth: true } },
    { path: '/history', name: 'history', component: HistoryView, meta: { requiresAuth: true } },
    { path: '/knowledge', name: 'knowledge', component: KnowledgeView, meta: { requiresAuth: true } },
    {
      path: '/mcp',
      name: 'mcp',
      component: () => import('./views/McpSettingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/skills',
      name: 'skills',
      component: () => import('./views/SkillsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('./views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('./views/RegisterView.vue'),
    },
  ],
})

router.beforeEach((to, _from) => {
  const authed = isAuthenticated()
  if (to.meta.requiresAuth && !authed) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (!to.meta.requiresAuth && authed && (to.name === 'login' || to.name === 'register')) {
    return { name: 'analyze' }
  }
})
