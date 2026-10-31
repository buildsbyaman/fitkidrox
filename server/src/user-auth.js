import { randomBytes } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import { parseCookies } from './auth.js'
import { User } from './models/User.js'
import { UserSession } from './models/UserSession.js'

export const USER_SESSION_COOKIE = 'user_session'
export const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const googleClient = new OAuth2Client()

function isSecure(req) {
  return req?.secure || process.env.NODE_ENV === 'production'
}

function cookieAttributes(name, value, maxAgeMs, req) {
  const parts = [
    `${name}=${value}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ]
  if (isSecure(req)) parts.push('Secure')
  return parts.join('; ')
}

export function setUserSessionCookie(res, token) {
  const cookieStr = cookieAttributes(
    USER_SESSION_COOKIE,
    token,
    USER_SESSION_TTL_MS,
    res.req,
  )
  res.append('Set-Cookie', cookieStr)
}

export function clearUserSessionCookie(res) {
  const cookieStr = cookieAttributes(USER_SESSION_COOKIE, '', 0, res.req)
  res.append('Set-Cookie', cookieStr)
}

export function userSessionTokenFrom(req) {
  return parseCookies(req.headers.cookie)[USER_SESSION_COOKIE]
}

export async function createUserSession(userId) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + USER_SESSION_TTL_MS)
  await UserSession.create({
    token,
    userId,
    expiresAt,
  })
  return token
}

export async function destroyUserSession(token) {
  if (token) {
    await UserSession.deleteOne({ token }).catch(() => null)
  }
}

export async function getUserFromSession(token) {
  if (!token) return null
  const session = await UserSession.findOne({
    token,
    expiresAt: { $gt: new Date() },
  }).populate('userId')

  if (!session || !session.userId) return null
  return session.userId
}

/**
 * Verify Google ID token received from Google Identity Services.
 */
export async function verifyGoogleToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    const error = new Error('Google Sign-In is not configured on the server. Please set GOOGLE_CLIENT_ID.')
    error.status = 503
    throw error
  }

  let ticket
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: clientId,
    })
  } catch (err) {
    const error = new Error('Invalid or expired Google token.')
    error.status = 401
    error.details = err.message
    throw error
  }

  const payload = ticket.getPayload()
  if (!payload) {
    const error = new Error('Empty Google token payload.')
    error.status = 401
    throw error
  }

  if (!payload.email_verified) {
    const error = new Error('Your Google email address is not verified.')
    error.status = 403
    throw error
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase().trim(),
    name: payload.name?.trim() || payload.email.split('@')[0],
    picture: payload.picture || '',
  }
}

/**
 * Middleware: require authenticated user session.
 * Rejects with 401 if unauthenticated.
 */
export async function requireUserAuth(req, res, next) {
  try {
    const token = userSessionTokenFrom(req)
    if (!token) {
      return res.status(401).json({
        error: 'Please sign in with Google to continue.',
      })
    }
    const user = await getUserFromSession(token)
    if (!user) {
      return res.status(401).json({
        error: 'Your session has expired. Please sign in with Google again.',
      })
    }
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Middleware: optional user session. Attaches req.user if session exists.
 */
export async function optionalUserAuth(req, res, next) {
  try {
    const token = userSessionTokenFrom(req)
    if (token) {
      req.user = await getUserFromSession(token)
    }
    next()
  } catch {
    next()
  }
}

