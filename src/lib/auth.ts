import { ensureUniqueSlug } from './media'
import { getSegment } from './segments'
import {
  defaultServicesForSegment,
  isOnlyBarbershopDefaultServices,
} from './defaultServices'
import { defaultSizeRules } from './pet'
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

/**
 * Seed legado — NÃO chamar no cadastro, login ou dashboard.
 * Lojas novas devem nascer vazias (0 serviços / profissionais / clientes).
 * Mantido apenas para ferramentas de heal pontuais; não altera lojas existentes sozinho.
 */
export async function seedDefaultServices(shopId: string, segment: ShopSegment) {
  const { data: existingServices } = await supabase
    .from('services')
    .select('id, name')
    .eq('shop_id', shopId)

  const existing = existingServices ?? []

  if (existing.length > 0) {
    const shouldReplaceMisSeededPet =
      segment === 'pet' && isOnlyBarbershopDefaultServices(existing)

    if (!shouldReplaceMisSeededPet) return

    const ids = existing.map((s) => s.id)
    await supabase.from('service_size_rules').delete().in('service_id', ids)
    await supabase.from('services').delete().eq('shop_id', shopId)
  }

  const defaults = defaultServicesForSegment(segment)
  if (defaults.length === 0) return

  if (segment === 'pet') {
    for (const svc of defaults) {
      const { data } = await supabase
        .from('services')
        .insert({ shop_id: shopId, ...svc })
        .select('id')
        .single()
      if (data) {
        await supabase
          .from('service_size_rules')
          .insert(defaultSizeRules(data.id, svc.duration_minutes, svc.price))
      }
    }
    return
  }

  await supabase.from('services').insert(
    defaults.map((svc) => ({ shop_id: shopId, ...svc }))
  )
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
