/** 获取当前存储的 accessToken */
function getToken(): string | null {
  return localStorage.getItem('accessToken')
}

/** 是否已登录 */
export function isAuthenticated(): boolean {
  return !!getToken()
}

/** 获取当前用户信息 */
export function getCurrentUser(): { id: string; username: string } | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** 退出登录 */
export function logout(): void {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
}

/** 通用 API 请求 — 自动带 Authorization header */
export async function apiClient(methodPath: string, body?: unknown): Promise<any> {
  const [method, path] = methodPath.split(' ', 2)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }

  return res.json()
}

/** 带 Authorization 的通用 GET 请求 */
async function authGet(path: string): Promise<any> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ============================================================
// SSE / Analysis
// ============================================================

export interface StageEvent {
  type: 'stage_start' | 'stage_complete' | 'done' | 'error'
  stage?: string
  label?: string
  data?: unknown
  skillNames?: string[]
  toolNames?: string[]
  reportId?: string
  report?: unknown
  message?: string
}

/** Call POST /api/analyze (multipart), consume SSE stream, call onEvent per stage */
export async function analyze(
  files: File[],
  description: string,
  language: string,
  coordinates: string,
  onEvent: (e: StageEvent) => void,
): Promise<void> {
  const fd = new FormData()
  for (const f of files) fd.append('images', f)
  fd.append('description', description)
  fd.append('language', language)
  fd.append('coordinates', coordinates)
  fd.append('timestamp', new Date().toISOString())

  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api/analyze', { method: 'POST', body: fd, headers })
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

// ============================================================
// Reports
// ============================================================

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
  return authGet('/api/reports')
}

export async function getReport(id: string): Promise<ReportRecord> {
  return authGet(`/api/reports/${id}`)
}

/** Download report PDF (fetch with JWT token, then trigger browser download) */
export async function downloadReportPdf(id: string): Promise<void> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`/api/reports/${id}/pdf`, { headers })
  if (!res.ok) {
    if (res.status === 404) throw new Error('PDF not found')
    throw new Error(`Download failed: HTTP ${res.status}`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report-${id}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ============================================================
// Workspace
// ============================================================

export interface WorkspaceFile {
  name: string
  size: number
  ext: string
}

export interface WorkspaceListing {
  files: WorkspaceFile[]
}

/** List files in a report's workspace */
export async function listWorkspace(reportId: string): Promise<WorkspaceFile[]> {
  const res = await authGet(`/api/reports/${reportId}/workspace`)
  return (res as WorkspaceListing).files
}

/** Build the URL to fetch a single workspace file (includes token for <img> auth) */
export function workspaceFileUrl(reportId: string, filename: string): string {
  const token = getToken()
  const base = `/api/reports/${reportId}/workspace/${encodeURIComponent(filename)}`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}

// ============================================================
// Knowledge Base
// ============================================================

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
  return authGet('/api/knowledge')
}

export async function searchKnowledge(query: string, k = 5): Promise<LegalChunk[]> {
  return apiClient('POST /api/knowledge/search', { query, k })
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
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch('/api/knowledge/documents', { method: 'POST', body: fd, headers })
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
    const token = getToken()
    xhr.open('POST', '/api/knowledge/documents')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(fd)
  })
}

/** List all uploaded documents */
export async function listKnowledgeDocuments(): Promise<UploadedDocument[]> {
  return authGet('/api/knowledge/documents')
}

/** Delete a document */
export async function deleteKnowledgeDocument(id: number): Promise<void> {
  await apiClient('DELETE /api/knowledge/documents/' + id)
}

// ============================================================
// MCP
// ============================================================

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
  return authGet('/api/mcp/status')
}

/** List all MCP connections */
export async function listMcpConnections(): Promise<McpConnectionStatus[]> {
  return authGet('/api/mcp/connections')
}

/** Add MCP connection */
export async function addMcpConnection(config: AddMcpConfig): Promise<McpConnectionStatus> {
  return apiClient('POST /api/mcp/connections', config)
}

/** Delete MCP connection */
export async function deleteMcpConnection(id: string): Promise<void> {
  await apiClient('DELETE /api/mcp/connections/' + id)
}

/** Reconnect MCP */
export async function reconnectMcpConnection(id: string): Promise<McpConnectionStatus> {
  return apiClient('POST /api/mcp/connections/' + id + '/reconnect')
}

/** Get agent MCP settings */
export async function getAgentMcpSettings(agentName?: string): Promise<AgentMcpSetting[]> {
  const query = agentName ? `?agent=${encodeURIComponent(agentName)}` : ''
  return authGet('/api/mcp/agent-settings' + query)
}

/** Update agent MCP enable/disable */
export async function updateAgentMcpSetting(
  agentName: string,
  mcpConnectionId: string,
  enabled: boolean,
): Promise<void> {
  await apiClient('PUT /api/mcp/agent-settings', { agentName, mcpConnectionId, enabled })
}

// ============================================================
// Skills
// ============================================================

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
  return authGet('/api/skills')
}

/** Get single skill with full content */
export async function getSkill(id: string): Promise<SkillWithContent> {
  return authGet('/api/skills/' + id)
}

/** Create skill */
export async function createSkill(skillMd: string, files?: { path: string; content: string }[]): Promise<SkillMeta> {
  return apiClient('POST /api/skills', { skillMd, files: files ?? [] })
}

/** Delete skill */
export async function deleteSkill(id: string): Promise<void> {
  await apiClient('DELETE /api/skills/' + id)
}

/** Get agent-skill bindings */
export async function getAgentSkillSettings(agentName?: string): Promise<AgentSkillSetting[]> {
  const query = agentName ? `?agent=${encodeURIComponent(agentName)}` : ''
  return authGet('/api/skills/bindings/agent-settings' + query)
}

/** Update agent-skill binding */
export async function updateAgentSkillSetting(
  agentName: string,
  skillId: string,
  enabled: boolean,
): Promise<void> {
  await apiClient('PUT /api/skills/bindings/agent-settings', { agentName, skillId, enabled })
}

/** Update skill global enable/disable */
export async function updateSkillEnabled(id: string, enabled: boolean): Promise<void> {
  await apiClient('PUT /api/skills/' + id + '/enabled', { enabled })
}

/** Query provider capability for native uploadSkill */
export async function getProviderCapabilities(): Promise<ProviderCapabilities> {
  return authGet('/api/skills/meta/provider-capabilities')
}
