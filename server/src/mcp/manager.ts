import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
const here = path.dirname(fileURLToPath(import.meta.url))

type MCPClient = Awaited<ReturnType<typeof createMCPClient>>

interface ClientEntry {
  config: McpConnectionConfig
  client: MCPClient | null
  toolCache: McpToolInfo[] | null
  /** AI SDK tool 对象缓存（client.tools() 返回值），避免每次 getToolsForAgent 都发起网络请求 */
  aiToolCache: Record<string, any> | null
  /** 当前正在进行的连接 Promise，用于竞态修复：getToolsForAgent 等待连接完成 */
  connectPromise: Promise<void> | null
}

/** Promise.race 超时辅助 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时 (${ms}ms)`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
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
      const entry: ClientEntry = {
        config: conn,
        client: null,
        toolCache: null,
        aiToolCache: null,
        connectPromise: null,
      }
      // 系统连接：预先填充本地工具定义，确保 connect() 完成前 getToolsForAgent() 也能返回工具
      if (conn.isSystem) {
        entry.toolCache = this.getSystemToolDefs(conn.id)
      }
      this.clients.set(conn.id, entry)
      // 后台连接，存储 connectPromise 用于竞态修复
      log.info(`初始化后台连接 — ${conn.name} (${conn.id}), transport=${conn.transport}, isSystem=${conn.isSystem}`)
      entry.connectPromise = this.connect(conn.id).catch(() => {})
    }
  }

  /** 添加新连接：持久化并立即连接 */
  async addConnection(
    input: Omit<McpConnectionConfig, 'id'>,
  ): Promise<McpConnectionStatus> {
    const id = crypto.randomUUID()
    const cfg: McpConnectionConfig = { id, ...input }
    insertMcpConnection(cfg)
    const entry: ClientEntry = {
      config: cfg,
      client: null,
      toolCache: null,
      aiToolCache: null,
      connectPromise: null,
    }
    this.clients.set(id, entry)
    entry.connectPromise = this.connect(id)
    await entry.connectPromise
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
    log.info(`重连 MCP — ${entry.config.name} (${id}), 清空缓存...`)
    if (entry.client) {
      try { await entry.client.close() } catch { /* ignore */ }
    }
    entry.client = null
    entry.toolCache = null
    entry.aiToolCache = null
    entry.connectPromise = this.connect(id)
    await entry.connectPromise
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

  /** 核心方法：获取某智能体启用的所有 MCP 工具（聚合）。toolFilter 为可选工具名 allowlist */
  async getToolsForAgent(agentName: string, toolFilter?: string[]): Promise<Record<string, any>> {
    if (!config.mcp.enabled) return {}
    const enabledIds = getEnabledMcpIdsForAgent(agentName)
    if (enabledIds.length === 0) return {}

    const allTools: Record<string, any> = {}
    for (const mcpId of enabledIds) {
      const entry = this.clients.get(mcpId)
      if (!entry) {
        log.warn(`[getToolsForAgent] ${agentName} — entry not found for ${mcpId}`)
        continue
      }

      // 竞态修复：如果 client 为 null 但连接正在进行中，等待其完成
      if (!entry.client && entry.connectPromise) {
        log.info(`[getToolsForAgent] ${agentName} — ${entry.config.name}: 等待连接完成...`)
        const t0 = Date.now()
        try {
          await entry.connectPromise
          log.info(`[getToolsForAgent] ${agentName} — ${entry.config.name}: 连接完成，耗时 ${Date.now() - t0}ms, client=${entry.client ? 'ok' : 'null'}`)
        } catch {
          log.warn(`[getToolsForAgent] ${agentName} — ${entry.config.name}: 连接失败，耗时 ${Date.now() - t0}ms`)
        }
      }

      // 系统连接兜底：即使 client 未连接，也用本地工具定义
      if (entry.config.isSystem && !entry.client && entry.toolCache) {
        log.info(`[getToolsForAgent] ${agentName} — ${entry.config.name}: 使用本地兜底 (${entry.toolCache.length} tools)`)
        for (const tool of entry.toolCache) {
          if (toolFilter && !toolFilter.includes(tool.name)) continue
          allTools[tool.name] = {
            description: tool.description,
            inputSchema: jsonSchema(tool.inputSchema),
            execute: this.buildSystemToolExecutor(tool.name),
          }
        }
        continue
      }

      if (!entry.client) {
        log.warn(`[getToolsForAgent] ${agentName} — ${mcpId} (${entry.config.name}): client is null, skipping`)
        continue
      }

      try {
        // 优先使用 aiToolCache 缓存，否则调用 client.tools() 并缓存
        let tools: Record<string, any>
        if (entry.aiToolCache) {
          tools = entry.aiToolCache
          const toolNames = Object.keys(tools)
          log.info(`[getToolsForAgent] ${agentName} — ${entry.config.name}: aiToolCache 命中 (${toolNames.length} tools: [${toolNames.join(', ')}])`)
        } else {
          log.info(`[getToolsForAgent] ${agentName} — ${entry.config.name}: aiToolCache 未命中，调用 client.tools()...`)
          const t0 = Date.now()
          tools = await withTimeout(
            entry.client.tools(),
            5000,
            `client.tools() for ${entry.config.name}`,
          )
          entry.aiToolCache = tools
          const toolNames = Object.keys(tools)
          log.info(`[getToolsForAgent] ${agentName} — ${entry.config.name}: client.tools() 完成，耗时 ${Date.now() - t0}ms, ${toolNames.length} tools: [${toolNames.join(', ')}]`)
        }

        let kept = 0
        for (const [toolName, toolDef] of Object.entries(tools)) {
          if (toolFilter && !toolFilter.includes(toolName)) continue
          // 工具名冲突时加 MCP 名称前缀
          const key = allTools[toolName] ? `${entry.config.name}__${toolName}` : toolName
          allTools[key] = toolDef
          kept++
        }
        if (toolFilter) {
          log.info(`[getToolsForAgent] ${agentName} — ${entry.config.name}: ${kept}/${Object.keys(tools).length} tools kept (filter: [${toolFilter.join(', ')}])`)
        }
      } catch (e) {
        log.warn(`获取 MCP ${mcpId} 工具失败: ${e}`)
      }
    }
    return allTools
  }

  /** 为系统连接构建本地 tool execute 函数（MCP client 离线时的兜底） */
  private buildSystemToolExecutor(toolName: string): (args: Record<string, unknown>) => Promise<unknown> {
    if (toolName === 'generate_report_pdf') {
      return async (args: Record<string, unknown>) => {
        const reportJson = args.reportJson as string
        if (!reportJson) throw new Error('Missing required argument: reportJson')
        const report = JSON.parse(reportJson)
        const language = (args.language as string) ?? 'en'
        const pdfFilename = `report-${crypto.randomUUID()}.pdf`
        const pdfPath = path.join(config.paths.pdfs, pdfFilename)
        await generatePdf(report, pdfPath, language as any)
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
    log.info(`开始连接 MCP — ${cfg.name} (${cfg.id}), transport=${cfg.transport}`)
    updateMcpStatus(id, 'connecting')
    const t0 = Date.now()
    try {
      await withTimeout(this.doConnect(entry), 15000, `MCP 连接 ${cfg.name}`)
      log.info(`MCP 连接完成 — ${cfg.name}, 耗时 ${Date.now() - t0}ms`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const elapsed = Date.now() - t0
      updateMcpStatus(id, 'error', msg)
      log.error(`MCP 连接失败 — ${cfg.name} (${id}), 耗时 ${elapsed}ms: ${msg}`)
      // 系统连接兜底：client 连接失败时直接注入本地工具定义，不走网络
      if (cfg.isSystem) {
        entry.toolCache = this.getSystemToolDefs(cfg.id)
        log.info(`系统连接 ${cfg.name} 已降级为本地调用模式 (${entry.toolCache.length} tools)`)
      }
    }
  }

  /** 实际执行连接逻辑（不含超时，由 connect() 包裹超时控制） */
  private async doConnect(entry: ClientEntry): Promise<void> {
    const cfg = entry.config
    const t0 = Date.now()
    const transportDetail = cfg.transport === 'stdio'
      ? `stdio: ${cfg.command} ${(cfg.args ?? []).join(' ')}`
      : `${cfg.transport}: ${cfg.url}`
    log.info(`开始连接 MCP — ${cfg.name} (${transportDetail})`)

    const transport = await this.buildTransport(cfg)
    const client = await createMCPClient({ transport })
    entry.client = client
    entry.toolCache = null
    entry.aiToolCache = null
    log.info(`MCP client 已创建 — ${cfg.name}, 耗时 ${Date.now() - t0}ms`)

    // 预热工具元数据列表
    const result = (await client.listTools()) as { tools: Record<string, any> }
    const toolList = Object.values(result.tools)
    const mapped: McpToolInfo[] = toolList.map((t: any) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
    entry.toolCache = mapped
    log.info(`toolCache 已预热 — ${cfg.name}: ${mapped.length} tools, 耗时 ${Date.now() - t0}ms`)

    // 预热 AI SDK tool 缓存（后续 getToolsForAgent 直接复用，不再发起网络请求）
    entry.aiToolCache = await client.tools()
    const aiToolNames = Object.keys(entry.aiToolCache)
    log.info(`aiToolCache 已预热 — ${cfg.name}: ${aiToolNames.length} tools [${aiToolNames.join(', ')}], 总耗时 ${Date.now() - t0}ms`)

    updateMcpStatus(cfg.id, 'connected')
    log.info(`MCP 连接成功 — ${cfg.name} (${cfg.id}), ${toolList.length} tools, 总耗时 ${Date.now() - t0}ms`)
  }

  /** 系统连接的工具定义（本地兜底，无需网络） */
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
              language: {
                type: 'string',
                description: 'PDF 标签语言：en / zh-CN / zh-TW，默认 en',
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

  /** 播种预置的系统 MCP 连接（使用绝对路径避免 cwd 依赖） */
  private seedPresets(): void {
    const PDF_PRESET_ID = 'system-pdf-generator'
    seedPresetConnection({
      id: PDF_PRESET_ID,
      name: 'PDF报告生成器',
      transport: 'stdio',
      command: process.execPath,
      args: ['--import', 'tsx', path.resolve(here, 'pdf-server.ts')],
      isSystem: true,
    })
    log.info('预置 MCP 连接已就绪 — PDF报告生成器')

    const AMAP_PRESET_ID = 'system-amap-maps'
    seedPresetConnection({
      id: AMAP_PRESET_ID,
      name: '高德地图',
      transport: 'http',
      url: 'https://mcp.amap.com/mcp?key=44226cf881957e1da5b0775b2a02b03c',
      isSystem: true,
    })
    log.info('预置 MCP 连接已就绪 — 高德地图')
  }
}

/** 全局单例 */
export const mcpManager = new McpManager()
