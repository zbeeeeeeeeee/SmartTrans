# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

| Task | Command |
|---|---|
| Install all deps | `npm run install:all` |
| Dev (server :3000 + web :5173) | `npm run dev` |
| Typecheck both | `npm run typecheck` |
| Rebuild RAG vector store | `npm run rag:ingest` |
| Production build (frontend → `web/dist`) | `npm run build` |
| Test API endpoints | `npm --prefix server run test:api` |

**server scripts** (run from `server/`): `npm run dev` (tsx), `npm run typecheck` (tsc --noEmit), `npm run rag:ingest`, `npm run test:api`
**web scripts** (run from `web/`): `npm run dev` (vite), `npm run build`, `npm run typecheck` (vue-tsc)

## First-Time Setup

```bash
npm run install:all
cp server\.env.example server\.env   # then edit: fill in API keys for vision/reasoning/embedding models
npm run rag:ingest                   # build vector store from server/data/knowledge/
npm run dev                          # starts both server:3000 and web:5173
```

## Architecture

```
Express (server/src/index.ts)
  ├─ POST /api/analyze        ← SSE stream of multi-agent pipeline stages
  ├─ GET/POST /api/reports/*   ← CRUD on analyzed reports (SQLite)
  ├─ GET/POST /api/knowledge/* ← RAG knowledge base search, upload, & stats
  ├─ GET|POST|DELETE /api/mcp/* ← MCP connection management & agent tool binding
  ├─ GET /api/health
  └─ Static: /uploads/* (uploaded images), web/dist/* (prod SPA fallback)

Vue 3 SPA (web/src/)
  ├─ AnalyzeView   ← upload images + text, watch SSE progress, see final report
  ├─ HistoryView   ← browse past reports with detail dialog
  ├─ KnowledgeView ← search legal knowledge base, upload/delete documents
  └─ McpSettingsView ← manage MCP connections + per-agent tool enablement
```

During dev, Vite proxies `/api` and `/uploads` to `http://localhost:3000`. In production, Express serves `web/dist` directly.

## Multi-Agent Pipeline (server/src/agents/orchestrator.ts)

The pipeline runs sequentially via an async generator that yields `StageEvent`s over SSE:

1. **Vision Agent** (`Qwen3-VL-30B-A3B-Instruct`) → scene description (vehicles, road, weather, signals)
2. **Severity Agent** (`DeepSeek-V4-Flash`) → minor/moderate/severe + injury/property assessment
3. **Liability Agent** (`DeepSeek-V4-Flash` + RAG) → fault percentages per party + cited legal articles
4. **Report Agent** (`DeepSeek-V4-Flash`) → structured accident report with recommendations

All agent outputs are validated against Zod schemas (`schemas.ts`) via `generateObject()`. On completion, the report is persisted to SQLite via `insertReport()`.

### Two-Stage Structured Generation (server/src/agents/helpers.ts)

When MCP tools are assigned to an agent, `generateStructured()` uses a two-phase approach:

1. **Phase 1** — `generateText()` with tools: the model may call external MCP tools (capped at 10 steps via `stepCountIs(10)`)
2. **Phase 2** — `generateObject()`: tool results are injected into the prompt/context, then structured output is enforced against the Zod schema

Without tools, it calls `generateObject()` directly. This is the central generation helper used by all four agents.

## RAG System (server/src/rag/)

- **Knowledge corpus**: Markdown files in `server/data/knowledge/` (traffic law excerpts), plus runtime-uploaded documents via the web UI
- **Chunking** (`chunk.ts`): Article-aware — detects `第X条` markers and splits by article; falls back to sliding window (500 chars, 80 overlap)
- **Embedding** (`ingest.ts`): Batch CLI using `embedMany()` with Qwen3-Embedding-8B (4096 dims)
- **Storage** (`store.ts`): `better-sqlite3` + `sqlite-vec` virtual table (`vec_kb_chunks`) for vector similarity search. Runtime uploads go through the same embed→insert flow via the knowledge routes
- **Retrieval** (`retriever.ts`): Embeds query → KNN on vec0 table → returns top-k chunks with source/article metadata

Rebuild the vector store after changing knowledge files: `npm run rag:ingest`. Individual documents can also be uploaded/deleted at runtime via `POST/DELETE /api/knowledge/documents`.

## MCP System (server/src/mcp/)

Model Context Protocol integration allows agents to call external tools during analysis:

- **Manager** (`manager.ts`): Singleton `McpManager` — maintains a map of MCP client connections, handles connect/reconnect/disconnect lifecycle, provides `getToolsForAgent(agentName)` to aggregate tools from all enabled connections for a given agent
- **Store** (`store.ts`): Persists connection configs (`mcp_connections` table) and per-agent enablement settings (`agent_mcp_settings` table)
- **Types** (`types.ts`): `McpConnectionConfig` (transport: http/sse/stdio), `McpConnectionStatus`, `AgentMcpSetting`
- **Routes** (`routes/mcp.routes.ts`): `GET/POST/DELETE /api/mcp/connections`, `GET/PUT /api/mcp/agent-settings`, `GET /api/mcp/status`

MCP is gated by the `MCP_ENABLED` env var (defaults to `false`). When disabled, all `/api/mcp/*` routes return 404 and agents run without external tools.

### Preset System Connections

Preset MCP connections are seeded on startup, cannot be deleted by users, and show a "系统" badge in the UI. They are marked with `is_system = 1` in the `mcp_connections` table. The seeding logic is in `McpManager.seedPresets()`.

**PDF报告生成器** (`system-pdf-generator`): HTTP MCP tool at `/api/mcp/pdf-tool` (JSON-RPC 2.0 endpoint within Express). Exposes `generate_report_pdf` — takes `reportJson` string, generates a styled PDF via pdfkit, stores to `server/data/pdfs/`.

### PDF Report Generation (server/src/pdf/generator.ts)

After the multi-agent pipeline completes and the report is persisted, the orchestrator generates a PDF automatically (best-effort, failure is non-fatal). PDFs are stored at `server/data/pdfs/report-<uuid>.pdf` with a `pdf_path` column in the `reports` table tracking the file.

- **Library**: `pdfkit` (A4, 50pt margins, styled sections)
- **Font**: Auto-detects Chinese system font (Windows: 微软雅黑/宋体; macOS: PingFang; Linux: Noto Sans CJK). Falls back to `server/data/fonts/NotoSansSC-Regular.ttf` if present.
- **Download**: `GET /api/reports/:id/pdf` streams the PDF with `Content-Disposition: attachment`
- Frontend shows a "下载PDF" button in HistoryView only when `hasPdf` is true

## Database (server/src/db/)

SQLite via `better-sqlite3` with WAL mode + `sqlite-vec` extension. File: `server/data/app.db`.

| Table | Purpose |
|---|---|
| `reports` | Completed analysis reports (JSON columns + pdf_path for optional PDF download) |
| `kb_documents` | Knowledge base document metadata |
| `kb_chunks` | Text chunks with article number references |
| `vec_kb_chunks` | Virtual table (vec0) — float[4096] embeddings for vector search |
| `mcp_connections` | MCP server connection configs and status |
| `agent_mcp_settings` | Per-agent enable/disable flags for each MCP connection |

Timestamps use Beijing time (`Asia/Shanghai`, `datetime('now', '+8 hours')`).

## AI Model Configuration (server/src/config.ts + providers/index.ts)

All three models go through SiliconFlow's OpenAI-compatible endpoint. Three separate providers are created via `createOpenAICompatible` — one per model class — to allow different keys/endpoints per model. See `server/.env.example` for all env vars.

## Upload Middleware (server/src/middleware/upload.ts)

- **Analysis images**: `upload.array('images', 6)` — max 6 files, 15MB each, image MIME types only
- **Knowledge documents**: `uploadKnowledge.single('file')` — max 1 file, 5MB, `.md`/`.txt`/`.markdown` only

Uploaded files are stored in `server/data/uploads/` with random UUID filenames.
