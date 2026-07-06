// PM2 多实例进程管理配置
// 通过 INSTANCE_COUNT + BASE_PORT 环境变量控制实例数和起始端口
// 用法：
//   INSTANCE_COUNT=20 BASE_PORT=28123 pm2 start ecosystem.config.cjs
//   未设置时默认单实例，端口 28123（兼容旧行为）
const path = require('path')
const isWin = process.platform === 'win32'

const instanceCount = parseInt(process.env.INSTANCE_COUNT || '1', 10)
const basePort = parseInt(process.env.BASE_PORT || '28123', 10)

/** @type {import('pm2').StartOptions[]} */
const apps = []

for (let i = 0; i < instanceCount; i++) {
  const port = basePort + i
  const dataDir = path.resolve(__dirname, 'server', `data-${port}`)

  apps.push({
    name: `smarttrans-${port}`,
    cwd: path.resolve(__dirname, 'server'),
    script: 'src/index.ts',
    interpreter: isWin
      ? path.resolve(__dirname, 'server/node_modules/.bin/tsx.cmd')
      : path.resolve(__dirname, 'server/node_modules/.bin/tsx'),
    env: {
      NODE_ENV: 'production',
      PORT: String(port),
      DATA_DIR: dataDir,
      // 以下 API key 从父进程（deploy.sh source .env 后）继承
      QWEN_API_KEY: process.env.QWEN_API_KEY || '',
      QWEN_BASE_URL: process.env.QWEN_BASE_URL || 'https://api.siliconflow.cn/v1',
      QWEN_VISION_MODEL: process.env.QWEN_VISION_MODEL || 'Qwen/Qwen3-VL-30B-A3B-Instruct',
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
      DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL || 'https://api.siliconflow.cn/v1',
      DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-ai/DeepSeek-V4-Flash',
      EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY || '',
      EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL || 'https://api.siliconflow.cn/v1',
      EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-8B',
      EMBEDDING_DIM: process.env.EMBEDDING_DIM || '4096',
      MCP_ENABLED: process.env.MCP_ENABLED || 'false',
    },
    // 日志（每个实例独立日志文件）
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: path.resolve(__dirname, 'logs', `error-${port}.log`),
    out_file: path.resolve(__dirname, 'logs', `out-${port}.log`),
    merge_logs: true,
    // 崩溃自动重启
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    // 内存保护
    max_memory_restart: '500M',
    // 优雅关闭
    kill_timeout: 15000,
    listen_timeout: 10000,
  })
}

module.exports = { apps }
