/**
 * Validation helpers shared by the Mongoose schemas. The frontend enforces
 * the same rules for instant feedback; repeating them here keeps the stored
 * data trustworthy when something bypasses the UI.
 */

export const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/
// Deliberately stricter than \S+@\S+\.\S+: no consecutive/leading/trailing
// dots in the domain, no spaces or double @, and a letters-only TLD of 2+.
export const EMAIL_RE =
  /^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

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
