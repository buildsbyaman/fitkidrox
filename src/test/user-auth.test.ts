import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCurrentUser,
  loginWithGoogleCredential,
  logoutUser,
  type AuthUser,
} from '@/data/api'

describe('User Authentication API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('getCurrentUser returns null when not logged in (401 or ok: false)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, user: null }),
    } as Response)

    const user = await getCurrentUser()
    expect(user).toBeNull()
  })

  it('getCurrentUser returns user profile when session cookie is valid', async () => {
    const mockUser: AuthUser = {
      id: 'usr_123',
      email: 'parent@gmail.com',
      name: 'Rohan Sharma',
      picture: 'https://lh3.googleusercontent.com/photo.jpg',
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, user: mockUser }),
    } as Response)

    const user = await getCurrentUser()
    expect(user).toEqual(mockUser)
  })

  it('loginWithGoogleCredential posts token to /api/auth/google and returns user', async () => {
    const mockUser: AuthUser = {
      id: 'usr_123',
      email: 'parent@gmail.com',
      name: 'Rohan Sharma',
    }

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, user: mockUser }),
    } as Response)

    const user = await loginWithGoogleCredential('mock-google-id-token')
    expect(user).toEqual(mockUser)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/google'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ credential: 'mock-google-id-token' }),
      }),
    )
  })

  it('logoutUser calls /api/auth/logout with credentials included', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)

    await logoutUser()
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })

  it('getMyRegistrations fetches /api/participants/my and returns records', async () => {
    const mockRegistrations = [
      {
        _id: 'rec_1',
        reference: 'FKX-ABC123',
        childName: 'Aarav Sharma',
        category: 'Junior Champions',
        bibNumber: 1002,
        payment: { status: 'paid', amount: 1250 },
      },
    ]

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, registrations: mockRegistrations }),
    } as Response)

    const result = await (await import('@/data/api')).getMyRegistrations()
    expect(result).toEqual(mockRegistrations)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/participants/my'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })
})

