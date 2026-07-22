import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import { createLogger } from '../utils/logger'
import { config } from '../config'

const log = createLogger('db')

fs.mkdirSync(config.paths.uploads, { recursive: true })
fs.mkdirSync(config.paths.knowledge, { recursive: true })
fs.mkdirSync(config.paths.pdfs, { recursive: true })
fs.mkdirSync(config.paths.fonts, { recursive: true })
fs.mkdirSync(config.paths.skills, { recursive: true })
fs.mkdirSync(config.paths.workspaces, { recursive: true })

log.info(`打开数据库 - ${config.paths.db}`)
export const db = new Database(config.paths.db)
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000')

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

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now', '+8 hours'))
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

  -- Skills 相关表
  CREATE TABLE IF NOT EXISTS skills (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    description   TEXT,
    source_path   TEXT,
    files_json    TEXT,
    provider_ref  TEXT,
    upload_status TEXT DEFAULT 'local',
    is_system     INTEGER DEFAULT 0,
    enabled       INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS agent_skill_settings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    skill_id   TEXT NOT NULL,
    enabled    INTEGER DEFAULT 0,
    UNIQUE(agent_name, skill_id)
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
  const mcpCols = db.pragma('table_info(mcp_connections)') as { name: string }[]
  if (!mcpCols.some((c) => c.name === 'is_system')) {
    db.exec('ALTER TABLE mcp_connections ADD COLUMN is_system INTEGER DEFAULT 0')
    log.info('迁移: mcp_connections 表添加 is_system 列')
  }
}
// 安全迁移：skills 表添加 is_system 列（如果不存在）
{
  const skillCols = db.pragma('table_info(skills)') as { name: string }[]
  if (!skillCols.some((c) => c.name === 'is_system')) {
    db.exec('ALTER TABLE skills ADD COLUMN is_system INTEGER DEFAULT 0')
    log.info('迁移: skills 表添加 is_system 列')
  }
}
// 安全迁移：skills 表添加 enabled 列（如果不存在）
{
  const skillCols = db.pragma('table_info(skills)') as { name: string }[]
  if (!skillCols.some((c) => c.name === 'enabled')) {
    db.exec('ALTER TABLE skills ADD COLUMN enabled INTEGER DEFAULT 1')
    log.info('迁移: skills 表添加 enabled 列')
  }
}

// 安全迁移：reports 表添加 user_id 列（如果不存在）
{
  const reportCols = db.pragma('table_info(reports)') as { name: string }[]
  if (!reportCols.some((c) => c.name === 'user_id')) {
    db.exec('ALTER TABLE reports ADD COLUMN user_id TEXT')
    log.info('迁移: reports 表添加 user_id 列')
  }
}

// 安全迁移：去掉 users 表的 email 列（如果存在）
{
  const userCols = db.pragma('table_info(users)') as { name: string }[]
  if (userCols.some((c) => c.name === 'email')) {
    db.exec(`
      CREATE TABLE users_new (
        id            TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TEXT DEFAULT (datetime('now', '+8 hours'))
      );
      INSERT INTO users_new (id, username, password_hash, created_at)
        SELECT id, username, password_hash, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `)
    log.info('迁移: users 表移除 email 列')
  }
}

// 启动时输出知识库状态
const docCount = (db.prepare('SELECT COUNT(*) AS n FROM kb_documents').get() as { n: number }).n
const chunkCount = (db.prepare('SELECT COUNT(*) AS n FROM kb_chunks').get() as { n: number }).n
const vecCount = (db.prepare('SELECT COUNT(*) AS n FROM vec_kb_chunks').get() as { n: number }).n
const mcpConnCount = (db.prepare('SELECT COUNT(*) AS n FROM mcp_connections').get() as { n: number }).n
const mcpSettingsCount = (db.prepare('SELECT COUNT(*) AS n FROM agent_mcp_settings').get() as { n: number }).n
const pdfCount = (db.prepare('SELECT COUNT(*) AS n FROM reports WHERE pdf_path IS NOT NULL').get() as { n: number }).n
const skillCount = (db.prepare('SELECT COUNT(*) AS n FROM skills').get() as { n: number }).n
const skillSettingsCount = (db.prepare('SELECT COUNT(*) AS n FROM agent_skill_settings').get() as { n: number }).n
const userCount = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
log.info(`数据库就绪 — reports 表, users=${userCount}, kb_documents=${docCount}, kb_chunks=${chunkCount}, vec_kb_chunks=${vecCount}, mcp_connections=${mcpConnCount}, agent_mcp_settings=${mcpSettingsCount}, reports_with_pdf=${pdfCount}, skills=${skillCount}, agent_skill_settings=${skillSettingsCount}`)

// 启动清理孤儿工作空间：删除无对应 reports 行的 workspaces/<userId>/<runId>/ 目录
{
  let cleaned = 0
  for (const userDir of fs.readdirSync(config.paths.workspaces)) {
    const userPath = path.join(config.paths.workspaces, userDir)
    if (!fs.statSync(userPath).isDirectory()) continue
    for (const runDir of fs.readdirSync(userPath)) {
      const runPath = path.join(userPath, runDir)
      if (!fs.statSync(runPath).isDirectory()) continue
      const exists = (db.prepare('SELECT 1 AS ok FROM reports WHERE id = ? AND user_id = ?').get(runDir, userDir) as { ok?: number } | undefined)?.ok
      if (!exists) {
        fs.rmSync(runPath, { recursive: true, force: true })
        cleaned++
      }
    }
    if (fs.readdirSync(userPath).length === 0) fs.rmdirSync(userPath)
  }
  if (cleaned > 0) log.info(`清理孤儿工作空间 — ${cleaned} 个`)
}
