/**
 * Validation helpers shared by the Mongoose schemas. The frontend enforces
 * the same rules for instant feedback; repeating them here keeps the stored
 * data trustworthy when something bypasses the UI.
 */

export const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/
export const EMAIL_RE = /^\S+@\S+\.\S+$/

export function isPhone(value) {
  return typeof value === 'string' && PHONE_RE.test(value.replace(/\s/g, ''))
}

export function isEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value)
}

export function trimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Checks that `value` is an ISO date (YYYY-MM-DD) that parses.
 */
export function isDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
