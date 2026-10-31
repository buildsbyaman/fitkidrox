import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import {
  clearRateLimit,
  clearSessionCookie,
  createRateLimiter,
  credentialsMatch,
  destroySession,
  hasSession,
  rateLimitExceeded,
  sessionTokenFrom,
  setSessionCookie,
  createSession,
} from './auth.js'
import mongoose from 'mongoose'
import { dbStatus } from './db.js'
import { assignBibToParticipant } from './lib/bib.js'
import { sendParticipantConfirmationEmail } from './lib/mailer.js'
import { createWithUniqueReference } from './lib/reference.js'
import { Participant } from './models/Participant.js'
import { School } from './models/School.js'
import { Sponsor } from './models/Sponsor.js'
import { authRouter } from './routes/auth.js'
import { participantsRouter } from './routes/participants.js'
import { paymentsRouter } from './routes/payments.js'
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
  // would be wrong. Set TRUST_PROXY_HOPS when an extra proxy (e.g. a CDN) sits
  // in front — otherwise the client controls `X-Forwarded-For` and can rotate
  // its IP to slip past the per-IP rate limiters.
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? 1)
  app.set('trust proxy', Number.isInteger(hops) && hops >= 0 ? hops : 1)

  // Essential HTTP security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    )
    // `req.secure` is true once trust proxy is right; NODE_ENV is the fallback
    // so HSTS still ships if the proxy header is ever missing.
    if (req.secure || process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      )
    }
    next()
  })

  // Lightweight access log: every API request plus anything that errored
  // elsewhere. Static assets on the happy path are skipped to keep it readable.
  app.use((req, res, next) => {
    const start = process.hrtime.bigint()
    res.on('finish', () => {
      const isApi = req.path.startsWith('/api')
      if (!isApi && res.statusCode < 400) return
      const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6)
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${
          res.statusCode
        } ${req.ip} ${ms}ms`,
      )
    })
    next()
  })

  // Scoped to /api so a mounted SSR handler still owns streamed bodies.
  app.use('/api', express.json({ limit: '1mb' }))

  // The Vite dev server proxies /api, so this only matters for direct hits.
  app.use((req, res, next) => {
    const origin = req.headers.origin
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      )
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  // `ok` reflects the DB so uptime checks still catch an outage, but the
  // internal connection state is no longer published to anyone on the internet.
  app.get('/api/health', (_req, res) => {
    res.json({ ok: dbStatus() === 'connected' })
  })

  // Rate limiting for public mutation endpoints to protect DB and external APIs
  const publicSubmissionLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 30,
    message: 'Too many submissions from this IP. Please try again later.',
  })

  const orderLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 20,
    message: 'Too many payment requests from this IP. Please try again later.',
  })

  // Its own bucket: sharing the submissions counter meant a busy family or
  // school network could trip 429 *after* the money was taken, blocking the
  // verification step of a payment that already succeeded.
  const verifyPaymentLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 30,
    message: 'Too many verification attempts from this IP. Please try again later.',
  })

  app.use('/api/auth', authRouter)
  app.use('/api/participants', publicSubmissionLimiter, participantsRouter)
  app.use('/api/schools', publicSubmissionLimiter, schoolsRouter)
  app.use('/api/sponsors', publicSubmissionLimiter, sponsorsRouter)
  app.use('/api/create-order', orderLimiter)
  app.use('/api/verify-payment', verifyPaymentLimiter)
  // Razorpay order creation + signature verification (must precede the 404).
  app.use('/api', paymentsRouter)

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

    if (rateLimitExceeded(req, res)) {
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

  /** GET /api/admin/heat-sheets — generate heat sheets and participant lists from saved records. */
  app.get('/api/admin/heat-sheets', requireAuth, async (_req, res, next) => {
    try {
      const participants = await Participant.find({
        'payment.status': 'paid',
        bibNumber: { $exists: true, $ne: null },
      })
        .sort({ bibNumber: 1 })
        .select(
          'bibNumber childName category heat course checkedIn checkedInAt school tshirt guardianName guardianPhone',
        )
        .lean()

      const heatSheets = {}
      for (const p of participants) {
        const cat = p.category || 'Uncategorized'
        if (!heatSheets[cat]) heatSheets[cat] = {}
        const heatNum = p.heat || 1
        if (!heatSheets[cat][heatNum]) {
          heatSheets[cat][heatNum] = {
            heat: heatNum,
            course: p.course || (heatNum % 2 !== 0 ? 'Course A' : 'Course B'),
            participants: [],
          }
        }
        heatSheets[cat][heatNum].participants.push(p)
      }

      res.json({
        ok: true,
        count: participants.length,
        heatSheets,
        participants,
      })
    } catch (err) {
      next(err)
    }
  })

  /** GET /api/admin/:collection — newest-first listing for the dashboard. */
  app.get('/api/admin/:collection', requireAuth, async (req, res, next) => {
    try {
      const Model = ADMIN_COLLECTIONS[req.params.collection]

      if (!Model) return res.status(404).json({ error: 'Unknown collection.' })

      const limit = Math.max(1, Math.min(Number(req.query.limit) || 500, 1000))
      const docs = await Model.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()

      res.json({ count: docs.length, docs })
    } catch (err) {
      next(err)
    }
  })

  /** POST /api/admin/participants — manual entry creation for a student with custom amount */
  app.post('/api/admin/participants', requireAuth, async (req, res, next) => {
    try {
      const body = req.body ?? {}

      const cleanString = (val, max = 200) =>
        typeof val === 'string' ? val.trim().slice(0, max) : ''

      const childName = cleanString(body.childName, 120)
      const dob = cleanString(body.dob, 30)
      const gender = cleanString(body.gender, 30)
      const tshirt = cleanString(body.tshirt, 30)
      const school = cleanString(body.school, 120)
      const category = cleanString(body.category, 120)

      const guardianName = cleanString(body.guardianName, 120)
      const guardianPhone = cleanString(body.guardianPhone, 20)
      const guardianEmail = cleanString(body.guardianEmail, 120).toLowerCase()
      const relation = cleanString(body.relation, 50) || 'Parent'
      const medicalNotes = cleanString(body.medicalNotes, 2000)

      const consentParticipation = body.consentParticipation !== false
      const consentMedical = body.consentMedical !== false
      const consentPhotos = Boolean(body.consentPhotos)

      const paymentStatus = ['paid', 'unpaid', 'failed'].includes(
        body.paymentStatus,
      )
        ? body.paymentStatus
        : 'paid'

      const rawAmount = Number(body.paymentAmount ?? body.amount ?? 1250)
      const paymentAmount =
        Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0

      const paymentId = cleanString(body.paymentId || '', 100)

      const doc = await createWithUniqueReference(async (ref) => {
        return await Participant.create({
          reference: ref,
          childName,
          dob,
          gender,
          tshirt,
          school,
          category,
          guardianName,
          guardianPhone,
          guardianEmail,
          relation,
          medicalNotes,
          consentParticipation,
          consentMedical,
          consentPhotos,
          payment: {
            status: paymentStatus,
            amount: paymentAmount,
            paymentId,
            orderId: cleanString(body.orderId || '', 100),
            paidAt: paymentStatus === 'paid' ? new Date() : undefined,
          },
          isManual: true,
        })
      }, 'FKX')

      let finalDoc = doc
      if (paymentStatus === 'paid') {
        const bibResult = await assignBibToParticipant(doc._id, {
          ParticipantModel: Participant,
          allowReserved: true,
        })
        finalDoc = bibResult.participant
        sendParticipantConfirmationEmail({
          participant: finalDoc,
          bibNumber: bibResult.bibNumber,
          heat: bibResult.heat,
          course: bibResult.course,
        }).catch((err) =>
          console.error('[mailer] Failed to send admin participant email:', err),
        )
      }

      res.status(201).json({ ok: true, doc: finalDoc })
    } catch (err) {
      next(err)
    }
  })

  /** PATCH /api/admin/:collection/:id — update a document by _id, bibNumber, or reference. */
  app.patch(
    '/api/admin/:collection/:id',
    requireAuth,
    async (req, res, next) => {
      try {
        const Model = ADMIN_COLLECTIONS[req.params.collection]
        if (!Model)
          return res.status(404).json({ error: 'Unknown collection.' })

        let filter = { _id: req.params.id }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
          const bib = Number(req.params.id)
          if (Number.isFinite(bib) && bib >= 1000) {
            filter = { bibNumber: bib }
          } else {
            filter = { reference: req.params.id }
          }
        }

        let existing = null
        if (req.params.collection === 'participants') {
          existing = await Model.findOne(filter).lean()
        }

        const updates = { ...(req.body ?? {}) }
        delete updates._id
        delete updates.createdAt
        // Do not allow silently altering an assigned bib number
        delete updates.bibNumber

        if (updates.paymentStatus) {
          updates['payment.status'] = updates.paymentStatus
          delete updates.paymentStatus
        }

        const newPaymentStatus = updates['payment.status']
        const wasPaid = existing?.payment?.status === 'paid'
        const isBecomingPaid = newPaymentStatus === 'paid' && !wasPaid
        const isSettingPaid = newPaymentStatus === 'paid'

        if (updates.paymentAmount !== undefined) {
          if (req.params.collection === 'participants') {
            if (existing && !existing.isManual) {
              delete updates.paymentAmount
              delete updates['payment.amount']
            } else {
              const rawAmt = Number(updates.paymentAmount)
              updates['payment.amount'] =
                Number.isFinite(rawAmt) && rawAmt >= 0 ? rawAmt : 0
              delete updates.paymentAmount
            }
          } else {
            const rawAmt = Number(updates.paymentAmount)
            updates['payment.amount'] =
              Number.isFinite(rawAmt) && rawAmt >= 0 ? rawAmt : 0
            delete updates.paymentAmount
          }
        }
        if (updates['payment.status'] === 'paid' && !updates['payment.paidAt']) {
          updates['payment.paidAt'] = existing?.payment?.paidAt || new Date()
        }

        let doc = await Model.findOneAndUpdate(
          filter,
          { $set: updates },
          { new: true, runValidators: true },
        ).lean()

        if (!doc) return res.status(404).json({ error: 'Record not found.' })

        // If participant was marked paid, ensure bib is allocated and trigger allotment mail
        if (
          req.params.collection === 'participants' &&
          doc.payment?.status === 'paid'
        ) {
          if (!doc.bibNumber) {
            const bibResult = await assignBibToParticipant(doc._id, {
              ParticipantModel: Participant,
              allowReserved: true,
            })
            doc =
              (await Participant.findById(doc._id).lean()) ||
              bibResult.participant
          }

          if (isBecomingPaid || isSettingPaid) {
            sendParticipantConfirmationEmail({
              participant: doc,
              bibNumber: doc.bibNumber,
              heat: doc.heat,
              course: doc.course,
            }).catch((err) =>
              console.error(
                '[mailer] Failed to send participant confirmation email:',
                err,
              ),
            )
          }
        }

        res.json({ ok: true, doc })
      } catch (err) {
        next(err)
      }
    },
  )

  /** GET /api/participants/bib/:bibNumber — public/race day lookup by unique participant bib ID. */
  app.get('/api/participants/bib/:bibNumber', async (req, res, next) => {
    try {
      const bib = Number(req.params.bibNumber)
      if (!Number.isFinite(bib)) {
        return res.status(400).json({ error: 'Valid bib number required.' })
      }
      const doc = await Participant.findOne({ bibNumber: bib })
        .select(
          'bibNumber childName category heat course checkedIn checkedInAt school tshirt createdAt',
        )
        .lean()
      if (!doc) {
        return res
          .status(404)
          .json({ error: `Participant with bib #${bib} not found.` })
      }
      res.json({ ok: true, participant: doc })
    } catch (err) {
      next(err)
    }
  })

  /** POST /api/admin/participants/:id/check-in — check-in participant by bibNumber or ID. */
  app.post(
    '/api/admin/participants/:id/check-in',
    requireAuth,
    async (req, res, next) => {
      try {
        let filter = { _id: req.params.id }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
          const bib = Number(req.params.id)
          if (Number.isFinite(bib)) filter = { bibNumber: bib }
          else filter = { reference: req.params.id }
        }

        const checkedIn = req.body?.checkedIn !== false
        const doc = await Participant.findOneAndUpdate(
          filter,
          {
            $set: {
              checkedIn,
              checkedInAt: checkedIn ? new Date() : null,
            },
          },
          { new: true },
        ).lean()

        if (!doc)
          return res.status(404).json({ error: 'Participant not found.' })
        res.json({ ok: true, doc })
      } catch (err) {
        next(err)
      }
    },
  )



  // Anything under /api that no route matched. Placed here so a mounted SSR
  // handler later can own everything outside /api.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))

  // eslint-disable-next-line no-unused-vars -- express picks handlers by arity.
  app.use('/api', (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON.' })
    }
    if (err?.name === 'ValidationError') {
      // Field names are echoed through `fields`; the raw Mongoose sentence
      // stays out of the response so schema details aren't published.
      return res
        .status(422)
        .json({ error: 'Please check the highlighted fields.', fields: fieldErrors(err) })
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
    // Vite fingerprints everything under /assets — those get a year of
    // immutability. Everything else (robots.txt, sitemap, favicons, fonts.css)
    // stays on a short cache so SEO files can actually be updated.
    app.use(
      express.static(clientDir, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          }
        },
      }),
    )
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
