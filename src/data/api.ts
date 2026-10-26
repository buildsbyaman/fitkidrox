/**
 * Thin client for the FITKIDROX API (see /server).
 *
 * In dev the Vite proxy forwards /api to the local server, so no CORS setup
 * is needed. Set VITE_API_BASE to point at a deployed instance.
 */

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // fetch rejects on network failure — the server is likely not running.
    throw new ApiError('Could not reach the server.', 0)
  }

  const data = (await res.json().catch(() => null)) as { error?: string } | null

  if (!res.ok) {
    throw new ApiError(
      data?.error ?? 'The server rejected this submission.',
      res.status,
    )
  }

  return data as T
}

export interface ParticipantSubmission {
  childName: string
  dob: string
  gender: string
  category: string
  tshirt: string
  school: string
  guardianName: string
  guardianPhone: string
  guardianEmail: string
  relation: string
  medicalNotes: string
  consentParticipation: boolean
  consentMedical: boolean
  consentPhotos: boolean
}

export function submitParticipantRegistration(data: ParticipantSubmission) {
  return post<{ reference: string }>('/api/participants', data)
}

/** @deprecated Use submitParticipantRegistration. */
export const submitParticipantInterest = submitParticipantRegistration

export interface RazorpayOrder {
  order_id: string
  amount: number
  currency: string
  key_id?: string
}

/** Creates the Razorpay order the checkout modal opens against. */
export function createRazorpayOrder(amountPaise: number, receipt: string) {
  return post<RazorpayOrder>('/api/create-order', {
    amount: amountPaise,
    currency: 'INR',
    receipt,
  })
}

export interface VerifyPaymentPayload {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
  reference: string
}

export interface VerifyPaymentResponse {
  ok: true
  paymentId: string
  bibNumber?: number
  heat?: number
  course?: 'Course A' | 'Course B'
  courseCode?: 'A' | 'B'
  message?: string
}

/** Server-side HMAC check; resolves only when the signature matches. */
export function verifyRazorpayPayment(payload: VerifyPaymentPayload) {
  return post<VerifyPaymentResponse>('/api/verify-payment', payload)
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

/**
 * Injects Razorpay's checkout script exactly once. Resolves when
 * `window.Razorpay` is available, rejects if the CDN cannot be reached.
 */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Checkout only runs in the browser.'))
  }
  if (window.Razorpay) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const fail = () =>
      reject(new Error('Could not load the Razorpay checkout.'))

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT}"]`,
    )
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', fail)
      return
    }

    const script = document.createElement('script')
    script.src = CHECKOUT_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      fail()
    }
    document.body.appendChild(script)
  })
}

export interface SchoolRosterEntry {
  name: string
  dob: string
  gender: string
  tshirt: string
  category: string
}

export interface SchoolSubmission {
  schoolName: string
  city: string
  coordinator: string
  phone: string
  email: string
  participants: number
  roster?: SchoolRosterEntry[]
}

export function submitSchoolRoster(data: SchoolSubmission) {
  return post<{ reference: string }>('/api/schools', data)
}

export const submitSchoolEntry = submitSchoolRoster

export interface SponsorSubmission {
  company: string
  contact: string
  email: string
  phone: string
  packageId: string
  message: string
}

export function submitSponsorEnquiry(data: SponsorSubmission) {
  return post<{ reference: string }>('/api/sponsors', data)
}
