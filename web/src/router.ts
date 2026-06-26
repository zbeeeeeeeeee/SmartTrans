import { createRouter, createWebHistory } from 'vue-router'
import AnalyzeView from './views/AnalyzeView.vue'
import HistoryView from './views/HistoryView.vue'
import KnowledgeView from './views/KnowledgeView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'analyze', component: AnalyzeView },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/knowledge', name: 'knowledge', component: KnowledgeView },
    {
      path: '/mcp',
      name: 'mcp',
      component: () => import('./views/McpSettingsView.vue'),
    },
  ],
})
