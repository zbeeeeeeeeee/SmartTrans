import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { createLogger } from '../utils/logger'
import { config } from '../config'
import { getReport, listReports } from '../db/reports.repo'

const log = createLogger('route:reports')
const router = Router()

router.get('/', (_req, res) => {
  const reports = listReports()
  log.info(`GET / — ${reports.length} 条报告`)
  res.json(reports)
})

router.get('/:id', (req, res) => {
  log.info(`GET /${req.params.id}`)
  const report = getReport(req.params.id)
  if (!report) {
    log.warn(`GET /${req.params.id} — 未找到`)
    res.status(404).json({ error: 'report not found' })
    return
  }
  log.debug(`GET /${req.params.id} — 已返回`)
  res.json(report)
})

router.get('/:id/pdf', (req, res) => {
  log.info(`GET /${req.params.id}/pdf`)
  const record = getReport(req.params.id)
  if (!record || !record.pdfPath) {
    log.warn(`GET /${req.params.id}/pdf — PDF 不存在`)
    res.status(404).json({ error: 'PDF not found' })
    return
  }
  const absolutePath = path.resolve(config.paths.data, record.pdfPath)
  if (!fs.existsSync(absolutePath)) {
    log.warn(`GET /${req.params.id}/pdf — 文件缺失: ${absolutePath}`)
    res.status(404).json({ error: 'PDF file missing on disk' })
    return
  }
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="report-${record.id}.pdf"`)
  fs.createReadStream(absolutePath).pipe(res)
})

export default router
