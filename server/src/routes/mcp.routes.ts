import { Router } from 'express'
import { config } from '../config'
import { createLogger } from '../utils/logger'
import { mcpManager } from '../mcp/manager'
import {
  getMcpConnection,
  setAgentMcpSetting,
  getAgentMcpSettings,
  getAllAgentMcpSettings,
} from '../mcp/store'

const log = createLogger('mcp-routes')
export const mcpRoutes = Router()

/** 检查 MCP 是否启用的中间件 */
function requireMcpEnabled(_req: any, res: any, next: any) {
  if (!config.mcp.enabled) {
    return res.status(404).json({ error: 'MCP is disabled', disabled: true })
  }
  next()
}

// ---- 全局状态（始终可访问） ----

mcpRoutes.get('/status', (_req, res) => {
  res.json({ mcpEnabled: config.mcp.enabled })
})

// ---- MCP 连接管理（需要 enabled） ----

mcpRoutes.get('/connections', requireMcpEnabled, (_req, res) => {
  const list = mcpManager.listConnections()
  res.json(list)
})

mcpRoutes.post('/connections', requireMcpEnabled, async (req, res) => {
  try {
    const { name, transport, url, command, args, headers } = req.body
    if (!name || !transport) {
      return res.status(400).json({ error: '缺少必填字段: name, transport' })
    }
    if ((transport === 'http' || transport === 'sse') && !url) {
      return res.status(400).json({ error: 'HTTP/SSE 传输类型需要 url' })
    }
    if (transport === 'stdio' && !command) {
      return res.status(400).json({ error: 'Stdio 传输类型需要 command' })
    }
    const status = await mcpManager.addConnection({
      name,
      transport,
      url,
      command,
      args: typeof args === 'string' ? args.split(',').map((s: string) => s.trim()).filter(Boolean) : args,
      headers,
    })
    log.info(`新增 MCP 连接 — ${name} (${status.id})`)
    res.json(status)
  } catch (e) {
    log.error('添加 MCP 连接失败', e)
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

mcpRoutes.delete('/connections/:id', requireMcpEnabled, async (req, res) => {
  try {
    const conn = getMcpConnection(req.params.id)
    if (conn?.isSystem) {
      return res.status(403).json({ error: '系统连接不可删除' })
    }
    await mcpManager.removeConnection(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    log.error('删除 MCP 连接失败', e)
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

mcpRoutes.post('/connections/:id/reconnect', requireMcpEnabled, async (req, res) => {
  try {
    const status = await mcpManager.reconnect(req.params.id)
    res.json(status)
  } catch (e) {
    log.error('重连 MCP 失败', e)
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

mcpRoutes.get('/connections/:id/tools', requireMcpEnabled, async (req, res) => {
  try {
    const tools = await mcpManager.getToolsForConnection(req.params.id)
    res.json(tools)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

// ---- 智能体 MCP 配置 ----

mcpRoutes.get('/agent-settings', requireMcpEnabled, (req, res) => {
  const agentName = req.query.agent as string | undefined
  if (agentName) {
    res.json(getAgentMcpSettings(agentName))
  } else {
    res.json(getAllAgentMcpSettings())
  }
})

mcpRoutes.put('/agent-settings', requireMcpEnabled, (req, res) => {
  try {
    const { agentName, mcpConnectionId, enabled } = req.body
    if (!agentName || !mcpConnectionId) {
      return res.status(400).json({ error: '缺少必填字段: agentName, mcpConnectionId' })
    }
    setAgentMcpSetting(agentName, mcpConnectionId, Boolean(enabled))
    res.json({ ok: true })
  } catch (e) {
    log.error('更新 agent MCP 配置失败', e)
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})
