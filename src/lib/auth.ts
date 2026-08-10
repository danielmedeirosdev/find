import { ensureUniqueSlug } from './media'
import { getSegment } from './segments'
import { defaultSizeRules } from './pet'
import { supabase } from './supabase'
import type { ShopSegment } from './types'

export async function ensureAuthSession(email: string, password: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

async function seedDefaultServices(shopId: string, segment: ShopSegment) {
  const { count } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)

  if ((count ?? 0) > 0) return

  if (segment === 'pet') {
    const defaults = [
      { name: 'Banho', price: 60, duration_minutes: 60 },
      { name: 'Tosa', price: 80, duration_minutes: 90 },
      { name: 'Banho + Tosa', price: 120, duration_minutes: 120 },
      { name: 'Tosa higiênica', price: 50, duration_minutes: 45 },
      { name: 'Hidratação', price: 40, duration_minutes: 40 },
      { name: 'Corte de unhas', price: 25, duration_minutes: 20 },
    ]
    for (const svc of defaults) {
      const { data } = await supabase
        .from('services')
        .insert({ shop_id: shopId, ...svc })
        .select('id')
        .single()
      if (data) {
        await supabase.from('service_size_rules').insert(
          defaultSizeRules(data.id, svc.duration_minutes, svc.price)
        )
      }
    }
    return
  }

  await supabase.from('services').insert([
    { shop_id: shopId, name: 'Corte', price: 45, duration_minutes: 40 },
    { shop_id: shopId, name: 'Barba', price: 30, duration_minutes: 25 },
    { shop_id: shopId, name: 'Corte + Barba', price: 65, duration_minutes: 55 },
  ])
}

export async function ensureBarberShop(
  userId: string,
  shopName: string,
  segment: ShopSegment = 'barbershop'
) {
  const { data: existing } = await supabase
    .from('shops')
    .select('id, segment')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (existing) {
    if (!existing.segment && segment) {
      await supabase.from('shops').update({ segment }).eq('id', existing.id)
    }
    await seedDefaultServices(existing.id, (existing.segment as ShopSegment) || segment)
    return existing
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
  if (created) await seedDefaultServices(created.id, segment)
  return created
}
