import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import { createLogger } from '../utils/logger'
import { config } from '../config'
import { getReport, listReports } from '../db/reports.repo'
import { authRequired } from '../middleware/auth'

const log = createLogger('route:reports')
const router = Router()

router.use(authRequired)

router.get('/', (req, res) => {
  const reports = listReports(req.userId!)
  log.info(`GET / — ${reports.length} 条报告, user=${req.userId}`)
  res.json(reports)
})

router.get('/:id', (req, res) => {
  log.info(`GET /${req.params.id}`)
  const report = getReport(req.params.id, req.userId!)
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
  const record = getReport(req.params.id, req.userId!)
  if (!record || !record.pdfPath) {
    log.warn(`GET /${req.params.id}/pdf - PDF not found`)
    res.status(404).json({ error: 'PDF not found' })
    return
  }
  // Workspace first, fallback to legacy data/ path
  const wsPath = path.join(config.paths.workspaces, req.userId!, req.params.id, record.pdfPath)
  const legacyPath = path.resolve(config.paths.data, record.pdfPath)
  const absolutePath = fs.existsSync(wsPath) ? wsPath : (fs.existsSync(legacyPath) ? legacyPath : null)
  if (!absolutePath) {
    log.warn(`GET /${req.params.id}/pdf - file missing`)
    res.status(404).json({ error: 'PDF file missing on disk' })
    return
  }
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="report-${record.id}.pdf"`)
  fs.createReadStream(absolutePath).pipe(res)
})

// List workspace files for a report
router.get('/:id/workspace', async (req, res) => {
  const record = getReport(req.params.id, req.userId!)
  if (!record) {
    res.status(404).json({ error: 'report not found' })
    return
  }
  const wsDir = path.join(config.paths.workspaces, req.userId!, req.params.id)
  try {
    const entries = await fsp.readdir(wsDir, { withFileTypes: true })
    const files = await Promise.all(
      entries
        .filter((e) => e.isFile())
        .map(async (e) => {
          const stat = await fsp.stat(path.join(wsDir, e.name))
          return { name: e.name, size: stat.size, ext: path.extname(e.name).slice(1).toLowerCase() }
        }),
    )
    res.json({ files })
  } catch {
    res.status(404).json({ error: 'workspace not found' })
  }
})

// Serve a single workspace file (with path-traversal guard + legacy fallback)
router.get('/:id/workspace/:filename', (req, res) => {
  const record = getReport(req.params.id, req.userId!)
  if (!record) {
    res.status(404).json({ error: 'report not found' })
    return
  }
  const wsDir = path.join(config.paths.workspaces, req.userId!, req.params.id)
  const filePath = path.join(wsDir, req.params.filename)
  // Path traversal guard: resolved path must stay inside wsDir
  const relative = path.relative(wsDir, filePath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    }
    res.setHeader('Content-Type', mimeMap[ext] ?? 'application/octet-stream')
    fs.createReadStream(filePath).pipe(res)
    return
  }
  // Legacy fallback: try uploads/ (for old reports)
  const legacyPath = path.join(config.paths.uploads, req.params.filename)
  if (fs.existsSync(legacyPath)) {
    fs.createReadStream(legacyPath).pipe(res)
    return
  }
  res.status(404).json({ error: 'file not found' })
})

export default router
