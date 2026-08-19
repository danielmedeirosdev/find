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
    // Sempre prioriza o segmento do fluxo de cadastro/login (o trigger às vezes
    // cria a loja como barbershop mesmo com metadata pet).
    if (existing.segment !== segment) {
      const { error } = await supabase
        .from('shops')
        .update({ segment })
        .eq('id', existing.id)
      if (error) throw error
    }
    await attachStoredReferral()
    return { id: existing.id }
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
  return created
}
