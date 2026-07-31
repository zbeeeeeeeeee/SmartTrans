import { createLogger } from './logger'

const log = createLogger('retry')

export interface RetryOptions {
  /** 整调用最大尝试次数（含首次，1 = 不重试）。默认 3 */
  maxAttempts?: number
  /** 首次重试前的基础延迟（ms）。默认 1000 */
  initialDelayMs?: number
  /** 退避因子。默认 2 */
  backoffFactor?: number
  /** 单次延迟上限（ms）。默认 30000 */
  maxDelayMs?: number
  /** 自定义可重试判定；默认 isRetryableError */
  retryOn?: (error: unknown) => boolean | Promise<boolean>
  /** 日志中标注的上下文（如 'vision-agent'） */
  context?: string
  /** 中断信号；触发后立即拒绝，不再重试 */
  signal?: AbortSignal
}

/** 常见网络层错误码（Node errno / undici） */
const NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ECONNABORTED',
  'EADDRNOTAVAIL',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_RESPONSE_TIMEOUT',
])

/** 错误消息兜底匹配（小写） */
const NETWORK_MESSAGE_PATTERNS = [
  'fetch failed',
  'failed to fetch',
  'socket hang up',
  'network error',
  'getaddrinfo',
  'connect etimedout',
  'connect econnreset',
  'other side closed',
  'connection reset',
  'connection refused',
  'connection timed out',
  'epipe',
  'write eof',
  'terminated',
]

/** 值得重试的 HTTP 状态码 */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

/**
 * 判断错误是否值得重试：
 * - AbortError 永不重试
 * - AI SDK RetryError：递归检查其 lastError / errors
 * - APICallError：isRetryable 标记 + statusCode
 * - Node errno / undici code
 * - 错误消息兜底匹配
 * - 递归检查 cause
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false
  const anyErr = error as Record<string, unknown>
  const name = anyErr.name

  if (name === 'AbortError') return false

  // AI SDK RetryError：内置重试耗尽后抛出，看其包装的真实错误
  if (name === 'RetryError') {
    const last = anyErr.lastError
    if (last !== undefined && isRetryableError(last)) return true
    const errs = anyErr.errors
    if (Array.isArray(errs) && errs.some((e) => isRetryableError(e))) return true
    return false
  }

  // APICallError.isRetryable（AI SDK 对网络错误 / 5xx / 429 会置 true）
  if (typeof anyErr.isRetryable === 'boolean' && anyErr.isRetryable) return true

  // HTTP 状态码
  if (typeof anyErr.statusCode === 'number' && RETRYABLE_STATUS.has(anyErr.statusCode)) {
    return true
  }

  // Node errno / undici code
  if (typeof anyErr.code === 'string' && NETWORK_ERROR_CODES.has(anyErr.code)) {
    return true
  }

  // 错误消息兜底
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (NETWORK_MESSAGE_PATTERNS.some((p) => msg.includes(p))) {
    return true
  }

  // 递归检查 cause（fetch failed 的真实原因常在 cause 上）
  const cause = anyErr.cause
  if (cause && cause !== error) {
    return isRetryableError(cause)
  }

  return false
}

/** 指数退避 + full jitter：delay ∈ [0, min(initial * factor^(n-1), max)] */
function computeDelay(
  attempt: number,
  initialDelayMs: number,
  backoffFactor: number,
  maxDelayMs: number,
): number {
  const base = initialDelayMs * Math.pow(backoffFactor, attempt - 1)
  const capped = Math.min(base, maxDelayMs)
  return Math.floor(Math.random() * capped)
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code
    return code ? `${error.name}[${code}]: ${error.message}` : `${error.name}: ${error.message}`
  }
  return String(error)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal!.reason ?? new Error('aborted'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * 整调用级重试：包裹一次完整的提供商调用（generateText / embed）。
 * 与 AI SDK 内置的 per-request 重试（maxRetries，默认 2）叠加使用：
 * 内置层负责单次请求的快速重试，本层负责整调用被耗尽/未被标记时的兜底重试。
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3
  const initialDelayMs = options.initialDelayMs ?? 1000
  const backoffFactor = options.backoffFactor ?? 2
  const maxDelayMs = options.maxDelayMs ?? 30000
  const retryOn = options.retryOn ?? isRetryableError
  const ctx = options.context ? `[${options.context}]` : ''

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      log.info(`${ctx}第 ${attempt}/${maxAttempts} 次尝试`)
    }
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break

      const shouldRetry = await retryOn(error)
      if (!shouldRetry) {
        log.warn(`${ctx}错误不可重试，直接抛出 - ${describe(error)}`)
        throw error
      }

      const delayMs = computeDelay(attempt, initialDelayMs, backoffFactor, maxDelayMs)
      log.warn(`${ctx}调用失败，${delayMs}ms 后重试 (${attempt}/${maxAttempts}) - ${describe(error)}`)
      await sleep(delayMs, options.signal)
    }
  }

  log.error(`${ctx}重试耗尽（共 ${maxAttempts} 次），最终失败 - ${describe(lastError)}`)
  throw lastError
}
