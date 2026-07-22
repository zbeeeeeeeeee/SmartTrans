import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { config } from '../config'

export interface JwtPayload {
  sub: string  // userId
  username: string
}

declare global {
  namespace Express {
    interface Request {
      userId?: string
      username?: string
    }
  }
}

/** JWT 鉴权中间件 — 从 Bearer token 中提取 userId */
export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  let token: string | undefined
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7)
  } else if (typeof req.query.token === 'string') {
    token = req.query.token
  }
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload
    req.userId = payload.sub
    req.username = payload.username
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
