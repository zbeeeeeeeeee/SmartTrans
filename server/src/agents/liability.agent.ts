import { createLogger } from '../utils/logger'
import { reasoningModel } from '../providers/index'
import { formatLegalContext, retrieveLegalContext } from '../rag/retriever'
import {
  liabilitySchema,
  type LiabilityAnalysis,
  type SceneDescription,
  type SeverityAssessment,
} from './schemas'
import { generateStructured } from './helpers'
import { formatSkillForSystemPrompt } from '../skills/inject'
import {
  LIABILITY_SYSTEM_WITH_ARTICLES,
  LIABILITY_SYSTEM_WITHOUT_ARTICLES,
  liabilityUserPrompt,
} from '../i18n'
import type { SupportedLanguage } from '../i18n'
import type { SkillPromptInjection } from '../skills/types'

const log = createLogger('liability-agent')

/** Liability determination agent: uses RAG-retrieved legal statutes for fault allocation */
export async function analyzeLiability(
  scene: SceneDescription,
  severity: SeverityAssessment,
  description: string,
  language: SupportedLanguage = 'en',
  tools?: Record<string, any>,
  skills?: SkillPromptInjection[],
): Promise<{ analysis: LiabilityAnalysis; legalContext: string }> {
  const query = `${scene.sceneSummary} ${description} 交通事故责任认定`
  log.info(`RAG search — language: ${language}, query: "${query.slice(0, 100)}"`)

  const chunks = await retrieveLegalContext(query, 5)
  const hasArticles = chunks.length > 0

  log.info(`RAG results — chunks=${chunks.length}, hasArticles=${hasArticles}`)
  if (hasArticles) {
    log.debug('RAG retrieved articles', chunks.map((c) => `${c.source} ${c.articleNo ?? ''}`))
  }

  const legalContext = formatLegalContext(chunks)
  const skillBlock = formatSkillForSystemPrompt(skills ?? [])
  const system = hasArticles
    ? LIABILITY_SYSTEM_WITH_ARTICLES[language] + skillBlock
    : LIABILITY_SYSTEM_WITHOUT_ARTICLES[language] + skillBlock

  log.debug('system prompt', system.slice(0, 150))

  const object = await generateStructured<LiabilityAnalysis>({
    model: reasoningModel,
    schema: liabilitySchema,
    tools,
    system,
    prompt: liabilityUserPrompt(language, scene, severity, description, legalContext),
  })

  log.info(`Model returned citedArticles count: ${object.citedArticles?.length ?? 0}`, object.citedArticles)

  // Programmatic guard: force clear citedArticles when RAG returned no results
  if (!hasArticles) {
    if (object.citedArticles && object.citedArticles.length > 0) {
      log.warn(`RAG had no results but model fabricated ${object.citedArticles.length} citations → force clearing`)
    }
    object.citedArticles = []
  }

  return { analysis: object, legalContext }
}
