import fsp from 'node:fs/promises'
import { Router } from 'express'
import { createLogger } from '../utils/logger'
import { runPipeline, type SkillSelection } from '../agents/orchestrator'
import { upload } from '../middleware/upload'
import { authRequired } from '../middleware/auth'
import type { SupportedLanguage } from '../i18n'

const log = createLogger('route:analysis')
const router = Router()

const VALID_LANGUAGES: SupportedLanguage[] = ['en', 'zh-CN', 'zh-TW']

router.post('/analyze', authRequired, upload.array('images', 6), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  const description = typeof req.body?.description === 'string' ? req.body.description : ''
  const coordinates = typeof req.body?.coordinates === 'string' ? req.body.coordinates : ''
  const timestamp = typeof req.body?.timestamp === 'string' ? req.body.timestamp : ''
  // Async image read (non-blocking for concurrency) + keep temp full paths for workspace move
  const images = await Promise.all(files.map((f) => fsp.readFile(f.path)))
  const imageTempPaths = files.map((f) => f.path)

  // Extract language from form field, default to English
  const rawLanguage = typeof req.body?.language === 'string' ? req.body.language : 'en'
  const language: SupportedLanguage = VALID_LANGUAGES.includes(rawLanguage as SupportedLanguage)
    ? (rawLanguage as SupportedLanguage)
    : 'en'

  // Parse skill selections
  let skillSelections: SkillSelection[] | undefined
  if (req.body?.skillSelections) {
    try {
      skillSelections = typeof req.body.skillSelections === 'string'
        ? JSON.parse(req.body.skillSelections)
        : req.body.skillSelections
    } catch {
      log.warn('Failed to parse skillSelections, ignoring')
    }
  }

  log.info(`POST /analyze — user=${req.userId}, images ${files.length}, language: ${language}, description: "${description.slice(0, 80)}", coords: "${coordinates}", skills: ${skillSelections?.length ?? 0}`)

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  for await (const ev of runPipeline(req.userId!, images, imageTempPaths, description, language, skillSelections, coordinates, timestamp)) {
    if (ev.type === 'error') {
      log.error('Pipeline error', ev.message)
    }
    send(ev)
  }
  res.end()
  log.info('POST /analyze — SSE stream ended')
})

export default router
