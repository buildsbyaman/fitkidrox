/**
 * Razorpay Standard Checkout — server-side helper.
 *
 * The key secret never leaves this module. The frontend only ever receives
 * RAZORPAY_KEY_ID through Vite's VITE_-prefixed env.
 */

import crypto from 'node:crypto'

import Razorpay from 'razorpay'

const KEY_ID = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

/** Smallest amount Razorpay accepts, in paise. */
export const MIN_AMOUNT_PAISE = 100

/**
 * The only source of truth for the entry fee. The browser still sends its
 * own figure so a stale bundle can be detected, but orders are always
 * created for this amount — changing the price means editing the env var.
 */
export const ENTRY_FEE_PAISE = Number(process.env.ENTRY_FEE_PAISE)

/** True once ENTRY_FEE_PAISE is a usable integer amount. */
export function feeConfigured() {
  return (
    Number.isInteger(ENTRY_FEE_PAISE) && ENTRY_FEE_PAISE >= MIN_AMOUNT_PAISE
  )
}

let client = null

/** Razorpay is only usable once both credentials are present. */
export function razorpayConfigured() {
  return Boolean(KEY_ID && KEY_SECRET)
}

/**
 * Lazily builds the SDK client so a missing .env surfaces as a clean 503 on
 * the route instead of crashing the server at import time.
 */
function razorpayClient() {
  if (!client) {
    client = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET })
  }
  return client
}

/**
 * Creates an order at Razorpay. Returns `{ id, amount, currency }`.
 *
 * The SDK rejects with a plain `{ statusCode, error }` object (not an Error),
 * so routes should read `err.statusCode`.
 */
export async function createOrder({ amountPaise, receipt }) {
  const order = await razorpayClient().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes: { reference: receipt },
  })
  return { id: order.id, amount: order.amount, currency: order.currency }
}

/**
 * HMAC-SHA256(order_id + "|" + payment_id) compared against the signature
 * Razorpay sent to the browser. Constant-time so a timing oracle can't tell
 * a near-miss from a miss.
 */
export function verifySignature({ orderId, paymentId, signature }) {
  if (typeof signature !== 'string' || signature.length === 0) return false

  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')

  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
