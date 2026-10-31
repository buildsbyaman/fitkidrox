import { describe, it, expect, vi } from 'vitest'
// @ts-expect-error server code is plain JavaScript without d.ts
import { userSessionTokenFrom, setUserSessionCookie, clearUserSessionCookie, requireUserAuth } from '../../server/src/user-auth.js'

describe('Server User Auth Module', () => {
  it('correctly reads user_session token from cookies', () => {
    const req = {
      headers: {
        cookie: 'theme=dark; user_session=abc123token; other=1',
      },
    }
    expect(userSessionTokenFrom(req as unknown as Parameters<typeof userSessionTokenFrom>[0])).toBe('abc123token')
  })

  it('returns undefined when user_session is not in cookies', () => {
    const req = {
      headers: {
        cookie: 'theme=dark; admin_session=xyz',
      },
    }
    expect(userSessionTokenFrom(req as unknown as Parameters<typeof userSessionTokenFrom>[0])).toBeUndefined()
  })

  it('sets user_session cookie with HttpOnly, Path, and Max-Age', () => {
    const setHeaderMock = vi.fn()
    const appendMock = vi.fn()
    const res = {
      append: appendMock,
      setHeader: setHeaderMock,
      req: { secure: false },
    }

    setUserSessionCookie(res as unknown as Parameters<typeof setUserSessionCookie>[0], 'new_session_token')

    expect(appendMock).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('user_session=new_session_token'),
    )
    expect(appendMock).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('HttpOnly'),
    )
    expect(appendMock).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('Path=/'),
    )
  })

  it('clears user_session cookie with Max-Age=0', () => {
    const appendMock = vi.fn()
    const res = {
      append: appendMock,
      req: { secure: false },
    }

    clearUserSessionCookie(res as unknown as Parameters<typeof clearUserSessionCookie>[0])

    expect(appendMock).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('user_session=;'),
    )
    expect(appendMock).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('Max-Age=0'),
    )
  })

  it('requireUserAuth returns 401 when no session cookie is provided', async () => {
    const req = {
      headers: {},
    }
    const jsonMock = vi.fn()
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock })
    const res = {
      status: statusMock,
    }
    const nextMock = vi.fn()

    await requireUserAuth(
      req as unknown as Parameters<typeof requireUserAuth>[0],
      res as unknown as Parameters<typeof requireUserAuth>[1],
      nextMock,
    )

    expect(statusMock).toHaveBeenCalledWith(401)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('sign in with Google'),
      }),
    )
    expect(nextMock).not.toHaveBeenCalled()
  })
})
