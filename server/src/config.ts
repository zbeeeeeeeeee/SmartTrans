import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '..')

// 以绝对路径加载 .env，不依赖当前工作目录（concurrently / 根目录启动也能正确读取）
dotenv.config({ path: path.join(serverRoot, '.env') })

function parseBool(val: string | undefined, fallback: boolean): boolean {
  if (!val) return fallback
  const v = val.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'on'
}

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(serverRoot, 'data')

export const config = {
  port: Number(process.env.PORT ?? 28123),
  paths: {
    serverRoot,
    data: dataDir,
    uploads: path.join(dataDir, 'uploads'),
    knowledge: path.join(dataDir, 'knowledge'),
    pdfs: path.join(dataDir, 'pdfs'),
    fonts: path.join(dataDir, 'fonts'),
    skills: path.join(dataDir, 'skills'),
    db: path.join(dataDir, 'app.db'),
  },
  vision: {
    apiKey: process.env.QWEN_API_KEY ?? '',
    baseURL: process.env.QWEN_BASE_URL ?? 'https://api.siliconflow.cn/v1',
    model: process.env.QWEN_VISION_MODEL ?? 'Qwen/Qwen3-VL-30B-A3B-Instruct',
  },
  reasoning: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.siliconflow.cn/v1',
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-ai/DeepSeek-V4-Flash',
  },
  embedding: {
    apiKey: process.env.EMBEDDING_API_KEY ?? '',
    baseURL: process.env.EMBEDDING_BASE_URL ?? 'https://api.siliconflow.cn/v1',
    model: process.env.EMBEDDING_MODEL ?? 'Qwen/Qwen3-Embedding-8B',
    dim: Number(process.env.EMBEDDING_DIM ?? 4096),
  },
  mcp: {
    enabled: parseBool(process.env.MCP_ENABLED, false),
  },
}
