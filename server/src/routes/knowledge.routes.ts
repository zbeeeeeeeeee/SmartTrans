import fs from 'node:fs'
import { Router } from 'express'
import { embedMany } from 'ai'
import { createLogger } from '../utils/logger'
import { embeddingModel } from '../providers/index'
import { uploadKnowledge } from '../middleware/upload'
import { chunkText } from '../rag/chunk'
import { retrieveLegalContext } from '../rag/retriever'
import { deleteDocument, insertChunk, insertDocument, knowledgeStats, listDocuments } from '../rag/store'

const log = createLogger('route:knowledge')
const router = Router()

// GET /api/knowledge — 知识库统计
router.get('/', (_req, res) => {
  const stats = knowledgeStats()
  log.info(`GET / — documents=${stats.documents}, chunks=${stats.chunks}`)
  res.json(stats)
})

// POST /api/knowledge/search — 检索法律法规
router.post('/search', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query : ''
  if (!query) {
    log.warn('POST /search — 缺少 query')
    res.status(400).json({ error: 'query required' })
    return
  }
  log.info(`POST /search — query="${query.slice(0, 100)}"`)
  const k = Number(req.body?.k ?? 5)
  const chunks = await retrieveLegalContext(query, Number.isFinite(k) ? k : 5)
  log.info(`POST /search — 返回 ${chunks.length} 条`)
  res.json(chunks)
})

// POST /api/knowledge/documents — 上传文档，自动切片 + 嵌入 + 入库
router.post('/documents', uploadKnowledge.single('file'), async (req, res) => {
  try {
    const file = req.file as Express.Multer.File | undefined
    if (!file) {
      log.warn('POST /documents — 未收到文件')
      res.status(400).json({ error: '请上传 .md 或 .txt 文件' })
      return
    }

    // Windows 下 multer 对中文文件名存在 latin1 编码问题，手动修复
    const rawName = Buffer.from(file.originalname, 'latin1').toString('utf8')

    log.info(`POST /documents — 收到文件: ${rawName}, size=${file.size}`)

    const text = fs.readFileSync(file.path, 'utf8')
    const chunks = chunkText(text)
    if (chunks.length === 0) {
      log.warn('POST /documents — 文件无可解析内容')
      res.status(400).json({ error: '文件无可解析内容' })
      return
    }

    const title = rawName.replace(/\.(md|txt|markdown)$/i, '')
    log.info(`POST /documents — 分块 ${chunks.length} 个, 开始嵌入...`)

    const docId = insertDocument(title, file.filename, 'upload')
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: chunks.map((c) => c.content),
      maxParallelCalls: 4,
    })

    chunks.forEach((c, i) => insertChunk(docId, c.content, c.articleNo, embeddings[i]))

    log.info(`POST /documents — 完成, docId=${docId}, chunks=${chunks.length}`)
    res.status(201).json({
      id: docId,
      title,
      source: file.filename,
      category: 'upload',
      chunkCount: chunks.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('POST /documents — 失败', message)
    res.status(500).json({ error: message })
  }
})

// GET /api/knowledge/documents — 列出所有文档
router.get('/documents', (_req, res) => {
  const docs = listDocuments()
  log.info(`GET /documents — ${docs.length} 个文档`)
  res.json(docs)
})

// DELETE /api/knowledge/documents/:id — 删除文档及其切片和向量
router.delete('/documents/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) {
    log.warn(`DELETE /documents/:id — 无效 id: ${req.params.id}`)
    res.status(400).json({ error: 'invalid id' })
    return
  }
  log.info(`DELETE /documents/${id}`)
  const deleted = deleteDocument(id)
  if (!deleted) {
    log.warn(`DELETE /documents/${id} — 文档不存在`)
    res.status(404).json({ error: 'document not found' })
    return
  }
  log.info(`DELETE /documents/${id} — 已删除`)
  res.json({ ok: true })
})

export default router
