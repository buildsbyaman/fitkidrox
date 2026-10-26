/**
 * Minimal typings for Razorpay Standard Checkout
 * (https://checkout.razorpay.com/v1/checkout.js).
 *
 * Global script file — no top-level import/export so the declarations merge
 * with the DOM lib's `Window`.
 */

interface RazorpayHandlerResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayFailureResponse {
  error?: {
    code?: string
    description?: string
    source?: string
    step?: string
    reason?: string
  }
}

interface RazorpayCheckoutOptions {
  /** Public key only — the secret never reaches the browser. */
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  order_id: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  theme?: {
    color?: string
    backdrop_color?: string
  }
  handler: (response: RazorpayHandlerResponse) => void
  modal?: {
    ondismiss?: () => void
    confirm_close?: boolean
    escape?: boolean
  }
}

interface RazorpayCheckout {
  open(): void
  on(
    event: 'payment.failed',
    callback: (response: RazorpayFailureResponse) => void,
  ): void
  on(
    event: 'payment.captured' | 'payment.authorized',
    callback: (response: RazorpayHandlerResponse) => void,
  ): void
}

interface Window {
  Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayCheckout
}
