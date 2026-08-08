import { supabase, isSupabaseConfigured } from './supabase'
import { ensureBarberShop } from './auth'
import {
  GOOGLE_CLIENT_ID,
  generateGoogleNonce,
  loadGoogleIdentityServices,
  type GoogleCredentialResponse,
} from './google'

export type OAuthRole = 'client' | 'barber'

const ROLE_KEY = 'find_oauth_role'
const SHOP_NAME_KEY = 'find_oauth_shop_name'

export function rememberOAuthIntent(role: OAuthRole, shopName?: string) {
  sessionStorage.setItem(ROLE_KEY, role)
  if (shopName?.trim()) {
    sessionStorage.setItem(SHOP_NAME_KEY, shopName.trim())
  } else {
    sessionStorage.removeItem(SHOP_NAME_KEY)
  }
}

export function readOAuthIntent(fallbackRole: OAuthRole = 'client'): {
  role: OAuthRole
  shopName: string
} {
  const stored = sessionStorage.getItem(ROLE_KEY)
  const role: OAuthRole =
    stored === 'barber' || stored === 'client' ? stored : fallbackRole
  const shopName = sessionStorage.getItem(SHOP_NAME_KEY) || 'Minha Barbearia'
  return { role, shopName }
}

export function clearOAuthIntent() {
  sessionStorage.removeItem(ROLE_KEY)
  sessionStorage.removeItem(SHOP_NAME_KEY)
}

export function googleDisplayName(user: {
  email?: string | null
  user_metadata?: Record<string, unknown>
}): string {
  const meta = user.user_metadata ?? {}
  const candidates = [meta.full_name, meta.name, meta.preferred_username]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  if (user.email) return user.email.split('@')[0] || 'Cliente'
  return 'Cliente'
}

export async function ensureClientProfile(
  userId: string,
  name: string,
  phone?: string | null
) {
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existing) return existing

  const { error } = await supabase.from('clients').insert({
    id: userId,
    name: name.trim() || 'Cliente',
    phone: phone?.replace(/\D/g, '') || null,
  })

  if (error) throw error
}

export async function finalizeOAuthLogin(roleHint?: string | null) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) throw sessionError
  if (!session?.user) {
    throw new Error('Não foi possível concluir o login com Google. Tente novamente.')
  }

  const hintRole: OAuthRole =
    roleHint === 'barber' || roleHint === 'client' ? roleHint : 'client'
  const { role, shopName } = readOAuthIntent(hintRole)
  const user = session.user
  const displayName = googleDisplayName(user)

  await supabase.auth.updateUser({
    data: {
      role,
      name: displayName,
      ...(role === 'barber' ? { shop_name: shopName } : {}),
    },
  })

  if (role === 'barber') {
    await ensureBarberShop(user.id, shopName)
    clearOAuthIntent()
    return { role, redirectTo: '/painel/dashboard' as const }
  }

  await ensureClientProfile(user.id, displayName)
  clearOAuthIntent()
  return { role, redirectTo: '/minhas-reservas' as const }
}

/**
 * Login Google via Identity Services (popup / One Tap) + signInWithIdToken.
 * Só precisa de Authorized JavaScript origins no Google Cloud
 * (ex.: https://find-onefind.vercel.app) — sem redirect URI com caminho.
 */
export async function signInWithGoogle(role: OAuthRole, shopName?: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Configure o Supabase no arquivo .env antes de entrar com Google.')
  }
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Configure VITE_GOOGLE_CLIENT_ID para entrar com Google.')
  }

  rememberOAuthIntent(role, shopName)
  await loadGoogleIdentityServices()

  if (!window.google?.accounts?.id) {
    clearOAuthIntent()
    throw new Error('Google não carregou. Atualize a página e tente de novo.')
  }

  const [nonce, hashedNonce] = await generateGoogleNonce()

  return await new Promise<{ role: OAuthRole; redirectTo: '/painel/dashboard' | '/minhas-reservas' }>(
    (resolve, reject) => {
      let settled = false

      const fail = (err: unknown) => {
        if (settled) return
        settled = true
        clearOAuthIntent()
        window.google?.accounts.id.cancel()
        reject(err instanceof Error ? err : new Error('Falha no login com Google.'))
      }

      const succeed = async (response: GoogleCredentialResponse) => {
        if (settled) return
        try {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce,
          })
          if (error) throw error
          const result = await finalizeOAuthLogin(role)
          settled = true
          resolve(result)
        } catch (err) {
          fail(err)
        }
      }

      window.google!.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: succeed,
        nonce: hashedNonce,
        context: 'signin',
        ux_mode: 'popup',
        use_fedcm_for_prompt: true,
        auto_select: false,
      })

      window.google!.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback: botão oficial do Google em popup (também sem redirect URI de app)
          openGoogleButtonPopup(succeed, fail, hashedNonce)
        }
      })
    }
  )
}

function openGoogleButtonPopup(
  onCredential: (response: GoogleCredentialResponse) => void,
  onFail: (err: unknown) => void,
  hashedNonce: string
) {
  const overlay = document.createElement('div')
  overlay.setAttribute(
    'style',
    'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;'
  )

  const card = document.createElement('div')
  card.setAttribute(
    'style',
    'background:#fff;border-radius:12px;padding:20px;max-width:360px;width:100%;text-align:center;font-family:system-ui,sans-serif;'
  )
  card.innerHTML =
    '<p style="margin:0 0 12px;font-size:15px;color:#111">Escolha sua conta Google</p><div id="find-google-btn" style="display:flex;justify-content:center"></div><button type="button" id="find-google-cancel" style="margin-top:14px;background:none;border:none;color:#666;font-size:13px;cursor:pointer">Cancelar</button>'

  overlay.appendChild(card)
  document.body.appendChild(overlay)

  const cleanup = () => {
    overlay.remove()
  }

  card.querySelector('#find-google-cancel')?.addEventListener('click', () => {
    cleanup()
    onFail(new Error('Login com Google cancelado.'))
  })

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cleanup()
      onFail(new Error('Login com Google cancelado.'))
    }
  })

  const parent = card.querySelector<HTMLElement>('#find-google-btn')
  if (!parent || !window.google?.accounts?.id) {
    cleanup()
    onFail(new Error('Não foi possível abrir o login Google.'))
    return
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response: GoogleCredentialResponse) => {
      cleanup()
      onCredential(response)
    },
    nonce: hashedNonce,
    context: 'signin',
    ux_mode: 'popup',
    use_fedcm_for_prompt: true,
    auto_select: false,
  })

  window.google.accounts.id.renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: 320,
  })
}
