import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { createLogger } from './utils/logger'
import { config } from './config'
import { db } from './db/index'
import { errorHandler } from './middleware/error'
import analysisRoutes from './routes/analysis.routes'
import authRoutes from './routes/auth.routes'
import knowledgeRoutes from './routes/knowledge.routes'
import reportsRoutes from './routes/reports.routes'
import { mcpRoutes } from './routes/mcp.routes'
import { mcpManager } from './mcp/manager'
import { skillsRoutes } from './routes/skills.routes'
import { skillsManager } from './skills/manager'

const log = createLogger('server')

const app = express()

// 生产环境可通过 ALLOWED_ORIGINS 限制跨域来源（逗号分隔），未设置则兼容开发环境允许所有来源
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean)
app.use(
  cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/uploads', express.static(config.paths.uploads))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})
app.use('/api/reports', reportsRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/knowledge', knowledgeRoutes)
app.use('/api/mcp', mcpRoutes)
app.use('/api/skills', skillsRoutes)
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
// 初始化 Skills Manager（后台异步，不阻塞服务启动）
skillsManager.initialize().catch((e) => log.error('Skills 初始化失败', e))

const server = app.listen(config.port, () => {
  log.info(`服务启动 — http://localhost:${config.port}`)
  log.info(`模型配置 — vision=${config.vision.model}, reasoning=${config.reasoning.model}, embedding=${config.embedding.model}`)
  log.info(`MCP 功能 — ${config.mcp.enabled ? '已启用' : '已禁用'}`)
})

// 优雅关闭
async function gracefulShutdown(signal: string) {
  log.info(`收到 ${signal} 信号，开始优雅关闭...`)
  // 1. 停止接收新请求
  server.close((err) => {
    if (err) log.warn('关闭 HTTP 服务时出错', err)
  })
  // 2. 关闭 MCP 连接
  try {
    await mcpManager.shutdown()
  } catch (e) {
    log.warn('关闭 MCP 时出错', e)
  }
  // 3. 关闭 Skills Manager
  try {
    await skillsManager.shutdown()
  } catch (e) {
    log.warn('关闭 Skills 时出错', e)
  }
  // 4. 关闭 SQLite 数据库
  try {
    db.close()
    log.info('数据库已关闭')
  } catch (e) {
    log.warn('关闭数据库时出错', e)
  }
  log.info('服务已安全退出')
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
