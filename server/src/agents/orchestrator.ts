import { createLogger } from '../utils/logger'
import { insertReport, updateReportPdfPath } from '../db/reports.repo'
import { analyzeLiability } from './liability.agent'
import { generateReport } from './report.agent'
import { assessSeverity } from './severity.agent'
import { recognizeScene } from './vision.agent'
import { mcpManager } from '../mcp/manager'
import { skillsManager } from '../skills/manager'
import { STEP_LABELS } from '../i18n'
import type { SupportedLanguage } from '../i18n'

const log = createLogger('orchestrator')

export type StageName = 'vision' | 'severity' | 'liability' | 'report'

export type StageEvent =
  | { type: 'stage_start'; stage: StageName; label: string; skillNames: string[]; toolNames: string[] }
  | { type: 'stage_complete'; stage: StageName; label: string; data: unknown; skillNames: string[]; toolNames: string[] }
  | { type: 'done'; reportId: string; report: unknown }
  | { type: 'error'; message: string }

function skillNames(skills: { skillName: string }[]): string[] {
  return skills.map((s) => s.skillName)
}

/** 归一化 MCP tool 返回值：stdio transport 返回 MCP content wrapper，本地兜底返回裸对象 */
function normalizePdfResult(raw: unknown): { success?: boolean; pdfPath?: string; filename?: string } | null {
  if (!raw || typeof raw !== 'object') return null
  // 本地兜底路径：直接返回裸对象
  if ('pdfPath' in raw) return raw as Record<string, unknown> as any
  // stdio MCP 路径：解析 content wrapper { content: [{ type: 'text', text: '...' }] }
  const content = (raw as Record<string, unknown>).content
  if (Array.isArray(content)) {
    const textItem = content.find((c: any) => c.type === 'text')
    if (textItem?.text) {
      try { return JSON.parse(textItem.text) } catch { return null }
    }
  }
  return null
}

/** 从 addressComponent 或顶层字段拼接出人类可读的地址 */
function buildAddressFromComponents(obj: Record<string, unknown>): string | null {
  const comp = (obj.addressComponent as Record<string, unknown>) ?? obj
  const parts: string[] = []
  const fields = ['country', 'province', 'city', 'district', 'township', 'streetNumber', 'towncode']
  for (const key of fields) {
    const v = comp[key]
    if (typeof v === 'string' && v.trim()) {
      // 去重：如果前一个部分已包含当前值，跳过（如 city 已含 district）
      const cleaned = v.trim()
      if (parts.length > 0 && parts[parts.length - 1].includes(cleaned)) continue
      parts.push(cleaned)
    }
  }
  return parts.length > 0 ? parts.join('') : null
}

/** 从 MCP tool 返回值中提取文本内容（处理多种 MCP transport 格式） */
function extractTextFromToolResult(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  // 本地/HTTP 直接返回：{ regeocode: { formatted_address: "..." } } 或纯字符串
  if (typeof (raw as any).regeocode?.formatted_address === 'string') {
    return (raw as any).regeocode.formatted_address
  }
  if (typeof (raw as any).formatted_address === 'string') {
    return (raw as any).formatted_address
  }
  // 顶层 addressComponent 或顶层 country/province/city 等字段
  const topAddr = buildAddressFromComponents(raw as Record<string, unknown>)
  if (topAddr) return topAddr
  // MCP content wrapper: { content: [{ type: 'text', text: '...' }] }
  const content = (raw as Record<string, unknown>).content
  if (Array.isArray(content)) {
    const textItem = content.find((c: any) => c.type === 'text')
    if (textItem?.text) {
      try {
        const parsed = JSON.parse(textItem.text)
        // 高德 API 返回格式: { status: "1", regeocode: { formatted_address: "..." } }
        if (typeof parsed?.regeocode?.formatted_address === 'string') {
          return parsed.regeocode.formatted_address
        }
        if (typeof parsed?.formatted_address === 'string') {
          return parsed.formatted_address
        }
        // addressComponent 或顶层字段
        const compAddr = buildAddressFromComponents(parsed)
        if (compAddr) return compAddr
        // 高德 API 错误响应不入库
        if (typeof parsed?.status === 'string' && parsed.status !== '1') {
          log.warn(`逆地理编码 API 返回非成功状态 — status=${parsed.status}, info=${parsed.info ?? ''}`)
          return null
        }
        return textItem.text
      } catch {
        // 纯文本可能是 API 错误信息，不入库
        if (textItem.text.includes('API 调用失败') || textItem.text.includes('USER_KEY_RECYCLED')) {
          log.warn(`逆地理编码返回疑似错误文本，跳过 — "${textItem.text.slice(0, 100)}"`)
          return null
        }
        return textItem.text.slice(0, 200)
      }
    }
  }
  return null
}

/** 校验经纬度字符串格式（简单的 lng,lat 格式校验） */
const COORD_REGEX = /^\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*$/

function validateCoords(raw: string): string | null {
  const m = raw.match(COORD_REGEX)
  if (!m) return null
  const lng = parseFloat(m[1])
  const lat = parseFloat(m[2])
  // 中国范围粗略校验
  if (lng < 73 || lng > 135 || lat < 18 || lat > 54) return null
  return `${lng},${lat}`
}

/** 将 ISO 时间戳格式化为人类可读的北京时间字符串 */
function formatTimestamp(isoString: string, language: SupportedLanguage): string {
  const date = new Date(isoString)
  // 转为北京时间 (UTC+8)
  const bj = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const Y = bj.getUTCFullYear()
  const M = String(bj.getUTCMonth() + 1).padStart(2, '0')
  const D = String(bj.getUTCDate()).padStart(2, '0')
  const h = String(bj.getUTCHours()).padStart(2, '0')
  const mi = String(bj.getUTCMinutes()).padStart(2, '0')
  const s = String(bj.getUTCSeconds()).padStart(2, '0')

  if (language === 'en') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[bj.getUTCMonth()]} ${D}, ${Y} ${h}:${mi}:${s}`
  }
  return `${Y}年${M}月${D}日 ${h}:${mi}:${s}`
}

export interface SkillSelection {
  skillId: string
  agentNames: string[]
}

/**
 * Multi-agent pipeline: vision → severity → liability (with RAG) → report,
 * yielding stage events via async generator for SSE streaming.
 * Finally persists to DB and returns report ID.
 */
export async function* runPipeline(
  userId: string,
  images: Buffer[],
  imagePaths: string[],
  description: string,
  language: SupportedLanguage = 'en',
  skillSelections?: SkillSelection[],
  coordinates?: string,
  timestamp?: string,
): AsyncGenerator<StageEvent> {
  const labels = STEP_LABELS[language]
  log.info(`Pipeline started — images ${images.length}, language: ${language}, description: "${description.slice(0, 80)}", coords: "${coordinates ?? ''}", time: "${timestamp ?? ''}"`)

  try {
    // Pre-fetch MCP tools — report agent 只调用一次，从中提取 generate_report_pdf 和 maps_regeocode
    const reportTools = await mcpManager.getToolsForAgent('report')
    const pdfToolKey = Object.keys(reportTools).find(
      (k) => k === 'generate_report_pdf' || k.endsWith('__generate_report_pdf'),
    ) ?? ''
    const regeocodeToolKey = Object.keys(reportTools).find(
      (k) => k === 'maps_regeocode' || k.endsWith('__maps_regeocode'),
    ) ?? ''
    const pdfTool = pdfToolKey ? reportTools[pdfToolKey] : undefined
    const regeocodeTool = regeocodeToolKey ? reportTools[regeocodeToolKey] : undefined

    // 只有 report agent 允许使用 MCP 工具
    const agentTools = {
      vision: {},
      severity: {},
      liability: {},
      report: reportTools,
    }

    // ---- 程序化逆地理编码：使用前端传入的坐标直接调用 maps_regeocode ----
    let locationAddress: string | undefined
    const coordStr = coordinates ? validateCoords(coordinates) : null
    if (coordStr) {
      if (regeocodeTool) {
        try {
          const rawResult = await regeocodeTool.execute({ location: coordStr })
          const address = extractTextFromToolResult(rawResult)
          if (address) {
            locationAddress = address
            log.info(`逆地理编码成功 — ${coordStr} → ${address}`)
          } else {
            log.warn(`逆地理编码返回为空 — ${coordStr}, raw=${JSON.stringify(rawResult).slice(0, 200)}`)
          }
        } catch (e) {
          log.warn(`逆地理编码失败 — ${coordStr}: ${e instanceof Error ? e.message : String(e)}`)
        }
      } else {
        log.warn('未找到 maps_regeocode 工具，跳过逆地理编码')
      }
    }

    // Pre-fetch enabled Skills for each agent (merge persisted settings + current selections)
    const agentSkills = {
      vision: skillsManager.getSkillsForAgent('vision', skillSelections),
      severity: skillsManager.getSkillsForAgent('severity', skillSelections),
      liability: skillsManager.getSkillsForAgent('liability', skillSelections),
      report: skillsManager.getSkillsForAgent('report', skillSelections),
    }

    // ---- 1. Vision ----
    yield { type: 'stage_start', stage: 'vision', label: labels.vision, skillNames: skillNames(agentSkills.vision), toolNames: Object.keys(agentTools.vision) }
    log.info('Stage start: vision')
    const scene = await recognizeScene(images, description, language, agentTools.vision, agentSkills.vision)
    yield { type: 'stage_complete', stage: 'vision', label: labels.vision, data: scene, skillNames: skillNames(agentSkills.vision), toolNames: Object.keys(agentTools.vision) }
    log.info('Stage complete: vision', scene)

    // ---- 2. Severity + 3. Liability (parallel) ----
    yield { type: 'stage_start', stage: 'severity', label: labels.severity, skillNames: skillNames(agentSkills.severity), toolNames: Object.keys(agentTools.severity) }
    yield { type: 'stage_start', stage: 'liability', label: labels.liability, skillNames: skillNames(agentSkills.liability), toolNames: Object.keys(agentTools.liability) }
    log.info('Stage start: severity + liability (parallel)')

    const [severity, liabilityResult] = await Promise.all([
      assessSeverity(scene, description, language, agentTools.severity, agentSkills.severity),
      analyzeLiability(scene, description, language, agentTools.liability, agentSkills.liability),
    ])
    const liability = liabilityResult.analysis

    yield { type: 'stage_complete', stage: 'severity', label: labels.severity, data: severity, skillNames: skillNames(agentSkills.severity), toolNames: Object.keys(agentTools.severity) }
    log.info('Stage complete: severity', severity)
    yield { type: 'stage_complete', stage: 'liability', label: labels.liability, data: liability, skillNames: skillNames(agentSkills.liability), toolNames: Object.keys(agentTools.liability) }
    log.info(`Stage complete: liability — citedArticles=${liability.citedArticles?.length ?? 0}`, liability.citedArticles)

    // ---- 4. Report ----
    yield { type: 'stage_start', stage: 'report', label: labels.report, skillNames: skillNames(agentSkills.report), toolNames: Object.keys(agentTools.report) }
    log.info('Stage start: report')
    const report = await generateReport(
      { scene, severity, liability, description, locationAddress, timestamp },
      language, agentTools.report, agentSkills.report,
    )
    // 程序化注入：不依赖模型填充，直接覆盖 location 和 generatedAt
    if (locationAddress) report.location = locationAddress
    report.generatedAt = formatTimestamp(timestamp || new Date().toISOString(), language)
    yield { type: 'stage_complete', stage: 'report', label: labels.report, data: report, skillNames: skillNames(agentSkills.report), toolNames: Object.keys(agentTools.report) }
    log.info(`Stage complete: report — citedArticles=${report.citedArticles?.length ?? 0}`, report.citedArticles)

    // ---- Persist ----
    const reportId = insertReport(userId, { description, imagePaths, scene, severity, liability, report })
    log.info(`Report persisted, id=${reportId}, user=${userId}`)

    // ---- PDF generation (via MCP tool) ----
    if (pdfToolKey) {
      try {
        const pdfTool = agentTools.report[pdfToolKey]
        const rawResult = await pdfTool.execute({ reportJson: JSON.stringify(report), language })
        const result = normalizePdfResult(rawResult)
        if (result?.success !== false && result?.pdfPath) {
          updateReportPdfPath(reportId, userId, result.pdfPath)
          log.info(`PDF generated via MCP — ${result.filename ?? result.pdfPath}`)
        } else {
          log.warn(`PDF tool returned failure — ${JSON.stringify(rawResult)}`)
        }
      } catch (err) {
        log.error('PDF generation failed (report is still usable)', err instanceof Error ? err.message : String(err))
      }
    } else {
      log.info('PDF not generated — report agent does not have generate_report_pdf tool bound')
    }

    yield { type: 'done', reportId, report }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('Pipeline exception', message)
    yield { type: 'error', message }
  }
}
