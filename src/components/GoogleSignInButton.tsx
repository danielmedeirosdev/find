import { useEffect, useRef, useState } from 'react'
import {
  GOOGLE_CLIENT_ID,
  generateGoogleNonce,
  loadGoogleIdentityServices,
  type GoogleCredentialResponse,
} from '../lib/google'
import { userFacingError } from '../lib/userFacingError'

type Tone = 'light' | 'dark'

interface GoogleSignInButtonProps {
  onCredential: (response: GoogleCredentialResponse, nonce: string) => void | Promise<void>
  onError?: (message: string) => void
  disabled?: boolean
  tone?: Tone
}

export function GoogleSignInButton({
  onCredential,
  onError,
  disabled = false,
  tone = 'light',
}: GoogleSignInButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const callbackRef = useRef(onCredential)
  const errorRef = useRef(onError)
  callbackRef.current = onCredential
  errorRef.current = onError

  useEffect(() => {
    let cancelled = false

    const mount = async () => {
      setLoading(true)
      try {
        await loadGoogleIdentityServices()
        if (cancelled || !hostRef.current || !window.google?.accounts?.id) {
          throw new Error('Não foi possível carregar o Google. Atualize a página e tente novamente.')
        }

        const [rawNonce, hashedNonce] = await generateGoogleNonce()
        hostRef.current.innerHTML = ''

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: GoogleCredentialResponse) => {
            try {
              await callbackRef.current(response, rawNonce)
            } catch (err) {
              const message = userFacingError(err, 'Não foi possível entrar com Google.')
              errorRef.current?.(message)
            }
          },
          nonce: hashedNonce,
          context: 'signin',
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: false,
        })

        window.google.accounts.id.renderButton(hostRef.current, {
          type: 'standard',
          theme: tone === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(hostRef.current.clientWidth || 320, 400),
          locale: 'pt-BR',
        })

        if (!cancelled) {
          setReady(true)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setLoading(false)
          errorRef.current?.(
            userFacingError(err, 'Não foi possível carregar o botão do Google. Atualize a página.')
          )
        }
      }
    }

    void mount()
    return () => {
      cancelled = true
      window.google?.accounts.id.cancel()
    }
  }, [tone])

  return (
    <div className="w-full">
      {loading && (
        <p
          className={
            tone === 'dark'
              ? 'text-center text-xs text-charcoal-muted mb-2'
              : 'text-center text-xs text-ink-muted mb-2'
          }
        >
          Conectando ao Google...
        </p>
      )}
      <div
        ref={hostRef}
        className={`flex w-full justify-center min-h-[44px] ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        aria-hidden={!ready}
      />
    </div>
  )
}

export function AuthDivider({ tone = 'light' }: { tone?: Tone }) {
  const line = tone === 'dark' ? 'border-charcoal-light' : 'border-paper-dark'
  const text = tone === 'dark' ? 'text-charcoal-muted' : 'text-ink-muted'

  return (
    <div className="flex items-center gap-3 my-4">
      <div className={`h-px flex-1 border-t ${line}`} />
      <span className={`text-xs uppercase tracking-wide ${text}`}>ou</span>
      <div className={`h-px flex-1 border-t ${line}`} />
    </div>
  )
}
