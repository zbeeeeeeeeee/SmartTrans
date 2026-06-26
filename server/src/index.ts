import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { createLogger } from './utils/logger'
import { config } from './config'
import './db/index'
import { errorHandler } from './middleware/error'
import analysisRoutes from './routes/analysis.routes'
import knowledgeRoutes from './routes/knowledge.routes'
import reportsRoutes from './routes/reports.routes'
import { mcpRoutes } from './routes/mcp.routes'
import { mcpManager } from './mcp/manager'
import { pdfMcpHandler } from './mcp/pdf-endpoint'

const log = createLogger('server')

const app = express()

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/uploads', express.static(config.paths.uploads))

// MCP PDF 工具端点（JSON-RPC 2.0 over HTTP）—— 需要原始 body 解析
app.post('/api/mcp/pdf-tool', pdfMcpHandler)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})
app.use('/api/reports', reportsRoutes)
app.use('/api/knowledge', knowledgeRoutes)
app.use('/api/mcp', mcpRoutes)
app.use('/api', analysisRoutes)

const webDist = path.resolve(config.paths.serverRoot, '..', 'web', 'dist')
if (fs.existsSync(webDist)) {
  log.info(`托管前端静态文件 — ${webDist}`)
  app.use(express.static(webDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'))
  })
} else {
  log.info('前端 dist 不存在，仅提供 API 服务')
}

app.use(errorHandler)

// 初始化 MCP Manager（后台异步，不阻塞服务启动）
mcpManager.initialize().catch((e) => log.error('MCP 初始化失败', e))

app.listen(config.port, () => {
  log.info(`服务启动 — http://localhost:${config.port}`)
  log.info(`模型配置 — vision=${config.vision.model}, reasoning=${config.reasoning.model}, embedding=${config.embedding.model}`)
  log.info(`MCP 功能 — ${config.mcp.enabled ? '已启用' : '已禁用'}`)
})
