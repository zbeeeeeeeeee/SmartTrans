import { randomUUID } from 'node:crypto'
import { createLogger } from '../utils/logger'
import { db } from './index'

const log = createLogger('reports-repo')

export interface AnalysisReport {
  summary?: string
  [key: string]: unknown
}

export interface InsertReportInput {
  description: string
  imagePaths: string[]
  scene: unknown
  severity: unknown
  liability: unknown
  report: unknown
}

export interface ReportRow {
  id: string
  description: string
  image_paths: string
  scene: string
  severity: string
  liability: string
  report: string
  created_at: string
  pdf_path: string | null
}

export interface ReportRecord {
  id: string
  description: string
  imagePaths: string[]
  scene: unknown
  severity: unknown
  liability: unknown
  report: unknown
  createdAt: string
  pdfPath: string | null
}

export interface ReportSummary {
  id: string
  description: string
  createdAt: string
  severity: unknown
  hasPdf: boolean
}

/** 返回当前北京时间字符串 (YYYY-MM-DD HH:MM:SS) */
function beijingNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false })
}

function parseRow(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    description: row.description,
    imagePaths: JSON.parse(row.image_paths ?? '[]'),
    scene: JSON.parse(row.scene ?? 'null'),
    severity: JSON.parse(row.severity ?? 'null'),
    liability: JSON.parse(row.liability ?? 'null'),
    report: JSON.parse(row.report ?? 'null'),
    createdAt: row.created_at,
    pdfPath: row.pdf_path ?? null,
  }
}

export function insertReport(input: InsertReportInput): string {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO reports (id, description, image_paths, scene, severity, liability, report, created_at)
     VALUES (@id, @description, @image_paths, @scene, @severity, @liability, @report, @created_at)`,
  ).run({
    id,
    description: input.description,
    image_paths: JSON.stringify(input.imagePaths),
    scene: JSON.stringify(input.scene),
    severity: JSON.stringify(input.severity),
    liability: JSON.stringify(input.liability),
    report: JSON.stringify(input.report),
    created_at: beijingNow(),
  })
  log.info(`插入报告 — id=${id}`)
  return id
}

export function listReports(): ReportSummary[] {
  const rows = db
    .prepare(`SELECT id, description, severity, created_at, pdf_path FROM reports ORDER BY created_at DESC`)
    .all() as (Pick<ReportRow, 'id' | 'description' | 'severity' | 'created_at'> & { pdf_path: string | null })[]
  log.debug(`列出报告 — ${rows.length} 条`)
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    createdAt: r.created_at,
    severity: JSON.parse(r.severity ?? 'null'),
    hasPdf: r.pdf_path !== null && r.pdf_path !== '',
  }))
}

export function updateReportPdfPath(id: string, pdfPath: string): void {
  db.prepare('UPDATE reports SET pdf_path = ? WHERE id = ?').run(pdfPath, id)
  log.info(`更新报告 PDF 路径 — id=${id}`)
}

export function getReport(id: string): ReportRecord | null {
  log.debug(`获取报告 — id=${id}`)
  const row = db.prepare(`SELECT * FROM reports WHERE id = ?`).get(id) as ReportRow | undefined
  const found = row ? parseRow(row) : null
  if (!found) log.debug(`报告不存在 — id=${id}`)
  return found
}
