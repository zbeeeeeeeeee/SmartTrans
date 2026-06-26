/** MCP 连接配置（持久化到 DB） */
export interface McpConnectionConfig {
  id: string // UUID
  name: string
  transport: 'http' | 'sse' | 'stdio'
  url?: string
  command?: string
  args?: string[]
  headers?: Record<string, string>
  isSystem?: boolean
}

/** MCP 连接运行时状态（API 返回给前端） */
export interface McpConnectionStatus {
  id: string
  name: string
  transport: string
  url?: string
  status: 'connecting' | 'connected' | 'error' | 'stopped'
  errorMsg?: string
  toolCount: number
  tools: McpToolInfo[]
  createdAt: string
  isSystem?: boolean
}

/** 单个 MCP 工具的元信息 */
export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: unknown
}

/** 智能体-MCP 关联设置 */
export interface AgentMcpSetting {
  agentName: string
  mcpConnectionId: string
  enabled: boolean
}
