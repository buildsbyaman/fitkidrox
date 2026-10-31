import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import {
  getCurrentUser,
  loginWithGoogleCredential,
  logoutUser,
  type AuthUser,
} from '@/data/api'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  loginWithCredential: (credential: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const current = await getCurrentUser()
      setUser(current)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    getCurrentUser()
      .then((current) => {
        if (mounted) {
          setUser(current)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const loginWithCredential = useCallback(async (credential: string) => {
    try {
      const loggedIn = await loginWithGoogleCredential(credential)
      setUser(loggedIn)
      toast.success(`Welcome, ${loggedIn.name}!`)
      return loggedIn
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Google sign-in failed. Please try again.'
      toast.error(message)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutUser()
      setUser(null)
      toast.info('You have been signed out.')
    } catch {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithCredential,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
