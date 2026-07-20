import { db } from '../db/index'
import type { McpConnectionConfig, AgentMcpSetting } from './types'

// ---- MCP 连接 CRUD ----

export function insertMcpConnection(config: McpConnectionConfig): void {
  db.prepare(
    `INSERT INTO mcp_connections (id, name, transport, url, command, args, headers, status, is_system)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'connecting', ?)`,
  ).run(
    config.id,
    config.name,
    config.transport,
    config.url ?? null,
    config.command ?? null,
    config.args ? JSON.stringify(config.args) : null,
    config.headers ? JSON.stringify(config.headers) : null,
    config.isSystem ? 1 : 0,
  )
}

export function deleteMcpConnection(id: string): void {
  const del = db.transaction(() => {
    db.prepare('DELETE FROM agent_mcp_settings WHERE mcp_connection_id = ?').run(id)
    db.prepare('DELETE FROM mcp_connections WHERE id = ?').run(id)
  })
  del()
}

export function updateMcpStatus(id: string, status: string, errorMsg?: string): void {
  db.prepare('UPDATE mcp_connections SET status = ?, error_msg = ? WHERE id = ?').run(
    status,
    errorMsg ?? null,
    id,
  )
}

export function listMcpConnections(): McpConnectionConfig[] {
  const rows = db.prepare('SELECT * FROM mcp_connections ORDER BY created_at DESC').all() as any[]
  return rows.map(deserializeConfig)
}

export function getMcpConnection(id: string): McpConnectionConfig | undefined {
  const row = db.prepare('SELECT * FROM mcp_connections WHERE id = ?').get(id) as any
  return row ? deserializeConfig(row) : undefined
}

function deserializeConfig(row: any): McpConnectionConfig {
  return {
    id: row.id,
    name: row.name,
    transport: row.transport,
    url: row.url ?? undefined,
    command: row.command ?? undefined,
    args: row.args ? JSON.parse(row.args) : undefined,
    headers: row.headers ? JSON.parse(row.headers) : undefined,
    isSystem: row.is_system === 1,
  }
}

// ---- 智能体-MCP 关联 ----

export function setAgentMcpSetting(
  agentName: string,
  mcpConnectionId: string,
  enabled: boolean,
): void {
  db.prepare(
    `INSERT INTO agent_mcp_settings (agent_name, mcp_connection_id, enabled)
     VALUES (?, ?, ?)
     ON CONFLICT(agent_name, mcp_connection_id) DO UPDATE SET enabled = excluded.enabled`,
  ).run(agentName, mcpConnectionId, enabled ? 1 : 0)
}

export function getAgentMcpSettings(agentName: string): AgentMcpSetting[] {
  const rows = db
    .prepare('SELECT * FROM agent_mcp_settings WHERE agent_name = ?')
    .all(agentName) as any[]
  return rows.map((r) => ({
    agentName: r.agent_name,
    mcpConnectionId: r.mcp_connection_id,
    enabled: r.enabled === 1,
  }))
}

export function getEnabledMcpIdsForAgent(agentName: string): string[] {
  const rows = db
    .prepare('SELECT mcp_connection_id FROM agent_mcp_settings WHERE agent_name = ? AND enabled = 1')
    .all(agentName) as any[]
  return rows.map((r) => r.mcp_connection_id)
}

export function getMcpConnectionByName(name: string): McpConnectionConfig | undefined {
  const row = db.prepare('SELECT * FROM mcp_connections WHERE name = ?').get(name) as any
  return row ? deserializeConfig(row) : undefined
}

export function seedPresetConnection(config: McpConnectionConfig): void {
  const existing = getMcpConnectionByName(config.name)
  if (existing) {
    // 用户创建的连接与系统预设同名时，跳过覆盖，保护用户数据
    if (!existing.isSystem) return
    // 已存在的系统连接：覆盖 transport/url/command/args 以确保预设更新生效
    db.prepare(
      `UPDATE mcp_connections
       SET transport = ?, url = ?, command = ?, args = ?, is_system = 1
       WHERE name = ?`,
    ).run(
      config.transport,
      config.url ?? null,
      config.command ?? null,
      config.args ? JSON.stringify(config.args) : null,
      config.name,
    )
    return
  }
  db.prepare(
    `INSERT INTO mcp_connections (id, name, transport, url, command, args, headers, status, is_system)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'stopped', 1)`,
  ).run(
    config.id,
    config.name,
    config.transport,
    config.url ?? null,
    config.command ?? null,
    config.args ? JSON.stringify(config.args) : null,
    config.headers ? JSON.stringify(config.headers) : null,
  )
}

/** 仅在尚不存在时创建 agent-MCP 绑定（不覆盖用户已做的设置） */
export function seedAgentMcpSetting(
  agentName: string,
  mcpConnectionId: string,
  enabled: boolean,
): void {
  const exists = db
    .prepare('SELECT id FROM agent_mcp_settings WHERE agent_name = ? AND mcp_connection_id = ?')
    .get(agentName, mcpConnectionId)
  if (!exists) {
    db.prepare(
      'INSERT INTO agent_mcp_settings (agent_name, mcp_connection_id, enabled) VALUES (?, ?, ?)',
    ).run(agentName, mcpConnectionId, enabled ? 1 : 0)
  }
}

export function getAllAgentMcpSettings(): AgentMcpSetting[] {
  const rows = db.prepare('SELECT * FROM agent_mcp_settings').all() as any[]
  return rows.map((r) => ({
    agentName: r.agent_name,
    mcpConnectionId: r.mcp_connection_id,
    enabled: r.enabled === 1,
  }))
}
