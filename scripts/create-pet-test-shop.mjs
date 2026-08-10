import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const email = `findpet_${Date.now()}@mailinator.com`
const password = 'PetShop1!'

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { role: 'barber', shop_name: 'Pet Shop Teste FIND', segment: 'pet' },
  },
})
if (error) {
  console.error('signup', error.message)
  process.exit(1)
}

const uid = data.user?.id
if (!uid) {
  console.error('no user — confirm email may be required')
  process.exit(1)
}

const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
if (loginErr) {
  console.error('login', loginErr.message)
  process.exit(1)
}

const trial = new Date()
trial.setDate(trial.getDate() + 30)
const slug = `pet-shop-teste-${Date.now()}`

const { data: existing } = await supabase.from('shops').select('*').eq('owner_user_id', uid).maybeSingle()
if (existing) {
  const { data: updated, error: ue } = await supabase
    .from('shops')
    .update({ segment: 'pet', name: 'Pet Shop Teste FIND' })
    .eq('id', existing.id)
    .select('*')
    .single()
  console.log('updated', ue?.message || updated?.segment, updated?.id)
} else {
  const { data: shop, error: se } = await supabase
    .from('shops')
    .insert({
      owner_user_id: uid,
      name: 'Pet Shop Teste FIND',
      segment: 'pet',
      subscription_status: 'trial',
      trial_ends_at: trial.toISOString(),
      slug,
    })
    .select('*')
    .single()
  console.log('created', se?.message || shop?.id, shop?.segment)
}

console.log(JSON.stringify({ email, password, uid }))
