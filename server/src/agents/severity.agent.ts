import { createLogger } from '../utils/logger'
import { reasoningModel } from '../providers/index'
import { severitySchema, type SceneDescription, type SeverityAssessment } from './schemas'
import { generateStructured } from './helpers'
import { formatSkillForSystemPrompt } from '../skills/inject'
import { SEVERITY_SYSTEM_PROMPT, severityUserPrompt } from '../i18n'
import type { SupportedLanguage } from '../i18n'
import type { SkillPromptInjection } from '../skills/types'

const log = createLogger('severity-agent')

/** Severity assessment agent: evaluates accident severity based on scene analysis */
export async function assessSeverity(
  scene: SceneDescription,
  description: string,
  language: SupportedLanguage = 'en',
  tools?: Record<string, any>,
  skills?: SkillPromptInjection[],
): Promise<SeverityAssessment> {
  log.info(`Starting assessment — language: ${language}, description: "${description.slice(0, 80)}"`)

  const skillBlock = formatSkillForSystemPrompt(skills ?? [])
  const object = await generateStructured<SeverityAssessment>({
    model: reasoningModel,
    schema: severitySchema,
    tools,
    system: SEVERITY_SYSTEM_PROMPT[language] + skillBlock,
    prompt: severityUserPrompt(language, scene, description),
  })

  log.info(`Assessment complete — level=${object.level}, confidence=${object.confidence}`)
  return object
}
