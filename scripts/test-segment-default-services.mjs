/**
 * Confirma que loja PET e barbearia novas nascem sem serviços.
 * Uso: node --env-file=.env scripts/test-segment-default-services.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'

function loadEnv() {
  const file = existsSync('.env') ? '.env' : '.env.local'
  if (!existsSync(file)) return process.env
  const parsed = Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
  return { ...parsed, ...process.env }
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY
if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}
if (
  !/localhost|127\.0\.0\.1/.test(url) &&
  env.ALLOW_LIVE_SECURITY_TESTS !== '1'
) {
  console.error(
    'Refusing to create test accounts on a remote Supabase project. ' +
      'Use a local project or set ALLOW_LIVE_SECURITY_TESTS=1 explicitly.'
  )
  process.exit(1)
}

async function ensureShop(supabase, userId, shopName, segment) {
  const { data: existing } = await supabase
    .from('shops')
    .select('id, segment, name')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (existing) {
    if (existing.segment !== segment) {
      const { error } = await supabase.from('shops').update({ segment }).eq('id', existing.id)
      if (error) throw error
    }
    return existing.id
  }

  const trial = new Date()
  trial.setDate(trial.getDate() + 30)
  const slug = `${segment}-${Date.now()}`
  const { data: created, error } = await supabase
    .from('shops')
    .insert({
      owner_user_id: userId,
      name: shopName,
      subscription_status: 'trial',
      trial_ends_at: trial.toISOString(),
      slug,
      segment,
    })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

async function createAndCheck(segment, shopName) {
  const supabase = createClient(url, anon)
  const email = `find_${segment}_${Date.now()}@onefind.invalid`
  const password = `T9!${crypto.randomUUID()}`
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: 'barber', shop_name: shopName, segment } },
  })
  if (error) throw error
  if (!data.user) throw new Error('no user')
  await supabase.auth.signInWithPassword({ email, password })

  const shopId = await ensureShop(supabase, data.user.id, shopName, segment)
  const { data: shop } = await supabase.from('shops').select('id,segment,name').eq('id', shopId).single()
  const { data: services } = await supabase
    .from('services')
    .select('name,price')
    .eq('shop_id', shopId)
    .order('name')

  const names = (services ?? []).map((s) => s.name)
  const ok = shop.segment === segment && names.length === 0

  console.log(
    JSON.stringify(
      {
        segment,
        email,
        shop,
        services,
        ok,
      },
      null,
      2
    )
  )
  if (!ok) process.exitCode = 1
  return { ok, email, shopId }
}

const pet = await createAndCheck('pet', 'Pet Shop Empty Catalog Test')
const barber = await createAndCheck('barbershop', 'Barbearia Empty Catalog Test')

console.log(
  JSON.stringify(
    {
      petOk: pet.ok,
      barberOk: barber.ok,
    },
    null,
    2
  )
)

if (!pet.ok || !barber.ok) process.exit(1)
