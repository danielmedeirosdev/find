/** Client ID público do Google (OAuth Web). Pode sobrescrever com VITE_GOOGLE_CLIENT_ID. */
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '546593931314-evts3lrsg77gu78sstitr4spk7tcgr69.apps.googleusercontent.com'

const GSI_SRC = 'https://accounts.google.com/gsi/client'

export type GoogleCredentialResponse = {
  credential: string
  select_by?: string
}

type GooglePromptNotification = {
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  isDismissedMoment: () => boolean
  getNotDisplayedReason?: () => string
  getSkippedReason?: () => string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          prompt: (listener?: (notification: GooglePromptNotification) => void) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
          cancel: () => void
        }
      }
    }
  }
}

let gsiLoading: Promise<void> | null = null

export function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (gsiLoading) return gsiLoading

  gsiLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o Google.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não foi possível carregar o Google.'))
    document.head.appendChild(script)
  })

  return gsiLoading
}

/** Retorna [nonce cru para Supabase, nonce hash para o Google]. */
export async function generateGoogleNonce(): Promise<[string, string]> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const nonce = btoa(String.fromCharCode(...bytes))
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return [nonce, hashedNonce]
}
