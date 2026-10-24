import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import {
  clearRateLimit,
  clearSessionCookie,
  credentialsMatch,
  destroySession,
  hasSession,
  rateLimitExceeded,
  sessionTokenFrom,
  setSessionCookie,
  createSession,
} from './auth.js'
import { dbStatus } from './db.js'
import { Participant } from './models/Participant.js'
import { School } from './models/School.js'
import { Sponsor } from './models/Sponsor.js'
import { participantsRouter } from './routes/participants.js'
import { schoolsRouter } from './routes/schools.js'
import { sponsorsRouter } from './routes/sponsors.js'

const ADMIN_COLLECTIONS = {
  participants: Participant,
  schools: School,
  sponsors: Sponsor,
}

/**
 * Builds the express app. Kept separate from the listener so a different
 * server (or a test) can mount it without binding a port.
 */
export function createApp({
  adminEmail,
  adminPassword,
  ssrHandler = null,
  clientDir = null,
}) {
  const app = express()

  app.disable('x-powered-by')

  // Render terminates TLS at their proxy, so without this Express believes
  // every request is plain HTTP and `req.secure` (and the Secure cookie flag)
  // would be wrong.
  app.set('trust proxy', 1)

  // Scoped to /api so a mounted SSR handler still owns streamed bodies.
  app.use('/api', express.json({ limit: '1mb' }))

  // The Vite dev server proxies /api, so this only matters for direct hits.
  app.use((req, res, next) => {
    const origin = req.headers.origin
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.get('/api/health', (_req, res) => {
    res.json({ ok: dbStatus() === 'connected', db: dbStatus() })
  })

  app.use('/api/participants', participantsRouter)
  app.use('/api/schools', schoolsRouter)
  app.use('/api/sponsors', sponsorsRouter)

  // ──────────────────────────────────────────────────────────────────────────
  // Admin auth — email + password from env, httpOnly session cookie.
  // ──────────────────────────────────────────────────────────────────────────

  const configured = () => Boolean(adminEmail && adminPassword)

  /**
   * POST /api/admin/login — body { email, password }.
   * Rate limited per IP; on success sets the session cookie.
   */
  app.post('/api/admin/login', (req, res) => {
    if (!configured()) {
      return res
        .status(503)
        .json({ error: 'Admin credentials are not configured on the server.' })
    }

    if (rateLimitExceeded(req)) {
      return res
        .status(429)
        .json({ error: 'Too many attempts. Try again in a few minutes.' })
    }

    const body = req.body ?? {}

    // Same message and rough cost for unknown email and wrong password, so the
    // response doesn't reveal which accounts exist.
    if (!credentialsMatch(body, { adminEmail, adminPassword })) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    clearRateLimit(req)
    setSessionCookie(res, createSession())
    return res.json({ ok: true })
  })

  /** POST /api/admin/logout — clears the cookie and forgets the session. */
  app.post('/api/admin/logout', (req, res) => {
    destroySession(sessionTokenFrom(req))
    clearSessionCookie(res)
    res.json({ ok: true })
  })

  /** GET /api/admin/me — { ok: true } when the cookie is a live session. */
  app.get('/api/admin/me', requireAuth, (_req, res) => {
    res.json({ ok: true })
  })

  /** GET /api/admin/:collection — newest-first listing for the dashboard. */
  app.get('/api/admin/:collection', requireAuth, async (req, res, next) => {
    try {
      const Model = ADMIN_COLLECTIONS[req.params.collection]

      if (!Model) return res.status(404).json({ error: 'Unknown collection.' })

      const limit = Math.min(Number(req.query.limit) || 500, 1000)
      const docs = await Model.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()

      res.json({ count: docs.length, docs })
    } catch (err) {
      next(err)
    }
  })

  // Anything under /api that no route matched. Placed here so a mounted SSR
  // handler later can own everything outside /api.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))

  // eslint-disable-next-line no-unused-vars -- express picks handlers by arity.
  app.use('/api', (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON.' })
    }
    if (err?.name === 'ValidationError') {
      return res
        .status(422)
        .json({ error: err.message, fields: fieldErrors(err) })
    }
    if (err?.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid value supplied.' })
    }

    console.error(err)
    res
      .status(500)
      .json({ error: 'Something went wrong saving your submission.' })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Frontend Static Assets & TanStack Start SSR
  // ──────────────────────────────────────────────────────────────────────────

  if (clientDir && existsSync(clientDir)) {
    app.use(express.static(clientDir, { maxAge: '1y', index: false }))
  }

  if (ssrHandler && typeof ssrHandler.fetch === 'function') {
    app.use(async (req, res, next) => {
      if (req.path.startsWith('/api')) return next()
      try {
        const protocol = req.protocol || 'http'
        const host = req.get('host') || 'localhost'
        const url = new URL(req.originalUrl || req.url, `${protocol}://${host}`)

        const controller = new AbortController()
        req.on('close', () => controller.abort())

        const init = {
          method: req.method,
          headers: req.headers,
          signal: controller.signal,
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          init.body = req
          init.duplex = 'half'
        }

        const webReq = new Request(url, init)
        const webRes = await ssrHandler.fetch(webReq)

        res.status(webRes.status)
        webRes.headers.forEach((val, key) => {
          if (key.toLowerCase() === 'set-cookie') {
            const cookies = webRes.headers.getSetCookie?.() || [val]
            res.setHeader('Set-Cookie', cookies)
          } else {
            res.setHeader(key, val)
          }
        })

        if (!webRes.body) return res.end()
        Readable.fromWeb(webRes.body).pipe(res)
      } catch (err) {
        next(err)
      }
    })
  } else if (clientDir && existsSync(clientDir)) {
    const indexHtml = path.join(clientDir, 'index.html')
    if (existsSync(indexHtml)) {
      app.use((req, res, next) => {
        if (req.path.startsWith('/api')) return next()
        res.sendFile(indexHtml)
      })
    }
  }

  return app
}

/** Middleware: pass only when the request carries a live session cookie. */
function requireAuth(req, res, next) {
  if (hasSession(sessionTokenFrom(req))) return next()
  return res.status(401).json({ error: 'Not authenticated.' })
}

function fieldErrors(err) {
  const out = {}
  for (const [key, detail] of Object.entries(err.errors ?? {})) {
    out[key] = detail.message
  }
  return out
}
