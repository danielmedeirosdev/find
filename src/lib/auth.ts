import { supabase } from './supabase'

export async function ensureAuthSession(email: string, password: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function ensureBarberShop(userId: string, shopName: string) {
  const { data: existing } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (existing) return existing

  const { error } = await supabase.from('shops').insert({
    owner_user_id: userId,
    name: shopName,
    subscription_status: 'trial',
  })

  if (error) throw error
}
