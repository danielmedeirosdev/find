import { ensureUniqueSlug } from './media'
import { getSegment } from './segments'
import { attachStoredReferral } from './referral'
import { supabase } from './supabase'
import type { ShopSegment } from './types'

export async function ensureAuthSession(email: string, password: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session) return session

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function ensureBarberShop(
  userId: string,
  shopName: string,
  segment: ShopSegment = 'barbershop'
) {
  const { data: existing } = await supabase
    .from('shops')
    .select('id, segment, name')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (existing) {
    // O segmento salvo é a identidade do negócio. Login por outra vitrine
    // jamais pode reclassificar uma conta existente.
    await attachStoredReferral()
    return { id: existing.id, created: false }
  }

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 30)
  const slug = await ensureUniqueSlug(shopName, undefined, segment)
  const meta = getSegment(segment)

  const { data: created, error } = await supabase
    .from('shops')
    .insert({
      owner_user_id: userId,
      name: shopName || meta.defaultShopName,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
      slug,
      segment,
    })
    .select('id')
    .single()

  if (error) throw error
  await attachStoredReferral()
  return { id: created.id, created: true }
}

/**
 * The signup trigger can create the shop before the browser reaches
 * ensureBarberShop. Use the auth timestamp to recognize that first signup
 * without treating an ordinary login as a registration.
 */
export function isLikelyNewAuthUser(
  user: { created_at?: string | null; identities?: unknown[] | null } | null | undefined,
  now = Date.now()
) {
  if (!user?.created_at) return false
  // Supabase returns an empty identities array for an already-registered
  // email when email enumeration protection is enabled.
  if (Array.isArray(user.identities) && user.identities.length === 0) return false
  const createdAt = Date.parse(user.created_at)
  if (!Number.isFinite(createdAt)) return false
  return Math.abs(now - createdAt) <= 5 * 60 * 1000
}
