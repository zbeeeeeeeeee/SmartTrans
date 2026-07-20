import crypto from 'node:crypto'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { db } from '../db/index'
import { config } from '../config'
import { authRequired, type JwtPayload } from '../middleware/auth'

const router = Router()

interface UserRow {
  id: string
  username: string
  email: string
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

function signToken(user: UserRow): { accessToken: string; user: { id: string; username: string; email: string } } {
  const payload: JwtPayload = { sub: user.id, username: user.username }
  const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' })
  return {
    accessToken,
    user: { id: user.id, username: user.username, email: user.email },
  }
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, email, password } = req.body ?? {}
  if (!username || !email || !password) {
    res.status(400).json({ error: 'username, email, and password are required' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username)
  if (exists) {
    res.status(409).json({ error: 'Username or email already exists' })
    return
  }

  const id = crypto.randomUUID()
  const passwordHash = hashPassword(password)
  db.prepare('INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)').run(id, username, email, passwordHash)

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
  const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.userId!) as UserRow | undefined
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({ id: user.id, username: user.username, email: user.email, createdAt: user.created_at })
})

export default router
