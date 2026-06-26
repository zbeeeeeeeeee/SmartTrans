import fs from 'node:fs'
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import { createLogger } from '../utils/logger'
import { config } from '../config'

const log = createLogger('db')

fs.mkdirSync(config.paths.uploads, { recursive: true })
fs.mkdirSync(config.paths.knowledge, { recursive: true })
fs.mkdirSync(config.paths.pdfs, { recursive: true })
fs.mkdirSync(config.paths.fonts, { recursive: true })

log.info(`打开数据库 — ${config.paths.db}`)
export const db = new Database(config.paths.db)
db.pragma('journal_mode = WAL')

sqliteVec.load(db)
log.info('sqlite-vec 已加载')

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id          TEXT PRIMARY KEY,
    description TEXT,
    image_paths TEXT,
    scene       TEXT,
    severity    TEXT,
    liability   TEXT,
    report      TEXT,
    created_at  TEXT DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS kb_documents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT,
    source     TEXT,
    category   TEXT,
    created_at TEXT DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS kb_chunks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,
    content     TEXT,
    article_no  TEXT,
    token_count INTEGER
  );
`)

db.exec(
  `CREATE VIRTUAL TABLE IF NOT EXISTS vec_kb_chunks USING vec0(embedding float[${config.embedding.dim}]);`,
)

// MCP 相关表
db.exec(`
  CREATE TABLE IF NOT EXISTS mcp_connections (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    transport  TEXT NOT NULL,
    url        TEXT,
    command    TEXT,
    args       TEXT,
    headers    TEXT,
    status     TEXT DEFAULT 'stopped',
    error_msg  TEXT,
    created_at TEXT DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS agent_mcp_settings (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name        TEXT NOT NULL,
    mcp_connection_id TEXT NOT NULL,
    enabled           INTEGER DEFAULT 0,
    UNIQUE(agent_name, mcp_connection_id)
  );
`)

// 安全迁移：添加 pdf_path 列（如果不存在）
{
  const cols = db.pragma('table_info(reports)') as { name: string }[]
  if (!cols.some((c) => c.name === 'pdf_path')) {
    db.exec('ALTER TABLE reports ADD COLUMN pdf_path TEXT')
    log.info('迁移: reports 表添加 pdf_path 列')
  }
}

// 安全迁移：添加 is_system 列（如果不存在）
{
  const cols = db.pragma('table_info(mcp_connections)') as { name: string }[]
  if (!cols.some((c) => c.name === 'is_system')) {
    db.exec('ALTER TABLE mcp_connections ADD COLUMN is_system INTEGER DEFAULT 0')
    log.info('迁移: mcp_connections 表添加 is_system 列')
  }
}

// 启动时输出知识库状态
const docCount = (db.prepare('SELECT COUNT(*) AS n FROM kb_documents').get() as { n: number }).n
const chunkCount = (db.prepare('SELECT COUNT(*) AS n FROM kb_chunks').get() as { n: number }).n
const vecCount = (db.prepare('SELECT COUNT(*) AS n FROM vec_kb_chunks').get() as { n: number }).n
const mcpConnCount = (db.prepare('SELECT COUNT(*) AS n FROM mcp_connections').get() as { n: number }).n
const mcpSettingsCount = (db.prepare('SELECT COUNT(*) AS n FROM agent_mcp_settings').get() as { n: number }).n
const pdfCount = (db.prepare('SELECT COUNT(*) AS n FROM reports WHERE pdf_path IS NOT NULL').get() as { n: number }).n
log.info(`数据库就绪 — reports 表, kb_documents=${docCount}, kb_chunks=${chunkCount}, vec_kb_chunks=${vecCount}, mcp_connections=${mcpConnCount}, agent_mcp_settings=${mcpSettingsCount}, reports_with_pdf=${pdfCount}`)
