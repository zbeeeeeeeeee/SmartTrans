import { createLogger } from '../utils/logger'
import { reasoningModel } from '../providers/index'
import {
  reportSchema,
  type AccidentReport,
  type LiabilityAnalysis,
  type SceneDescription,
  type SeverityAssessment,
} from './schemas'
import { generateStructured } from './helpers'
import { formatSkillForSystemPrompt } from '../skills/inject'
import { REPORT_SYSTEM_PROMPT, reportUserPrompt } from '../i18n'
import type { SupportedLanguage } from '../i18n'
import type { SkillPromptInjection } from '../skills/types'

const log = createLogger('report-agent')

/** Report generation agent: synthesizes all agent results into a structured accident report */
export async function generateReport(
  input: {
    scene: SceneDescription
    severity: SeverityAssessment
    liability: LiabilityAnalysis
    description: string
  },
  language: SupportedLanguage = 'en',
  tools?: Record<string, any>,
  skills?: SkillPromptInjection[],
): Promise<AccidentReport> {
  const inputCitedCount = input.liability.citedArticles?.length ?? 0
  log.info(`Starting report generation — language: ${language}, input citedArticles=${inputCitedCount}`)

  const skillBlock = formatSkillForSystemPrompt(skills ?? [])
  const object = await generateStructured<AccidentReport>({
    model: reasoningModel,
    schema: reportSchema,
    tools,
    system: REPORT_SYSTEM_PROMPT[language] + skillBlock,
    prompt: reportUserPrompt(language, input),
  })

  // Programmatic guard: if liability stage had no citedArticles, force-clear report's too
  if (!input.liability.citedArticles || input.liability.citedArticles.length === 0) {
    if (object.citedArticles && object.citedArticles.length > 0) {
      log.warn(`Input citedArticles was empty but model fabricated ${object.citedArticles.length} → force clearing`)
    }
    object.citedArticles = []
  }

  log.info(`Report generation complete — citedArticles=${object.citedArticles?.length ?? 0}`)
  return object
}
