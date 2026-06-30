import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import type { AccidentReport } from '../agents/schemas'
import { config } from '../config'
import { createLogger } from '../utils/logger'
import { PDF_LABELS } from '../i18n'
import type { SupportedLanguage } from '../i18n'

const log = createLogger('pdf-generator')

/** Common Chinese font search paths (system fallback) */
const SYSTEM_FONTS: string[] = (() => {
  const platform = os.platform()
  if (platform === 'win32') {
    return [
      'C:\\Windows\\Fonts\\simhei.ttf',
      'C:\\Windows\\Fonts\\simkai.ttf',
      'C:\\Windows\\Fonts\\simsun.ttc',
      'C:\\Windows\\Fonts\\simfang.ttf',
    ]
  }
  if (platform === 'darwin') {
    return [
      '/System/Library/Fonts/PingFang.ttc',
      '/System/Library/Fonts/STHeiti Light.ttc',
    ]
  }
  // Linux
  return [
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  ]
})()

/** Preferred font filenames in custom font directory (by priority) */
const PREFERRED_FONTS: Record<string, string[]> = {
  serifBold: ['SourceHanSerifSC-Bold.otf', 'SourceHanSerifSC-Heavy.otf'],
  sansBold: ['SourceHanSansSC-Bold.otf', 'SourceHanSansSC-Heavy.otf', 'SourceHanSansSC-Medium.otf'],
  serif: ['SourceHanSerifSC-Regular.otf', 'SourceHanSerifSC-Medium.otf', 'SourceHanSerifSC-Light.otf'],
  sans: ['SourceHanSansSC-Regular.otf', 'SourceHanSansSC-Normal.otf', 'SourceHanSansSC-Light.otf'],
}

/**
 * Find Chinese font by priority: custom font dir first (ensures serif/sans variant distinction),
 * then fall back to system fonts.
 * @param preferredNames preferred filenames in custom font directory
 */
function findFont(preferredNames: string[]): string {
  // 1. Custom font directory first (ensures correct serif/sans/bold variant matching)
  for (const name of preferredNames) {
    const p = path.join(config.paths.fonts, name)
    if (fs.existsSync(p)) return p
  }
  // 2. System font fallback (first hit, different variants are within same ttc)
  for (const candidate of SYSTEM_FONTS) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error(
    `No usable Chinese font found. Please place OTF/TTF font files in ${config.paths.fonts}/.\n` +
    `Recommended: SourceHanSansSC + SourceHanSerifSC`,
  )
}

/** Strip numbering prefixes that LLMs may auto-add, avoiding duplicate numbering in PDF */
function stripNumberingPrefix(text: string): string {
  return text
    .replace(/^[\s]*[（(]\s*\d+\s*[)）][\s.、．]*/, '')  // (1)、（1）、1)
    .replace(/^[\s]*\d+\s*[.、．]\s*/, '')               // 1. / 1、/ 1．
    .replace(/^[\s]*第[一二三四五六七八九十百千万]+\s*[条章节项款][\s.、．]*/, '') // 第一、第一条.
    .replace(/^[\s]*[一二三四五六七八九十][、．.]\s*/, '') // 一、二、
    .trim()
}

/**
 * Generate PDF from accident report JSON and write to file.
 * @param report structured accident report
 * @param outputPath output PDF file path (absolute)
 * @param language desired language for labels and metadata
 */
export async function generatePdf(
  report: AccidentReport,
  outputPath: string,
  language: SupportedLanguage = 'en',
): Promise<void> {
  const L = PDF_LABELS[language]
  const severityText = L.severityLabels[report.severityLevel] ?? report.severityLevel

  // Date locale mapping
  const dateLocaleMap: Record<SupportedLanguage, string> = {
    en: 'en-US',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
  }

  // Find four font variants by priority
  const serifBoldPath = findFont(PREFERRED_FONTS.serifBold)
  const sansBoldPath = findFont(PREFERRED_FONTS.sansBold)
  const serifPath = findFont(PREFERRED_FONTS.serif)
  const sansPath = findFont(PREFERRED_FONTS.sans)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: report.title || L.title,
        Author: L.author,
        Subject: L.subject,
      },
    })

    const stream = fs.createWriteStream(outputPath)
    doc.pipe(stream)

    // Register four Chinese font variants
    doc.registerFont('serifBold', serifBoldPath)
    doc.registerFont('sansBold', sansBoldPath)
    doc.registerFont('serif', serifPath)
    doc.registerFont('sans', sansPath)

    // ===== Main title (serif Bold, 18pt) =====
    doc
      .font('serifBold')
      .fontSize(18)
      .text(L.title, { align: 'center' })

    doc.moveDown(0.3)

    // Separator line
    const ruleY = doc.y
    doc
      .moveTo(50, ruleY)
      .lineTo(545, ruleY)
      .lineWidth(1)
      .stroke('#2563eb')
    doc.moveDown(0.5)

    // ===== Basic info (section headers in sans Bold, content in serif) =====
    doc
      .font('sansBold')
      .fontSize(13)
      .fillColor('#2563eb')
      .text(L.basicInfo, { underline: false })
    doc.moveDown(0.3)

    doc.font('serif').fontSize(10).fillColor('#333')
    doc.text(`${L.reportTitleLabel}：${report.title ?? L.title}`)
    doc.text(`${L.generatedAt}：${new Date().toLocaleString(dateLocaleMap[language], { timeZone: 'Asia/Shanghai' })}`)
    doc.text(`${L.severityLevel}：${severityText}`)
    doc.moveDown(0.6)

    // ===== Accident Summary =====
    sectionHeader(doc, L.summary)
    doc.font('serif').fontSize(10).fillColor('#333').text(report.summary ?? L.none)
    doc.moveDown(0.6)

    // ===== Scene Situation =====
    sectionHeader(doc, L.scene)
    doc.font('serif').fontSize(10).fillColor('#333').text(report.sceneSummary ?? L.none)
    doc.moveDown(0.6)

    // ===== Liability Determination =====
    sectionHeader(doc, L.liabilityFinding)
    doc.font('serif').fontSize(10).fillColor('#333').text(report.liabilityConclusion ?? L.none)
    doc.moveDown(0.6)

    // ===== Cited Legal Articles =====
    if (report.citedArticles && report.citedArticles.length > 0) {
      sectionHeader(doc, L.citedArticles)
      for (const article of report.citedArticles) {
        doc.font('serif').fontSize(10).fillColor('#333').text(`• ${article}`, { indent: 10 })
      }
      doc.moveDown(0.6)
    }

    // ===== Recommendations =====
    if (report.recommendations && report.recommendations.length > 0) {
      sectionHeader(doc, L.recommendations)
      report.recommendations.forEach((rec, i) => {
        const cleaned = stripNumberingPrefix(rec)
        doc.font('serif').fontSize(10).fillColor('#333').text(`${i + 1}. ${cleaned}`, { indent: 10 })
      })
      doc.moveDown(0.6)
    }

    // ===== Footer (sans Regular, small text) =====
    const pageH = doc.page.height
    doc
      .font('sans')
      .fontSize(8)
      .fillColor('#999')
      .text(
        L.footer,
        50,
        pageH - 40,
        { width: doc.page.width - 100, align: 'center' },
      )

    doc.end()

    stream.on('finish', () => {
      log.info(`PDF generation complete — ${outputPath}`)
      resolve()
    })
    stream.on('error', (err) => {
      log.error('PDF write failed', err.message)
      reject(err)
    })
  })
}

function sectionHeader(doc: InstanceType<typeof PDFDocument>, title: string): void {
  doc
    .font('sansBold')
    .fontSize(12)
    .fillColor('#1e40af')
    .text(title)
  doc.moveDown(0.15)
  const y = doc.y
  doc
    .moveTo(50, y)
    .lineTo(545, y)
    .lineWidth(0.5)
    .stroke('#93c5fd')
  doc.moveDown(0.3)
}
