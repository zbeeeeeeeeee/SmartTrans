# SmartTrans — 交通事故多智能体分析系统

基于 Express + Vue 3 + Vercel AI SDK + RAG 的交通事故智能分析平台。上传事故现场图片与文字描述，经由多智能体流水线自动完成场景识别、严重程度评估、责任判定与结构化报告生成，并支持 PDF 报告导出。

## 技术栈

| 层 | 技术 |
|---|------|
| **后端** | Express + TypeScript + tsx |
| **前端** | Vue 3 + Vite + TypeScript + Element Plus |
| **AI** | Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible`) + Zod |
| **RAG** | AI SDK `embed` / `embedMany` + sqlite-vec |
| **存储** | better-sqlite3 (SQLite)；上传：multer |
| **认证** | JWT (register/login) |
| **i18n** | 前端 vue-i18n + 后端提示词/标签/PDF 全量本地化 |
| **MCP** | @ai-sdk/mcp（模型上下文协议工具集成） |
| **Skills** | 自定义技能系统（模块化 AI 能力注入） |

## 模型（均走 SiliconFlow OpenAI 兼容端点）

| 用途 | 模型 | 环境变量前缀 |
|---|---|---|
| 视觉（图像识别） | `Qwen/Qwen3-VL-30B-A3B-Instruct` | `QWEN_*` |
| 推理（评估/责任/报告） | `deepseek-ai/DeepSeek-V4-Flash` | `DEEPSEEK_*` |
| 嵌入（RAG） | `Qwen/Qwen3-Embedding-8B` | `EMBEDDING_*` |

## 核心功能

### 多智能体分析流水线

```
Vision Agent → Severity Agent + Liability Agent (并行) → Report Agent → PDF
```

1. **图像识别** (Qwen3-VL) → 场景描述：车辆、路况、天气、信号灯
2. **严重程度评估** (DeepSeek) + **责任判定** (DeepSeek + RAG) 并行执行
3. **报告生成** (DeepSeek) → 综合所有分析结果，生成结构化事故报告，可选 PDF 导出

### RAG 知识库

- 上传交通法规文档（`.md` / `.txt`），自动分块、向量化入库
- 分析时通过语义检索匹配相关法条，注入到责任判定智能体的推理过程中
- 支持语义搜索预览

### MCP 工具集成

- **系统预设**：PDF 报告生成器（自动生成格式化 PDF）、高德地图逆地理编码（坐标 → 地址）
- **用户自定义**：支持 HTTP / SSE / stdio 三种传输方式，可接入任意 MCP 服务
- 工具按智能体粒度绑定，两级缓存优化性能

### Skills 技能系统

- 4 个系统预设技能：`vision-enhancer`、`severity-enhancer`、`liability-enhancer`、`report-enhancer`
- 用户可创建自定义 `SKILL.md` 技能，按智能体绑定
- 技能在运行时注入到对应用户智能体的 system prompt 中

### 多语言支持

- 前端：English / 简体中文 / 繁體中文
- 后端：所有提示词、Zod schema 描述、PDF 标签全量本地化
- 语言切换后整个流水线在目标语言下运行

### 用户认证

- 注册 / 登录（JWT，7 天有效期）
- 报告按用户隔离

## 快速开始

```bash
# 1. 安装全部依赖
npm run install:all

# 2. 配置环境变量
cp server/.env.example server/.env   # 然后填入 API key

# 3. (可选) 构建 RAG 知识库
npm run rag:ingest

# 4. 开发模式启动（server :28123 / web :5173）
npm run dev
```

打开 http://localhost:5173 ，注册账号后即可使用。

## 环境变量

全部配置在 `server/.env`：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `28123` | 服务端口 |
| `JWT_SECRET` | (开发默认值) | JWT 签名密钥，生产环境务必更换 |
| `DATA_DIR` | `server/data` | 数据目录（数据库、上传、知识库、PDF、字体、技能） |
| `QWEN_API_KEY` | — | 视觉模型 API Key |
| `QWEN_BASE_URL` | `https://api.siliconflow.cn/v1` | 视觉模型端点 |
| `DEEPSEEK_API_KEY` | — | 推理模型 API Key |
| `DEEPSEEK_BASE_URL` | `https://api.siliconflow.cn/v1` | 推理模型端点 |
| `EMBEDDING_API_KEY` | — | 嵌入模型 API Key |
| `EMBEDDING_BASE_URL` | `https://api.siliconflow.cn/v1` | 嵌入模型端点 |
| `EMBEDDING_DIM` | `4096` | 向量维度 |
| `MCP_ENABLED` | `false` | 启用 MCP 工具（PDF 生成、逆地理编码等） |
| `ALLOWED_ORIGINS` | — | CORS 白名单（逗号分隔，不设则允许所有） |
| `LOG_LEVEL` | `DEBUG` | 日志级别：DEBUG / INFO / WARN / ERROR |

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run install:all` | 安装根/后端/前端全部依赖 |
| `npm run dev` | 同时启动前后端开发服务 |
| `npm run build` | 构建前端至 `web/dist` |
| `npm run start` | 生产模式启动（Express 托管前端静态文件） |
| `npm run rag:ingest` | 重建 RAG 知识库向量索引 |
| `npm run typecheck` | 前后端 TypeScript 类型检查 |

## 项目结构

```
SmartTrans/
├── server/
│   ├── src/
│   │   ├── agents/       # 4 个智能体 + 流水线编排器 + Zod schema
│   │   ├── routes/       # Express 路由 (analysis/auth/reports/knowledge/mcp/skills)
│   │   ├── db/           # SQLite 数据库初始化 + 报告仓储
│   │   ├── rag/          # RAG 系统 (分块/入库/检索/工具)
│   │   ├── mcp/          # MCP 管理器 + PDF 服务器 + 仓储
│   │   ├── skills/       # 技能管理器 + 解析器 + 注入
│   │   ├── pdf/          # PDF 生成器 (pdfkit)
│   │   ├── i18n/         # 服务端多语言
│   │   ├── providers/    # AI SDK 模型配置
│   │   ├── middleware/   # JWT 认证 / 文件上传 / 错误处理
│   │   └── utils/        # 日志工具
│   ├── data/
│   │   ├── knowledge/    # RAG 知识库源文件
│   │   ├── skills/       # 技能 SKILL.md 文件
│   │   ├── fonts/        # PDF 中文字体（思源黑体/宋体）
│   │   ├── uploads/      # 上传图片
│   │   └── pdfs/         # 生成的 PDF 报告
│   └── scripts/          # 测试脚本
├── web/
│   └── src/
│       ├── views/        # 7 个页面视图
│       ├── components/   # 可复用组件
│       ├── composables/  # 组合式 API (分析流水线状态管理)
│       ├── api/          # API 客户端 (fetch 封装 + SSE 流消费)
│       ├── i18n/         # 前端多语言
│       └── utils/        # 工具函数 (图片压缩)
└── docs/                 # 使用手册 (中英文) + LaTeX 源码
```
