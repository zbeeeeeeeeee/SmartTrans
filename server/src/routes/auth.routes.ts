import crypto from 'node:crypto'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { db } from '../db/index'
import { config } from '../config'
import { createLogger } from '../utils/logger'
import { authRequired, type JwtPayload } from '../middleware/auth'

const log = createLogger('route:auth')
const router = Router()

interface UserRow {
  id: string
  username: string
  password_hash: string
  created_at: string
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return testHash === hash
}

function signToken(user: UserRow): { accessToken: string; user: { id: string; username: string } } {
  const payload: JwtPayload = { sub: user.id, username: user.username }
  const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' })
  return {
    accessToken,
    user: { id: user.id, username: user.username },
  }
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, password } = req.body ?? {}
  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (exists) {
    res.status(409).json({ error: 'Username already exists' })
    return
  }

  const id = crypto.randomUUID()
  const passwordHash = hashPassword(password)
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, passwordHash)

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow
  const result = signToken(user)
  res.status(201).json(result)
})

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {}
  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' })
    return
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid username or password' })
    return
  }

  const result = signToken(user)
  res.json(result)
})

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.userId!) as UserRow | undefined
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({ id: user.id, username: user.username, createdAt: user.created_at })
})

// POST /api/auth/batch-register - 批量创建账号
router.post('/batch-register', (req, res) => {
  const { users } = req.body ?? {}
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'users array is required' })
  }
  if (users.length > 100) {
    return res.status(400).json({ error: 'Max 100 users per batch' })
  }

  const insertStmt = db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
  const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?')

  const created: { username: string; password: string }[] = []
  const skipped: { username: string; reason: string }[] = []

  for (const item of users) {
    const username = typeof item?.username === 'string' ? item.username.trim() : ''
    const password = typeof item?.password === 'string' ? item.password : ''
    if (!username) {
      skipped.push({ username: username || '(empty)', reason: 'empty username' })
      continue
    }
    if (password.length < 6) {
      skipped.push({ username, reason: 'password too short (min 6)' })
      continue
    }
    if (checkStmt.get(username)) {
      skipped.push({ username, reason: 'already exists' })
      continue
    }
    try {
      const id = crypto.randomUUID()
      insertStmt.run(id, username, hashPassword(password))
      created.push({ username, password })
    } catch (e) {
      skipped.push({ username, reason: e instanceof Error ? e.message : String(e) })
    }
  }

  log.info(`Batch register - created=${created.length}, skipped=${skipped.length}`)
  res.status(201).json({ created, skipped })
})

// GET /api/auth/users - 列出所有用户
router.get('/users', (_req, res) => {
  const rows = db.prepare('SELECT id, username, created_at FROM users ORDER BY created_at DESC').all() as UserRow[]
  res.json(rows.map((r) => ({ id: r.id, username: r.username, createdAt: r.created_at })))
})

// DELETE /api/auth/users/:id - 删除用户（连带清理其报告）
router.delete('/users/:id', (req, res) => {
  const { id } = req.params
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id) as { id: string } | undefined
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  // 删除用户的报告
  db.prepare('DELETE FROM reports WHERE user_id = ?').run(id)
  // 删除用户
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  log.info(`User deleted - id=${id}`)
  res.json({ ok: true })
})

export default router
