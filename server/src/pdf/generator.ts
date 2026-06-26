import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import type { AccidentReport } from '../agents/schemas'
import { config } from '../config'
import { createLogger } from '../utils/logger'

const log = createLogger('pdf-generator')

const SEVERITY_LABELS: Record<string, string> = {
  minor: '轻微',
  moderate: '一般',
  severe: '严重',
}

/** 常见中文字体搜索路径（系统兜底） */
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

/** 自定义字体目录下偏好的文件名（按优先级） */
const PREFERRED_FONTS: Record<string, string[]> = {
  serifBold: ['SourceHanSerifSC-Bold.otf', 'SourceHanSerifSC-Heavy.otf'],
  sansBold: ['SourceHanSansSC-Bold.otf', 'SourceHanSansSC-Heavy.otf', 'SourceHanSansSC-Medium.otf'],
  serif: ['SourceHanSerifSC-Regular.otf', 'SourceHanSerifSC-Medium.otf', 'SourceHanSerifSC-Light.otf'],
  sans: ['SourceHanSansSC-Regular.otf', 'SourceHanSansSC-Normal.otf', 'SourceHanSansSC-Light.otf'],
}

/**
 * 按优先级查找中文字体：优先使用自定义字体目录（保证 serif/sans 变体区分），
 * 自定义目录不存在对应字体时回退到系统字体。
 * @param preferredNames 自定义目录下偏好的文件名列表
 */
function findFont(preferredNames: string[]): string {
  // 1. 自定义字体目录优先（保证 serif/sans/bold 变体正确匹配）
  for (const name of preferredNames) {
    const p = path.join(config.paths.fonts, name)
    if (fs.existsSync(p)) return p
  }
  // 2. 系统字体兜底（用第一个命中的，不同变体在同一个 ttc 内）
  for (const candidate of SYSTEM_FONTS) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error(
    `未找到可用的中文字体。请将 OTF/TTF 字体文件放入 ${config.paths.fonts}/ 目录。\n` +
    `推荐: 思源黑体 + 思源宋体 (SourceHanSansSC / SourceHanSerifSC)`,
  )
}

/** 去除 LLM 可能自动添加的编号前缀，避免与 PDF 代码中的编号重复 */
function stripNumberingPrefix(text: string): string {
  return text
    .replace(/^[\s]*[（(]\s*\d+\s*[)）][\s.、．]*/, '')  // (1)、（1）、1)
    .replace(/^[\s]*\d+\s*[.、．]\s*/, '')               // 1. / 1、/ 1．
    .replace(/^[\s]*第[一二三四五六七八九十百千万]+\s*[条章节项款][\s.、．]*/, '') // 第一、第一条.
    .replace(/^[\s]*[一二三四五六七八九十][、．.]\s*/, '') // 一、二、
    .trim()
}

/**
 * 根据事故报告 JSON 生成 PDF 并写入文件。
 * @param report 结构化事故报告
 * @param outputPath 输出 PDF 文件路径（绝对路径）
 */
export async function generatePdf(report: AccidentReport, outputPath: string): Promise<void> {
  // 按优先级查找四种字体变体
  const serifBoldPath = findFont(PREFERRED_FONTS.serifBold)
  const sansBoldPath = findFont(PREFERRED_FONTS.sansBold)
  const serifPath = findFont(PREFERRED_FONTS.serif)
  const sansPath = findFont(PREFERRED_FONTS.sans)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: report.title || '交通事故分析报告',
        Author: 'SmartTrans 多智能体系统',
        Subject: '交通事故分析',
      },
    })

    const stream = fs.createWriteStream(outputPath)
    doc.pipe(stream)

    // 注册四种中文字体
    doc.registerFont('serifBold', serifBoldPath)
    doc.registerFont('sansBold', sansBoldPath)
    doc.registerFont('serif', serifPath)
    doc.registerFont('sans', sansPath)

    // ===== 报告大标题（宋体 Bold，18pt）=====
    doc
      .font('serifBold')
      .fontSize(18)
      .text('交通事故分析报告', { align: 'center' })

    doc.moveDown(0.3)

    // 分隔线
    const ruleY = doc.y
    doc
      .moveTo(50, ruleY)
      .lineTo(545, ruleY)
      .lineWidth(1)
      .stroke('#2563eb')
    doc.moveDown(0.5)

    // ===== 基本信息（章节标题用黑体 Bold，内容用宋体）=====
    doc
      .font('sansBold')
      .fontSize(13)
      .fillColor('#2563eb')
      .text('基本信息', { underline: false })
    doc.moveDown(0.3)

    doc.font('serif').fontSize(10).fillColor('#333')
    doc.text(`报告标题：${report.title ?? '交通事故分析报告'}`)
    doc.text(`生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`)
    doc.text(`严重等级：${SEVERITY_LABELS[report.severityLevel] ?? report.severityLevel}`)
    doc.moveDown(0.6)

    // ===== 事故概要 =====
    sectionHeader(doc, '事故概要')
    doc.font('serif').fontSize(10).fillColor('#333').text(report.summary ?? '（无）')
    doc.moveDown(0.6)

    // ===== 现场情况 =====
    sectionHeader(doc, '现场情况')
    doc.font('serif').fontSize(10).fillColor('#333').text(report.sceneSummary ?? '（无）')
    doc.moveDown(0.6)

    // ===== 责任认定 =====
    sectionHeader(doc, '责任认定')
    doc.font('serif').fontSize(10).fillColor('#333').text(report.liabilityConclusion ?? '（无）')
    doc.moveDown(0.6)

    // ===== 引用法条 =====
    if (report.citedArticles && report.citedArticles.length > 0) {
      sectionHeader(doc, '引用法条')
      for (const article of report.citedArticles) {
        doc.font('serif').fontSize(10).fillColor('#333').text(`• ${article}`, { indent: 10 })
      }
      doc.moveDown(0.6)
    }

    // ===== 处理建议 =====
    if (report.recommendations && report.recommendations.length > 0) {
      sectionHeader(doc, '处理建议')
      report.recommendations.forEach((rec, i) => {
        const cleaned = stripNumberingPrefix(rec)
        doc.font('serif').fontSize(10).fillColor('#333').text(`${i + 1}. ${cleaned}`, { indent: 10 })
      })
      doc.moveDown(0.6)
    }

    // ===== 页脚（黑体 Regular，小字）=====
    const pageH = doc.page.height
    doc
      .font('sans')
      .fontSize(8)
      .fillColor('#999')
      .text(
        '本报告由 SmartTrans 多智能体系统自动生成，仅供参考',
        50,
        pageH - 40,
        { width: doc.page.width - 100, align: 'center' },
      )

    doc.end()

    stream.on('finish', () => {
      log.info(`PDF 生成完成 — ${outputPath}`)
      resolve()
    })
    stream.on('error', (err) => {
      log.error('PDF 写入失败', err.message)
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
