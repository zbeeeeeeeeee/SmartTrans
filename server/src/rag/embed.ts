import { embedMany } from 'ai'
import { embeddingModel } from '../providers/index'
import { createLogger } from '../utils/logger'

const log = createLogger('rag:embed')

const BATCH_SIZE = 32
const CONCURRENCY = 4
const MAX_RETRIES = 3

async function embedBatchWithRetry(batch: string[], idx: number): Promise<number[][]> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: batch,
        maxRetries: 0,
      })
      return embeddings
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * 2 ** (attempt - 1)
        log.warn(`批次 [${idx + 1}] 第 ${attempt}/${MAX_RETRIES} 次失败: ${msg}，${delay}ms 后重试`)
        await new Promise((r) => setTimeout(r, delay))
      } else {
        log.error(`批次 [${idx + 1}] 重试 ${MAX_RETRIES} 次仍失败: ${msg}`)
      }
    }
  }
  throw lastErr
}

/**
 * 将文本分批嵌入为向量。
 *
 * SiliconFlow /embeddings 的数组形式 input 上限为 maxItems=32，
 * 因此按 32 一批切分，最多 CONCURRENCY 个请求并发。
 * 返回的 embeddings 顺序与输入 texts 一一对应。
 */
export async function embedChunks(texts: string[]): Promise<number[][]> {
  const total = texts.length
  const batches: string[][] = []
  for (let i = 0; i < total; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE))
  }

  const all = new Array<number[]>(total)
  let done = 0
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < batches.length) {
      const idx = cursor++
      const batch = batches[idx]
      const embeddings = await embedBatchWithRetry(batch, idx)
      const base = idx * BATCH_SIZE
      embeddings.forEach((e, i) => {
        all[base + i] = e
      })
      done += batch.length
      log.info(`嵌入进度 [${idx + 1}/${batches.length}] ${done}/${total}`)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker()),
  )
  return all
}
