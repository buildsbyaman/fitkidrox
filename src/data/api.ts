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

export function submitParticipantInterest(data: ParticipantSubmission) {
  return post<{ reference: string }>('/api/participants', data)
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
