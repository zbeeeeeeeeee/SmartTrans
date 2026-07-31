import fs from 'node:fs'
import path from 'node:path'
import { createLogger } from '../utils/logger'
import { config } from '../config'
import { chunkText } from './chunk'
import { embedChunks } from './embed'
import { clearKnowledge, insertChunk, insertDocument } from './store'

const log = createLogger('rag:ingest')

async function main(): Promise<void> {
  const dir = config.paths.knowledge
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(md|txt)$/i.test(f))
    .sort()

  if (files.length === 0) {
    log.warn(`知识库目录为空: ${dir}`)
    process.exit(0)
  }

  log.info(`重建知识库，发现 ${files.length} 个文件 ...`)
  clearKnowledge()

  let totalChunks = 0
  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8')
    const chunks = chunkText(text)
    if (chunks.length === 0) {
      log.warn(`${file}: 无可解析内容，跳过`)
      continue
    }

    const docId = insertDocument(path.parse(file).name, file, 'law')
    log.info(`${file}: 开始嵌入 ${chunks.length} 个分块...`)
    const embeddings = await embedChunks(chunks.map((c) => c.content))

    chunks.forEach((c, i) => insertChunk(docId, c.content, c.articleNo, embeddings[i]))
    totalChunks += chunks.length
    log.info(`${file}: 完成 — ${chunks.length} chunks`)
  }

  log.info(`完成，共写入 ${totalChunks} 个分块。`)
  process.exit(0)
}

main().catch((err) => {
  log.error('失败', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
