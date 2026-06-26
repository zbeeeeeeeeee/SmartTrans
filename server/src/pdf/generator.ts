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

/** 常见中文字体搜索路径（按优先级，优先 .ttf 以避免 ttc subset 兼容性问题） */
const FONT_CANDIDATES: string[] = (() => {
  const platform = os.platform()
  if (platform === 'win32') {
    return [
      'C:\\Windows\\Fonts\\simhei.ttf',      // 黑体（最佳兼容性）
      'C:\\Windows\\Fonts\\simkai.ttf',      // 楷体
      'C:\\Windows\\Fonts\\STXIHEI.TTF',     // 华文细黑
      'C:\\Windows\\Fonts\\STSONG.TTF',      // 华文宋体
      'C:\\Windows\\Fonts\\simfang.ttf',     // 仿宋
      'C:\\Windows\\Fonts\\STKAITI.TTF',     // 华文楷体
      'C:\\Windows\\Fonts\\STFANGSO.TTF',    // 华文仿宋
      'C:\\Windows\\Fonts\\STZHONGS.TTF',    // 华文中宋
      'C:\\Windows\\Fonts\\SimsunExtG.ttf',  // 宋体扩展G
      'C:\\Windows\\Fonts\\simsunb.ttf',     // 宋体粗体
    ]
  }
  if (platform === 'darwin') {
    return [
      '/System/Library/Fonts/STHeiti Light.ttc',
      '/System/Library/Fonts/PingFang.ttc',
      '/Library/Fonts/Arial Unicode.ttf',
      '/System/Library/Fonts/Hiragino Sans GB.ttc',
    ]
  }
  // Linux
  return [
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  ]
})()

/**
 * 寻找系统可用的中文字体，返回第一个存在的字体路径。
 * 如果全部未找到，尝试 data/fonts/ 下的自定义字体。
 */
function findChineseFont(): string {
  for (const candidate of FONT_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      log.info(`使用系统字体: ${candidate}`)
      return candidate
    }
  }
  // 尝试自定义字体目录
  const customFont = path.join(config.paths.fonts, 'NotoSansSC-Regular.ttf')
  if (fs.existsSync(customFont)) {
    log.info(`使用自定义字体: ${customFont}`)
    return customFont
  }
  throw new Error(
    `未找到可用的中文字体。请将中文字体文件(.ttf/.ttc)放入 ${config.paths.fonts}/ 目录。\n` +
    `推荐下载: 谷歌 Noto Sans SC (https://fonts.google.com/noto/specimen/Noto+Sans+SC)`,
  )
}

/**
 * 根据事故报告 JSON 生成 PDF 并写入文件。
 * @param report 结构化事故报告
 * @param outputPath 输出 PDF 文件路径（绝对路径）
 */
export async function generatePdf(report: AccidentReport, outputPath: string): Promise<void> {
  const fontPath = findChineseFont()
  const fontName = path.basename(fontPath, path.extname(fontPath))

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

    // 注册中文字体
    doc.registerFont(fontName, fontPath)

    // ===== 标题 =====
    doc
      .font(fontName)
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

    // ===== 基本信息 =====
    doc
      .fontSize(13)
      .fillColor('#2563eb')
      .text('基本信息', { underline: false })
    doc.moveDown(0.3)

    doc.fontSize(10).fillColor('#333')
    doc.text(`报告标题：${report.title ?? '交通事故分析报告'}`)
    doc.text(`生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`)
    doc.text(`严重等级：${SEVERITY_LABELS[report.severityLevel] ?? report.severityLevel}`)
    doc.moveDown(0.6)

    // ===== 事故概要 =====
    sectionHeader(doc, fontName, '事故概要')
    doc.fontSize(10).fillColor('#333').text(report.summary ?? '（无）')
    doc.moveDown(0.6)

    // ===== 现场情况 =====
    sectionHeader(doc, fontName, '现场情况')
    doc.fontSize(10).fillColor('#333').text(report.sceneSummary ?? '（无）')
    doc.moveDown(0.6)

    // ===== 责任认定 =====
    sectionHeader(doc, fontName, '责任认定')
    doc.fontSize(10).fillColor('#333').text(report.liabilityConclusion ?? '（无）')
    doc.moveDown(0.6)

    // ===== 引用法条 =====
    if (report.citedArticles && report.citedArticles.length > 0) {
      sectionHeader(doc, fontName, '引用法条')
      for (const article of report.citedArticles) {
        doc.fontSize(10).fillColor('#333').text(`• ${article}`, { indent: 10 })
      }
      doc.moveDown(0.6)
    }

    // ===== 处理建议 =====
    if (report.recommendations && report.recommendations.length > 0) {
      sectionHeader(doc, fontName, '处理建议')
      report.recommendations.forEach((rec, i) => {
        doc.fontSize(10).fillColor('#333').text(`${i + 1}. ${rec}`, { indent: 10 })
      })
      doc.moveDown(0.6)
    }

    // ===== 页脚 =====
    const totalPages = doc.bufferedPageRange().count
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i)
      doc
        .font(fontName)
        .fontSize(8)
        .fillColor('#999')
        .text(
          `— ${i + 1} —`,
          50,
          doc.page.height - 40,
          { width: doc.page.width - 100, align: 'center' },
        )
    }

    // 实际上 pdfkit 中页脚应该在内容结束后、end 之前设置
    // 对于单页文档，直接在底部添加
    const pageH = doc.page.height
    doc
      .font(fontName)
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

function sectionHeader(doc: InstanceType<typeof PDFDocument>, fontName: string, title: string): void {
  doc
    .font(fontName)
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
