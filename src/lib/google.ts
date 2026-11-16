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

export type GoogleFailureStage = 'google_script_error' | 'google_script_timeout' | 'google_sdk_missing' | 'google_prepare' | 'google_auth'
export class GoogleLoadError extends Error {
  constructor(public readonly stage: GoogleFailureStage) { super('Não foi possível preparar o Google. Tente novamente ou use e-mail e senha.') }
}
let gsiLoading: Promise<void> | null = null

export function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (gsiLoading) return gsiLoading
  const attempt = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    const script = existing || document.createElement('script')
    let settled = false
    const finish = (stage?: GoogleFailureStage) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(poll)
      script.removeEventListener('load', loaded)
      script.removeEventListener('error', failed)
      if (stage) { script.remove(); reject(new GoogleLoadError(stage)) } else resolve()
    }
    const loaded = () => finish(window.google?.accounts?.id ? undefined : 'google_sdk_missing')
    const failed = () => finish('google_script_error')
    const timeout = setTimeout(() => finish('google_script_timeout'), 15000)
    // An existing script may already have emitted load before listeners were attached.
    const poll = setInterval(() => { if (window.google?.accounts?.id) finish() }, 100)
    script.addEventListener('load', loaded)
    script.addEventListener('error', failed)
    if (!existing) {
      script.src = GSI_SRC
      script.async = true
      document.head.appendChild(script)
    }
  })
  gsiLoading = attempt
  // Release the settled attempt for both success and failure, without an unhandled rejection.
  void attempt.then(() => { if (gsiLoading === attempt) gsiLoading = null }, () => { if (gsiLoading === attempt) gsiLoading = null })
  return attempt
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
