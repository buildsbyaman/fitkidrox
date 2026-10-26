import { randomInt } from 'node:crypto'

/**
 * Human-readable confirmation numbers, e.g. "FKX-26-48213".
 * Generated using cryptographically secure random integers to prevent enumeration.
 * These are stored with a unique index, so a collision is retried rather
 * than surfaced to the caller.
 */
export function makeReference(prefix) {
  const n = randomInt(10000, 100000)
  return `${prefix}-26-${n}`
}

/**
 * Calls `create()` until it either succeeds or fails for a reason other than
 * a duplicate reference number.
 */
export async function createWithUniqueReference(create, prefix) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await create(makeReference(prefix))
    } catch (err) {
      const duplicate = err?.code === 11000 || err?.code === 11001
      if (!duplicate) throw err
    }
  }
  throw new Error('Could not allocate a unique reference number.')
}
