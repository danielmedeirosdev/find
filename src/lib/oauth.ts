import { supabase, isSupabaseConfigured } from './supabase'
import { ensureBarberShop } from './auth'
import type { GoogleCredentialResponse } from './google'

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

/** Completa login a partir do credential (JWT) do botão oficial Google. */
export async function completeGoogleCredentialLogin(
  role: OAuthRole,
  response: GoogleCredentialResponse,
  nonce: string,
  shopName?: string
) {
  if (!isSupabaseConfigured) {
    throw new Error('Configure o Supabase no arquivo .env antes de entrar com Google.')
  }
  if (!response?.credential) {
    throw new Error('Google não retornou credencial. Tente novamente.')
  }

  rememberOAuthIntent(role, shopName)

  const attempt = async (withNonce: boolean) =>
    supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential,
      ...(withNonce ? { nonce } : {}),
    })

  let { error } = await attempt(Boolean(nonce))
  if (error && nonce && /nonce/i.test(error.message)) {
    ;({ error } = await attempt(false))
  }

  if (error) {
    clearOAuthIntent()
    if (/origin|redirect|audience|client|unauthorized/i.test(error.message)) {
      throw new Error('Não foi possível entrar com Google. Tente novamente em instantes.')
    }
    throw error
  }

  return finalizeOAuthLogin(role)
}
