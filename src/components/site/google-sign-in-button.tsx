import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { GoogleIcon } from './google-icon'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon'
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              logo_alignment?: 'left' | 'center'
              width?: number | string
              locale?: string
            },
          ) => void
          prompt: () => void
        }
      }
    }
  }
}

interface GoogleSignInButtonProps {
  onSuccess?: () => void
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  className?: string
}

export function GoogleSignInButton({
  onSuccess,
  text = 'continue_with',
  theme = 'outline',
  className,
}: GoogleSignInButtonProps) {
  const { loginWithCredential } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [scriptLoaded, setScriptLoaded] = useState(
    () => typeof window !== 'undefined' && Boolean(window.google?.accounts?.id),
  )

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  // Wait for Google Identity Services script if not yet ready
  useEffect(() => {
    if (typeof window === 'undefined' || window.google?.accounts?.id) return

    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        setScriptLoaded(true)
        clearInterval(checkInterval)
      }
    }, 200)

    const timer = setTimeout(() => clearInterval(checkInterval), 10000)

    return () => {
      clearInterval(checkInterval)
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!scriptLoaded || !buttonRef.current || !clientId) return

    try {
      window.google!.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) return
          setLoading(true)
          try {
            await loginWithCredential(response.credential)
            onSuccess?.()
          } finally {
            setLoading(false)
          }
        },
      })

      buttonRef.current.innerHTML = ''
      window.google!.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme,
        size: 'large',
        text,
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 280,
      })
    } catch (err) {
      console.error('Error rendering Google button:', err)
    }
  }, [scriptLoaded, clientId, theme, text, loginWithCredential, onSuccess])

  if (!clientId) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/10 p-4 text-center text-xs text-amber-800 dark:text-amber-200">
        <div className="flex items-center gap-2 font-semibold">
          <GoogleIcon className="size-4" />
          <span>Google Sign-In Configuration Required</span>
        </div>
        <p className="max-w-xs text-muted-foreground">
          Please add <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">VITE_GOOGLE_CLIENT_ID</code> to your{' '}
          <code className="font-mono text-[11px]">.env</code> file.
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      {loading ? (
        <div className="flex h-11 w-[280px] items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium text-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Signing you in...</span>
        </div>
      ) : (
        <div ref={buttonRef} className="min-h-[44px] min-w-[280px]" />
      )}
    </div>
  )
}
