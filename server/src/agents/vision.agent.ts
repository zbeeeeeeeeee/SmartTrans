import { createLogger } from '../utils/logger'
import { visionModel } from '../providers/index'
import { sceneSchema, type SceneDescription } from './schemas'
import { generateStructured } from './helpers'
import { formatSkillForSystemPrompt } from '../skills/inject'
import { VISION_SYSTEM_PROMPT, visionUserPrompt } from '../i18n'
import type { SupportedLanguage } from '../i18n'
import type { SkillPromptInjection } from '../skills/types'

const log = createLogger('vision-agent')

type ContentPart = { type: 'text'; text: string } | { type: 'image'; image: Buffer }

/** Vision agent: uses Qwen3-VL to analyze accident scene images */
export async function recognizeScene(
  images: Buffer[],
  description: string,
  language: SupportedLanguage = 'en',
  tools?: Record<string, any>,
  skills?: SkillPromptInjection[],
): Promise<SceneDescription> {
  log.info(`Starting recognition — images ${images.length}, language: ${language}, description: "${description.slice(0, 80)}"`)

  const content: ContentPart[] = [
    {
      type: 'text',
      text: visionUserPrompt(language, description),
    },
    ...images.map((image): ContentPart => ({ type: 'image', image })),
  ]

  const skillBlock = formatSkillForSystemPrompt(skills ?? [])
  const object = await generateStructured<SceneDescription>({
    model: visionModel,
    schema: sceneSchema,
    tools,
    system: VISION_SYSTEM_PROMPT[language] + skillBlock,
    messages: [{ role: 'user', content }],
  })

  log.info(`Recognition complete — vehicles ${object.vehicles?.length ?? 0}`)
  return object
}
