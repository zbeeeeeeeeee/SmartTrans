export interface StageEvent {
  type: 'stage_start' | 'stage_complete' | 'done' | 'error'
  stage?: string
  label?: string
  data?: unknown
  skillNames?: string[]
  reportId?: string
  report?: unknown
  message?: string
}

/** Call POST /api/analyze (multipart), consume SSE stream, call onEvent per stage */
export async function analyze(
  files: File[],
  description: string,
  language: string,
  onEvent: (e: StageEvent) => void,
): Promise<void> {
  const fd = new FormData()
  for (const f of files) fd.append('images', f)
  fd.append('description', description)
  fd.append('language', language)

  const res = await fetch('/api/analyze', { method: 'POST', body: fd })
  if (!res.ok || !res.body) throw new Error(`Request failed: HTTP ${res.status}`)

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

// ---- RAG Document Management ----

export interface UploadedDocument {
  id: number
  title: string
  source: string
  category: string
  createdAt: string
  chunkCount: number
}

/** Upload .md/.txt knowledge base document */
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

/** Upload .md/.txt knowledge base document (with progress callback) */
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
          reject(new Error('Failed to parse response'))
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
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.open('POST', '/api/knowledge/documents')
    xhr.send(fd)
  })
}

/** List all uploaded documents */
export async function listKnowledgeDocuments(): Promise<UploadedDocument[]> {
  const res = await fetch('/api/knowledge/documents')
  return res.json()
}

/** Delete a document */
export async function deleteKnowledgeDocument(id: number): Promise<void> {
  const res = await fetch(`/api/knowledge/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`)
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

/** MCP global status */
export async function getMcpStatus(): Promise<{ mcpEnabled: boolean }> {
  return (await fetch('/api/mcp/status')).json()
}

/** List all MCP connections */
export async function listMcpConnections(): Promise<McpConnectionStatus[]> {
  return (await fetch('/api/mcp/connections')).json()
}

/** Add MCP connection */
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

/** Delete MCP connection */
export async function deleteMcpConnection(id: string): Promise<void> {
  const res = await fetch(`/api/mcp/connections/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`)
}

/** Reconnect MCP */
export async function reconnectMcpConnection(id: string): Promise<McpConnectionStatus> {
  const res = await fetch(`/api/mcp/connections/${id}/reconnect`, { method: 'POST' })
  if (!res.ok) throw new Error(`Reconnect failed: HTTP ${res.status}`)
  return res.json()
}

/** Get agent MCP settings */
export async function getAgentMcpSettings(agentName?: string): Promise<AgentMcpSetting[]> {
  const query = agentName ? `?agent=${encodeURIComponent(agentName)}` : ''
  return (await fetch(`/api/mcp/agent-settings${query}`)).json()
}

/** Update agent MCP enable/disable */
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
  if (!res.ok) throw new Error(`Update failed: HTTP ${res.status}`)
}

/** Download report PDF */
export function downloadReportPdf(id: string): void {
  window.open(`/api/reports/${id}/pdf`, '_blank')
}

// ---- Skills ----

export interface SkillMeta {
  id: string
  name: string
  description: string
  sourcePath: string
  filesJson: string[]
  providerRef: string | null
  uploadStatus: 'local' | 'uploaded' | 'failed'
  isSystem: boolean
  enabled: boolean
  createdAt: string
}

export interface ParsedSkill {
  name: string
  description: string
  instructions: string
  files: { path: string; content: string }[]
}

export interface SkillWithContent {
  meta: SkillMeta
  parsed: ParsedSkill
}

export interface AgentSkillSetting {
  agentName: string
  skillId: string
  enabled: boolean
}

export interface ProviderCapabilities {
  supportsNativeSkills: boolean
}

/** List all skills */
export async function listSkills(): Promise<SkillMeta[]> {
  return (await fetch('/api/skills')).json()
}

/** Get single skill with full content */
export async function getSkill(id: string): Promise<SkillWithContent> {
  return (await fetch(`/api/skills/${id}`)).json()
}

/** Create skill */
export async function createSkill(skillMd: string, files?: { path: string; content: string }[]): Promise<SkillMeta> {
  const res = await fetch('/api/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillMd, files: files ?? [] }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** Delete skill */
export async function deleteSkill(id: string): Promise<void> {
  const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`)
}

/** Get agent-skill bindings */
export async function getAgentSkillSettings(agentName?: string): Promise<AgentSkillSetting[]> {
  const query = agentName ? `?agent=${encodeURIComponent(agentName)}` : ''
  return (await fetch(`/api/skills/bindings/agent-settings${query}`)).json()
}

/** Update agent-skill binding */
export async function updateAgentSkillSetting(
  agentName: string,
  skillId: string,
  enabled: boolean,
): Promise<void> {
  const res = await fetch('/api/skills/bindings/agent-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentName, skillId, enabled }),
  })
  if (!res.ok) throw new Error(`Update failed: HTTP ${res.status}`)
}

/** Update skill global enable/disable */
export async function updateSkillEnabled(id: string, enabled: boolean): Promise<void> {
  const res = await fetch(`/api/skills/${id}/enabled`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new Error(`Update failed: HTTP ${res.status}`)
}

/** Query provider capability for native uploadSkill */
export async function getProviderCapabilities(): Promise<ProviderCapabilities> {
  return (await fetch('/api/skills/meta/provider-capabilities')).json()
}
