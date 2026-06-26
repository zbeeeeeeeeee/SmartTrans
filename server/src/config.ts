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

export const config = {
  port: Number(process.env.PORT ?? 3000),
  paths: {
    serverRoot,
    data: path.join(serverRoot, 'data'),
    uploads: path.join(serverRoot, 'data', 'uploads'),
    knowledge: path.join(serverRoot, 'data', 'knowledge'),
    pdfs: path.join(serverRoot, 'data', 'pdfs'),
    fonts: path.join(serverRoot, 'data', 'fonts'),
    db: path.join(serverRoot, 'data', 'app.db'),
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
