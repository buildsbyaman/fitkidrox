import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Minimal admin auth: email + password from env, an httpOnly session cookie,
 * and an in-memory session store. No users collection, no hashing library,
 * no JWT — deliberate, so there is as little to get wrong as possible.
 *
 * Trade-off worth knowing: sessions live in process memory, so a restart or
 * deploy signs everyone out, and this will not survive running more than one
 * instance. For a single-admin panel that is a fair price for the simplicity.
 */

const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours
const SESSION_COOKIE = 'admin_session'

/** token → expiry epoch ms */
const sessions = new Map()

// ─────────────────────────────────────────────────────────────────────────────
// Cookies
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a cookie header into a key→value map. Tolerates a missing header. */
export function parseCookies(header = '') {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      out[key] = part.slice(eq + 1).trim()
    }
  }
  return out
}

/**
 * `Secure` is set whenever the connection is HTTPS. Behind Render's proxy we
 * only know that after `trust proxy` is enabled, so `req.secure` is the
 * reliable signal — with NODE_ENV as a fallback for anything upstream of us.
 */
function isSecure(req) {
  return req.secure || process.env.NODE_ENV === 'production'
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

function purgeExpired() {
  const now = Date.now()
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(token)
  }
}

// Cheap housekeeping rather than a timer that keeps the event loop busy.
setInterval(purgeExpired, 60 * 60 * 1000).unref()

export function createSession() {
  purgeExpired()
  const token = randomBytes(32).toString('hex')
  sessions.set(token, Date.now() + SESSION_TTL_MS)
  return token
}

export function hasSession(token) {
  if (!token) return false
  const expiresAt = sessions.get(token)
  if (expiresAt === undefined) return false
  if (expiresAt <= Date.now()) {
    sessions.delete(token)
    return false
  }
  return true
}

export function destroySession(token) {
  if (token) sessions.delete(token)
}

export function setSessionCookie(res, token) {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ]
  if (isSecure(res.req)) attrs.push('Secure')
  res.setHeader('Set-Cookie', attrs.join('; '))
}

export function clearSessionCookie(res) {
  const attrs = [
    `${SESSION_COOKIE}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (isSecure(res.req)) attrs.push('Secure')
  res.setHeader('Set-Cookie', attrs.join('; '))
}

export function sessionTokenFrom(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE]
}

// ─────────────────────────────────────────────────────────────────────────────
// Password check — constant time, and length-independent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Both sides are hashed first so `timingSafeEqual` gets equal-length buffers.
 * That keeps the comparison from leaking anything about the password's length
 * or content through timing.
 */
function safeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

export function credentialsMatch(
  { email, password },
  { adminEmail, adminPassword },
) {
  if (!adminEmail || !adminPassword) return false
  if (typeof email !== 'string' || typeof password !== 'string') return false
  const emailOk = safeEquals(
    email.trim().toLowerCase(),
    adminEmail.trim().toLowerCase(),
  )
  const passwordOk = safeEquals(password, adminPassword)
  return emailOk && passwordOk
}

// ─────────────────────────────────────────────────────────────────────────────
// Login rate limiting — in-memory, per IP
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

/** ip → { count, resetAt } */
const attempts = new Map()

function clientIp(req) {
  // Accurate only once `trust proxy` is on, which Render requires.
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

export function rateLimitExceeded(req, res) {
  const now = Date.now()
  const ip = clientIp(req)
  const entry = attempts.get(ip)

  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  entry.count += 1
  if (entry.count > MAX_ATTEMPTS && res) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))),
    )
    return true
  }
  return entry.count > MAX_ATTEMPTS
}

/** Called after a successful login so a real admin isn't locked out. */
export function clearRateLimit(req) {
  attempts.delete(clientIp(req))
}

// Kept small so a long-running process doesn't accumulate stale IPs.
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(ip)
  }
}, WINDOW_MS).unref()

/**
 * General IP-based in-memory rate limiter middleware factory for public endpoints.
 */
export function createRateLimiter({
  windowMs = 10 * 60 * 1000,
  maxRequests = 30,
  message = 'Too many requests. Please try again later.',
} = {}) {
  const hits = new Map()

  setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(ip)
    }
  }, windowMs).unref()

  return (req, res, next) => {
    const ip = clientIp(req)
    const now = Date.now()
    const entry = hits.get(ip)

    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs })
      return next()
    }

    entry.count += 1
    if (entry.count > maxRequests) {
      // Tell clients when to come back instead of leaving them guessing.
      res.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))),
      )
      return res.status(429).json({ error: message })
    }

    next()
  }
}
