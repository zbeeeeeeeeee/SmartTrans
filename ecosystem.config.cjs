const path = require('path')

const root = __dirname
const port = process.env.PORT || '28123'
const name = process.env.PROCESS_NAME || 'smarttrans'

module.exports = {
  apps: [
    {
      name,
      script: path.join(root, 'server', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      args: 'src/index.ts',
      cwd: path.join(root, 'server'),
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 8000,
      out_file: path.join(root, 'logs', 'smarttrans-out.log'),
      error_file: path.join(root, 'logs', 'smarttrans-error.log'),
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: port,
        FORCE_COLOR: '0',
        LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
      },
    },
  ],
}
