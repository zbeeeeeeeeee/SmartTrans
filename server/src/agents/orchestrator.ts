import path from 'node:path'
import { createLogger } from '../utils/logger'
import { config } from '../config'
import { insertReport, updateReportPdfPath } from '../db/reports.repo'
import { analyzeLiability } from './liability.agent'
import { generateReport } from './report.agent'
import { generatePdf } from '../pdf/generator'
import { assessSeverity } from './severity.agent'
import { recognizeScene } from './vision.agent'
import { mcpManager } from '../mcp/manager'
import { skillsManager } from '../skills/manager'
import { STEP_LABELS } from '../i18n'
import type { SupportedLanguage } from '../i18n'
import type { AccidentReport } from './schemas'

const log = createLogger('orchestrator')

export type StageName = 'vision' | 'severity' | 'liability' | 'report'

export type StageEvent =
  | { type: 'stage_start'; stage: StageName; label: string; skillNames: string[] }
  | { type: 'stage_complete'; stage: StageName; label: string; data: unknown; skillNames: string[] }
  | { type: 'done'; reportId: string; report: unknown }
  | { type: 'error'; message: string }

function skillNames(skills: { skillName: string }[]): string[] {
  return skills.map((s) => s.skillName)
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
  images: Buffer[],
  imagePaths: string[],
  description: string,
  language: SupportedLanguage = 'en',
  skillSelections?: SkillSelection[],
): AsyncGenerator<StageEvent> {
  const labels = STEP_LABELS[language]
  log.info(`Pipeline started — images ${images.length}, language: ${language}, description: "${description.slice(0, 80)}"`)

  try {
    // Pre-fetch MCP tools for each agent (one query, avoid per-stage repeats)
    const agentTools = {
      vision: await mcpManager.getToolsForAgent('vision'),
      severity: await mcpManager.getToolsForAgent('severity'),
      liability: await mcpManager.getToolsForAgent('liability'),
      report: await mcpManager.getToolsForAgent('report'),
    }

    // Pre-fetch enabled Skills for each agent (merge persisted settings + current selections)
    const agentSkills = {
      vision: skillsManager.getSkillsForAgent('vision', skillSelections),
      severity: skillsManager.getSkillsForAgent('severity', skillSelections),
      liability: skillsManager.getSkillsForAgent('liability', skillSelections),
      report: skillsManager.getSkillsForAgent('report', skillSelections),
    }

    // ---- 1. Vision ----
    yield { type: 'stage_start', stage: 'vision', label: labels.vision, skillNames: skillNames(agentSkills.vision) }
    log.info('Stage start: vision')
    const scene = await recognizeScene(images, description, language, agentTools.vision, agentSkills.vision)
    yield { type: 'stage_complete', stage: 'vision', label: labels.vision, data: scene, skillNames: skillNames(agentSkills.vision) }
    log.info('Stage complete: vision', scene)

    // ---- 2. Severity ----
    yield { type: 'stage_start', stage: 'severity', label: labels.severity, skillNames: skillNames(agentSkills.severity) }
    log.info('Stage start: severity')
    const severity = await assessSeverity(scene, description, language, agentTools.severity, agentSkills.severity)
    yield { type: 'stage_complete', stage: 'severity', label: labels.severity, data: severity, skillNames: skillNames(agentSkills.severity) }
    log.info('Stage complete: severity', severity)

    // ---- 3. Liability (RAG) ----
    yield { type: 'stage_start', stage: 'liability', label: labels.liability, skillNames: skillNames(agentSkills.liability) }
    log.info('Stage start: liability')
    const { analysis: liability } = await analyzeLiability(scene, severity, description, language, agentTools.liability, agentSkills.liability)
    yield { type: 'stage_complete', stage: 'liability', label: labels.liability, data: liability, skillNames: skillNames(agentSkills.liability) }
    log.info(`Stage complete: liability — citedArticles=${liability.citedArticles?.length ?? 0}`, liability.citedArticles)

    // ---- 4. Report ----
    yield { type: 'stage_start', stage: 'report', label: labels.report, skillNames: skillNames(agentSkills.report) }
    log.info('Stage start: report')
    const report = await generateReport({ scene, severity, liability, description }, language, agentTools.report, agentSkills.report)
    yield { type: 'stage_complete', stage: 'report', label: labels.report, data: report, skillNames: skillNames(agentSkills.report) }
    log.info(`Stage complete: report — citedArticles=${report.citedArticles?.length ?? 0}`, report.citedArticles)

    // ---- Persist ----
    const reportId = insertReport({ description, imagePaths, scene, severity, liability, report })
    log.info(`Report persisted, id=${reportId}`)

    // ---- PDF generation (only when report agent has PDF MCP tool bound) ----
    const reportToolKeys = Object.keys(agentTools.report)
    const hasPdfTool = reportToolKeys.some(
      (k) => k === 'generate_report_pdf' || k.endsWith('__generate_report_pdf'),
    )
    if (hasPdfTool) {
      try {
        const pdfFilename = `report-${reportId}.pdf`
        const pdfPath = path.join(config.paths.pdfs, pdfFilename)
        await generatePdf(report as AccidentReport, pdfPath, language)
        updateReportPdfPath(reportId, path.join('pdfs', pdfFilename))
        log.info(`PDF generated — ${pdfFilename}`)
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
