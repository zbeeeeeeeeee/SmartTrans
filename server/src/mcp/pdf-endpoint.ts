import crypto from 'node:crypto'
import path from 'node:path'
import type { Request, Response } from 'express'
import { createLogger } from '../utils/logger'
import { config } from '../config'
import { generatePdf } from '../pdf/generator'
import type { AccidentReport } from '../agents/schemas'

const log = createLogger('mcp-pdf-endpoint')

interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id: string | number
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string }
}

/** PDF 报告生成工具定义 */
const TOOL_DEF = {
  name: 'generate_report_pdf',
  description:
    '根据事故报告 JSON 生成 PDF 格式的交通事故分析报告并入库存储。接收完整的结构化报告数据，返回生成的 PDF 文件路径。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      reportJson: {
        type: 'string',
        description: '事故报告 JSON 字符串，需符合 AccidentReport 结构（title, summary, sceneSummary, severityLevel, liabilityConclusion, citedArticles, recommendations）',
      },
    },
    required: ['reportJson'],
  },
}

/** MCP 协议版本 */
const PROTOCOL_VERSION = '2024-11-05'

/** MCP 服务器信息 */
const SERVER_INFO = {
  name: 'SmartTrans PDF Generator',
  version: '1.0.0',
}

function jsonRpcError(id: string | number, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

function jsonRpcResult(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

/** Express 请求处理器 — 实现 MCP JSON-RPC 2.0 协议（Streamable HTTP） */
export async function pdfMcpHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as JsonRpcRequest

  // MCP 通知（无 id 字段）—— 无需响应
  if (body && body.method && body.id === undefined) {
    log.debug(`MCP 通知 — method=${body.method}`)
    if (body.method === 'notifications/initialized') {
      res.status(200).end()
      return
    }
    res.status(200).end()
    return
  }

  if (!body || body.jsonrpc !== '2.0' || !body.method) {
    res.status(400).json(jsonRpcError(body?.id ?? 0, -32600, 'Invalid Request'))
    return
  }

  // 只为非高频方法打印详细日志
  if (body.method !== 'ping' && body.method !== 'initialize') {
    log.info(`MCP JSON-RPC 请求 — method=${body.method}`)
  }

  try {
    switch (body.method) {
      // ---- 协议握手 ----
      case 'initialize': {
        res.json(jsonRpcResult(body.id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        }))
        return
      }

      case 'ping': {
        res.json(jsonRpcResult(body.id, {}))
        return
      }

      // ---- 工具发现 ----
      case 'tools/list': {
        res.json(jsonRpcResult(body.id, { tools: [TOOL_DEF] }))
        return
      }

      // ---- 工具调用 ----
      case 'tools/call': {
        const params = body.params as { name?: string; arguments?: Record<string, unknown> } | undefined
        if (!params || params.name !== 'generate_report_pdf') {
          res.json(jsonRpcError(body.id, -32601, `Unknown tool: ${params?.name ?? 'undefined'}`))
          return
        }

        const reportJson = params.arguments?.reportJson as string | undefined
        if (!reportJson) {
          res.json(jsonRpcError(body.id, -32602, 'Missing required argument: reportJson'))
          return
        }

        let report: AccidentReport
        try {
          report = JSON.parse(reportJson) as AccidentReport
        } catch {
          res.json(jsonRpcError(body.id, -32602, 'Invalid JSON in reportJson argument'))
          return
        }

        // 验证必填字段
        if (!report.title && !report.summary) {
          res.json(jsonRpcError(body.id, -32602, 'reportJson is missing required fields (title or summary)'))
          return
        }

        const pdfFilename = `report-${crypto.randomUUID()}.pdf`
        const pdfPath = path.join(config.paths.pdfs, pdfFilename)

        try {
          await generatePdf(report, pdfPath)
          log.info(`PDF 生成成功 — ${pdfFilename}`)

          const result = {
            pdfPath: `pdfs/${pdfFilename}`,
            filename: pdfFilename,
            success: true,
          }

          res.json(jsonRpcResult(body.id, {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          }))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          log.error('PDF 生成失败', message)
          res.json(jsonRpcResult(body.id, {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }],
            isError: true,
          }))
        }
        return
      }

      default:
        res.json(jsonRpcError(body.id, -32601, `Method not found: ${body.method}`))
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('MCP JSON-RPC 处理异常', message)
    res.status(500).json(jsonRpcError(body.id, -32603, `Internal error: ${message}`))
  }
}
