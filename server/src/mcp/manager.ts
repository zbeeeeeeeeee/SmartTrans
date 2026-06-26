import crypto from 'node:crypto'
import path from 'node:path'
import { createMCPClient } from '@ai-sdk/mcp'
import { jsonSchema } from 'ai'
import { createLogger } from '../utils/logger'
import { db } from '../db/index'
import { config } from '../config'
import { generatePdf } from '../pdf/generator'
import type { McpConnectionConfig, McpConnectionStatus, McpToolInfo } from './types'
import {
  insertMcpConnection,
  deleteMcpConnection,
  updateMcpStatus,
  listMcpConnections,
  getEnabledMcpIdsForAgent,
  seedPresetConnection,
} from './store'

const log = createLogger('mcp-manager')

type MCPClient = Awaited<ReturnType<typeof createMCPClient>>

interface ClientEntry {
  config: McpConnectionConfig
  client: MCPClient | null
  toolCache: McpToolInfo[] | null
}

class McpManager {
  private clients = new Map<string, ClientEntry>()

  /** 从 DB 加载所有连接配置并自动建立连接 */
  async initialize(): Promise<void> {
    if (!config.mcp.enabled) {
      log.info('MCP 功能已禁用，跳过初始化')
      return
    }
    // 1. 先播种预置的系统连接
    this.seedPresets()
    // 2. 加载所有连接
    const connections = listMcpConnections()
    log.info(`加载 ${connections.length} 个 MCP 连接配置`)
    for (const conn of connections) {
      this.clients.set(conn.id, { config: conn, client: null, toolCache: null })
      // 后台连接，不阻塞启动
      this.connect(conn.id).catch(() => {})
    }
  }

  /** 添加新连接：持久化并立即连接 */
  async addConnection(
    input: Omit<McpConnectionConfig, 'id'>,
  ): Promise<McpConnectionStatus> {
    const id = crypto.randomUUID()
    const cfg: McpConnectionConfig = { id, ...input }
    insertMcpConnection(cfg)
    this.clients.set(id, { config: cfg, client: null, toolCache: null })
    await this.connect(id)
    return this.toStatus(id)
  }

  /** 移除连接 */
  async removeConnection(id: string): Promise<void> {
    const entry = this.clients.get(id)
    if (entry?.config.isSystem) {
      throw new Error('系统连接不可删除')
    }
    if (entry?.client) {
      try {
        await entry.client.close()
      } catch (e) {
        log.warn(`关闭 MCP client ${id} 时出错: ${e}`)
      }
    }
    this.clients.delete(id)
    deleteMcpConnection(id)
    log.info(`MCP 连接已删除 — ${id}`)
  }

  /** 重连 */
  async reconnect(id: string): Promise<McpConnectionStatus> {
    const entry = this.clients.get(id)
    if (!entry) throw new Error(`MCP 连接不存在: ${id}`)
    if (entry.client) {
      try { await entry.client.close() } catch { /* ignore */ }
    }
    entry.client = null
    entry.toolCache = null
    await this.connect(id)
    // connect() 内部捕获异常并更新 DB 状态，需检查连接结果
    const status = this.toStatus(id)
    if (status.status === 'error') {
      throw new Error(status.errorMsg ?? '连接失败')
    }
    return status
  }

  /** 列出所有连接状态 */
  listConnections(): McpConnectionStatus[] {
    return Array.from(this.clients.values()).map((e) => this.entryToStatus(e))
  }

  /** 获取某个连接的工具列表（缓存） */
  async getToolsForConnection(id: string): Promise<McpToolInfo[]> {
    const entry = this.clients.get(id)
    if (!entry) return []
    if (entry.toolCache) return entry.toolCache
    if (!entry.client) return []
    try {
      const result = (await entry.client.listTools()) as { tools: Record<string, any> }
      const toolList = Object.values(result.tools)
      const mapped: McpToolInfo[] = toolList.map((t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }))
      entry.toolCache = mapped
      return mapped
    } catch {
      return []
    }
  }

  /** 核心方法：获取某智能体启用的所有 MCP 工具（聚合） */
  async getToolsForAgent(agentName: string): Promise<Record<string, any>> {
    if (!config.mcp.enabled) return {}
    const enabledIds = getEnabledMcpIdsForAgent(agentName)
    if (enabledIds.length === 0) return {}

    const allTools: Record<string, any> = {}
    for (const mcpId of enabledIds) {
      const entry = this.clients.get(mcpId)
      if (!entry) continue

      // 系统连接兜底：即使 stdio client 未连接，也用本地工具定义
      if (entry.config.isSystem && !entry.client && entry.toolCache) {
        for (const tool of entry.toolCache) {
          allTools[tool.name] = {
            description: tool.description,
            inputSchema: jsonSchema(tool.inputSchema),
            execute: this.buildSystemToolExecutor(tool.name),
          }
        }
        continue
      }

      if (!entry.client) continue
      try {
        const tools = await entry.client.tools()
        for (const [toolName, toolDef] of Object.entries(tools)) {
          // 工具名冲突时加 MCP 名称前缀
          const key = allTools[toolName] ? `${entry.config.name}__${toolName}` : toolName
          allTools[key] = toolDef
        }
      } catch (e) {
        log.warn(`获取 MCP ${mcpId} 工具失败: ${e}`)
      }
    }
    return allTools
  }

  /** 为系统连接构建本地 tool execute 函数（HTTP client 离线时的兜底） */
  private buildSystemToolExecutor(toolName: string): (args: Record<string, unknown>) => Promise<unknown> {
    if (toolName === 'generate_report_pdf') {
      return async (args: Record<string, unknown>) => {
        const reportJson = args.reportJson as string
        if (!reportJson) throw new Error('Missing required argument: reportJson')
        const report = JSON.parse(reportJson)
        const pdfFilename = `report-${crypto.randomUUID()}.pdf`
        const pdfPath = path.join(config.paths.pdfs, pdfFilename)
        await generatePdf(report, pdfPath)
        return { pdfPath: `pdfs/${pdfFilename}`, filename: pdfFilename, success: true }
      }
    }
    throw new Error(`Unknown system tool: ${toolName}`)
  }

  /** 关闭所有连接 */
  async shutdown(): Promise<void> {
    for (const [, entry] of this.clients) {
      if (entry.client) {
        try { await entry.client.close() } catch { /* ignore */ }
      }
    }
    this.clients.clear()
    log.info('所有 MCP 连接已关闭')
  }

  // ---- private ----

  private async connect(id: string): Promise<void> {
    const entry = this.clients.get(id)
    if (!entry) return
    const cfg = entry.config
    updateMcpStatus(id, 'connecting')
    try {
      const transport = await this.buildTransport(cfg)
      const client = await createMCPClient({ transport })
      entry.client = client
      entry.toolCache = null
      // 预热工具列表
      const result = (await client.listTools()) as { tools: Record<string, any> }
      const toolList = Object.values(result.tools)
      const mapped: McpToolInfo[] = toolList.map((t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }))
      entry.toolCache = mapped
      updateMcpStatus(id, 'connected')
      log.info(`MCP 连接成功 — ${cfg.name} (${id}), ${toolList.length} tools`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      updateMcpStatus(id, 'error', msg)
      log.error(`MCP 连接失败 — ${cfg.name} (${id}): ${msg}`)
      // 系统连接兜底：HTTP 连接失败时直接注入本地工具定义，不走网络
      if (cfg.isSystem) {
        entry.toolCache = this.getSystemToolDefs(cfg.id)
        log.info(`系统连接 ${cfg.name} 已降级为本地调用模式`)
      }
    }
  }

  /** 系统连接的工具定义（本地兜底，无需 HTTP） */
  private getSystemToolDefs(connectionId: string): McpToolInfo[] {
    if (connectionId === 'system-pdf-generator') {
      return [
        {
          name: 'generate_report_pdf',
          description:
            '根据事故报告 JSON 生成 PDF 格式的交通事故分析报告并入库存储。接收完整的结构化报告数据，返回生成的 PDF 文件路径。',
          inputSchema: {
            type: 'object' as const,
            properties: {
              reportJson: {
                type: 'string',
                description:
                  '事故报告 JSON 字符串，需符合 AccidentReport 结构（title, summary, sceneSummary, severityLevel, liabilityConclusion, citedArticles, recommendations）',
              },
            },
            required: ['reportJson'],
          },
        },
      ]
    }
    return []
  }

  private async buildTransport(cfg: McpConnectionConfig): Promise<any> {
    if (cfg.transport === 'stdio') {
      const { Experimental_StdioMCPTransport } = await import('@ai-sdk/mcp/mcp-stdio')
      return new Experimental_StdioMCPTransport({
        command: cfg.command!,
        args: cfg.args ?? [],
      })
    }
    return {
      type: cfg.transport === 'sse' ? 'sse' : 'http',
      url: cfg.url!,
      headers: cfg.headers,
    }
  }

  private toStatus(id: string): McpConnectionStatus {
    const entry = this.clients.get(id)
    if (!entry) throw new Error(`MCP 连接不存在: ${id}`)
    return this.entryToStatus(entry)
  }

  private entryToStatus(entry: ClientEntry): McpConnectionStatus {
    const row = db
      .prepare('SELECT status, error_msg, created_at FROM mcp_connections WHERE id = ?')
      .get(entry.config.id) as { status: string; error_msg: string | null; created_at: string } | undefined
    return {
      id: entry.config.id,
      name: entry.config.name,
      transport: entry.config.transport,
      url: entry.config.url,
      status: (row?.status as McpConnectionStatus['status']) ?? 'stopped',
      errorMsg: row?.error_msg ?? undefined,
      toolCount: entry.toolCache?.length ?? 0,
      tools: entry.toolCache ?? [],
      createdAt: row?.created_at ?? '',
      isSystem: entry.config.isSystem ?? false,
    }
  }

  /** 播种预置的系统 MCP 连接 */
  private seedPresets(): void {
    const PDF_PRESET_ID = 'system-pdf-generator'
    seedPresetConnection({
      id: PDF_PRESET_ID,
      name: 'PDF报告生成器',
      transport: 'stdio',
      command: 'node',
      args: ['--import', 'tsx', 'src/mcp/pdf-server.ts'],
      isSystem: true,
    })
    log.info('预置 MCP 连接已就绪 — PDF报告生成器')
  }
}

/** 全局单例 */
export const mcpManager = new McpManager()
