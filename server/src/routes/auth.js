import { Router } from 'express'
import { createRateLimiter } from '../auth.js'
import { Participant } from '../models/Participant.js'
import { User } from '../models/User.js'
import {
  clearUserSessionCookie,
  createUserSession,
  destroyUserSession,
  getUserFromSession,
  setUserSessionCookie,
  userSessionTokenFrom,
  verifyGoogleToken,
} from '../user-auth.js'

export const authRouter = Router()

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 50,
  message: 'Too many sign-in attempts. Please try again later.',
})

/**
 * POST /api/auth/google
 * Validates Google ID token from GIS, upserts user, sets session cookie.
 */
authRouter.post('/google', loginLimiter, async (req, res, next) => {
  try {
    const { credential } = req.body ?? {}
    if (typeof credential !== 'string' || !credential.trim()) {
      return res.status(400).json({ error: 'Google credential token is required.' })
    }

    const profile = await verifyGoogleToken(credential.trim())

    // Upsert user in MongoDB
    const user = await User.findOneAndUpdate(
      { googleId: profile.googleId },
      {
        $set: {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        },
        $setOnInsert: {
          googleId: profile.googleId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    // Automatically link any existing registrations made by this guardian email
    const emailPattern = new RegExp(
      `^${user.email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i',
    )
    await Participant.updateMany(
      {
        $or: [{ guardianEmail: emailPattern }, { guardianEmail: user.email.trim().toLowerCase() }],
        userId: { $ne: user._id },
      },
      {
        $set: { userId: user._id },
      },
    ).catch((err) =>
      console.warn('[auth] Could not backfill participant records for user:', err),
    )

    // Create session token and set httpOnly cookie
    const token = await createUserSession(user._id)
    setUserSessionCookie(res, token)

    return res.json({
      ok: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    })
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message })
    }
    console.error('Google auth error:', err)
    next(err)
  }
})

/**
 * GET /api/auth/me
 * Returns current authenticated user or { ok: false, user: null }.
 */
authRouter.get('/me', async (req, res, next) => {
  try {
    const token = userSessionTokenFrom(req)
    if (!token) {
      return res.json({ ok: false, user: null })
    }

    const user = await getUserFromSession(token)
    if (!user) {
      return res.json({ ok: false, user: null })
    }

    return res.json({
      ok: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/auth/logout
 * Destroys session and clears cookie.
 */
authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = userSessionTokenFrom(req)
    if (token) {
      await destroyUserSession(token)
    }
    clearUserSessionCookie(res)
    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

