export interface StageEvent {
  type: 'stage_start' | 'stage_complete' | 'done' | 'error'
  stage?: string
  label?: string
  data?: unknown
  reportId?: string
  report?: unknown
  message?: string
}

/** 调用 /api/analyze（multipart），消费 SSE 流，逐阶段回调 */
export async function analyze(
  files: File[],
  description: string,
  onEvent: (e: StageEvent) => void,
): Promise<void> {
  const fd = new FormData()
  for (const f of files) fd.append('images', f)
  fd.append('description', description)

  const res = await fetch('/api/analyze', { method: 'POST', body: fd })
  if (!res.ok || !res.body) throw new Error(`请求失败：HTTP ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as StageEvent)
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}

export interface ReportSummary {
  id: string
  description: string
  createdAt: string
  severity: { level?: string } | null
  hasPdf: boolean
}

export interface ReportRecord {
  id: string
  description: string
  imagePaths: string[]
  scene: unknown
  severity: unknown
  liability: unknown
  report: unknown
  createdAt: string
  pdfPath: string | null
}

export async function listReports(): Promise<ReportSummary[]> {
  return (await fetch('/api/reports')).json()
}

export async function getReport(id: string): Promise<ReportRecord> {
  return (await fetch(`/api/reports/${id}`)).json()
}

export interface KnowledgeStats {
  documents: number
  chunks: number
}

export interface LegalChunk {
  id: number
  content: string
  articleNo: string | null
  source: string
  distance: number
}

export async function knowledgeStats(): Promise<KnowledgeStats> {
  return (await fetch('/api/knowledge')).json()
}

export async function searchKnowledge(query: string, k = 5): Promise<LegalChunk[]> {
  const res = await fetch('/api/knowledge/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, k }),
  })
  return res.json()
}

// ---- RAG 文档管理 ----

export interface UploadedDocument {
  id: number
  title: string
  source: string
  category: string
  createdAt: string
  chunkCount: number
}

/** 上传 .md/.txt 知识库文档 */
export async function uploadKnowledgeFile(file: File): Promise<UploadedDocument> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/knowledge/documents', { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** 上传 .md/.txt 知识库文档（支持进度回调） */
export function uploadKnowledgeFileWithProgress(
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadedDocument> {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('解析响应失败'))
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText)
          reject(new Error((err as { error?: string }).error ?? `HTTP ${xhr.status}`))
        } catch {
          reject(new Error(`HTTP ${xhr.status}`))
        }
      }
    })
    xhr.addEventListener('error', () => reject(new Error('网络错误')))
    xhr.open('POST', '/api/knowledge/documents')
    xhr.send(fd)
  })
}

/** 列出所有已上传的文档 */
export async function listKnowledgeDocuments(): Promise<UploadedDocument[]> {
  const res = await fetch('/api/knowledge/documents')
  return res.json()
}

/** 删除指定文档 */
export async function deleteKnowledgeDocument(id: number): Promise<void> {
  const res = await fetch(`/api/knowledge/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除失败: HTTP ${res.status}`)
}

// ---- MCP ----

export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: unknown
}

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

export interface AgentMcpSetting {
  agentName: string
  mcpConnectionId: string
  enabled: boolean
}

export interface AddMcpConfig {
  name: string
  transport: 'http' | 'sse' | 'stdio'
  url?: string
  command?: string
  args?: string[]
  headers?: Record<string, string>
}

/** MCP 全局状态 */
export async function getMcpStatus(): Promise<{ mcpEnabled: boolean }> {
  return (await fetch('/api/mcp/status')).json()
}

/** 列出所有 MCP 连接 */
export async function listMcpConnections(): Promise<McpConnectionStatus[]> {
  return (await fetch('/api/mcp/connections')).json()
}

/** 添加 MCP 连接 */
export async function addMcpConnection(config: AddMcpConfig): Promise<McpConnectionStatus> {
  const res = await fetch('/api/mcp/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** 删除 MCP 连接 */
export async function deleteMcpConnection(id: string): Promise<void> {
  const res = await fetch(`/api/mcp/connections/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除失败: HTTP ${res.status}`)
}

/** 重连 MCP */
export async function reconnectMcpConnection(id: string): Promise<McpConnectionStatus> {
  const res = await fetch(`/api/mcp/connections/${id}/reconnect`, { method: 'POST' })
  if (!res.ok) throw new Error(`重连失败: HTTP ${res.status}`)
  return res.json()
}

/** 获取智能体 MCP 配置 */
export async function getAgentMcpSettings(agentName?: string): Promise<AgentMcpSetting[]> {
  const query = agentName ? `?agent=${encodeURIComponent(agentName)}` : ''
  return (await fetch(`/api/mcp/agent-settings${query}`)).json()
}

/** 更新智能体 MCP 启用/禁用 */
export async function updateAgentMcpSetting(
  agentName: string,
  mcpConnectionId: string,
  enabled: boolean,
): Promise<void> {
  const res = await fetch('/api/mcp/agent-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentName, mcpConnectionId, enabled }),
  })
  if (!res.ok) throw new Error(`更新失败: HTTP ${res.status}`)
}

/** 下载报告 PDF */
export function downloadReportPdf(id: string): void {
  window.open(`/api/reports/${id}/pdf`, '_blank')
}
