/**
 * PDF 报告生成器 — MCP Stdio 服务器
 *
 * 通过 stdin/stdout 与 MCP 客户端通信（JSON-RPC 2.0），
 * 由 manager.ts 以 `npx tsx src/mcp/pdf-server.ts` 方式作为子进程启动。
 */

import path from 'node:path'
import * as readline from 'node:readline'
import { config } from '../config'
import { generatePdf } from '../pdf/generator'

// ---- 写入 stdout（JSON-RPC 行）----
function respond(obj: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

function err(id: string | number, code: number, message: string): void {
  respond({ jsonrpc: '2.0', id, error: { code, message } })
}

function ok(id: string | number, result: unknown): void {
  respond({ jsonrpc: '2.0', id, result })
}

// ---- 工具定义 ----
const TOOL_DEF = {
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
}

// ---- 主逻辑 ----
const rl = readline.createInterface({ input: process.stdin })

rl.on('line', async (line: string) => {
  let body: { jsonrpc?: string; method?: string; id?: string | number; params?: Record<string, unknown> }
  try {
    body = JSON.parse(line)
  } catch {
    err(0, -32700, 'Parse error')
    return
  }

  // MCP 通知（无 id）—— 无需响应
  if (body.method && body.id === undefined) {
    return
  }

  if (body.jsonrpc !== '2.0' || !body.method) {
    err(body.id ?? 0, -32600, 'Invalid Request')
    return
  }

  const id = body.id!

  try {
    switch (body.method) {
      case 'initialize': {
        ok(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'SmartTrans PDF Generator', version: '1.0.0' },
        })
        return
      }

      case 'ping': {
        ok(id, {})
        return
      }

      case 'tools/list': {
        ok(id, { tools: [TOOL_DEF] })
        return
      }

      case 'tools/call': {
        const params = body.params as { name?: string; arguments?: Record<string, unknown> } | undefined
        if (!params || params.name !== 'generate_report_pdf') {
          err(id, -32601, `Unknown tool: ${params?.name ?? 'undefined'}`)
          return
        }

        const reportJson = params.arguments?.reportJson as string | undefined
        if (!reportJson) {
          err(id, -32602, 'Missing required argument: reportJson')
          return
        }
        const language = (params.arguments?.language as string) ?? 'en'
        const outputDir = (params.arguments?.outputDir as string) ?? config.paths.pdfs

        let report: Record<string, unknown>
        try {
          report = JSON.parse(reportJson)
        } catch {
          err(id, -32602, 'Invalid JSON in reportJson argument')
          return
        }

        if (!report.title && !report.summary) {
          err(id, -32602, 'reportJson is missing required fields (title or summary)')
          return
        }

        const pdfFilename = 'report.pdf'
        const pdfPath = path.join(outputDir, pdfFilename)

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await generatePdf(report as any, pdfPath, language as any)

          const result = {
            pdfPath: pdfFilename,
            filename: pdfFilename,
            success: true,
          }

          ok(id, {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          ok(id, {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }],
            isError: true,
          })
        }
        return
      }

      default:
        err(id, -32601, `Method not found: ${body.method}`)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    err(id, -32603, `Internal error: ${message}`)
  }
})
