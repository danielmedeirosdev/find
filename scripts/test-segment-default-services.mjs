/**
 * Testa criação de loja PET e Barber do zero + cura Bark & Mia (se logável).
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

const BARBER_DEFAULTS = new Set(['Corte', 'Barba', 'Corte + Barba'])
const PET_DEFAULTS = ['Banho', 'Tosa', 'Banho + Tosa', 'Hidratação']

async function seedDefaultServices(supabase, shopId, segment) {
  const { data: existingServices } = await supabase
    .from('services')
    .select('id, name')
    .eq('shop_id', shopId)
  const existing = existingServices ?? []

  if (existing.length > 0) {
    const onlyBarber = existing.every((s) => BARBER_DEFAULTS.has(s.name))
    if (!(segment === 'pet' && onlyBarber)) return { skipped: true, existing }
    const ids = existing.map((s) => s.id)
    await supabase.from('service_size_rules').delete().in('service_id', ids)
    await supabase.from('services').delete().eq('shop_id', shopId)
  }

  const defaults =
    segment === 'pet'
      ? [
          { name: 'Banho', price: 50, duration_minutes: 60 },
          { name: 'Tosa', price: 60, duration_minutes: 90 },
          { name: 'Banho + Tosa', price: 100, duration_minutes: 120 },
          { name: 'Hidratação', price: 40, duration_minutes: 40 },
        ]
      : [
          { name: 'Corte', price: 45, duration_minutes: 40 },
          { name: 'Barba', price: 30, duration_minutes: 25 },
          { name: 'Corte + Barba', price: 65, duration_minutes: 55 },
        ]

  if (segment === 'pet') {
    for (const svc of defaults) {
      const { data } = await supabase
        .from('services')
        .insert({ shop_id: shopId, ...svc })
        .select('id')
        .single()
      if (data) {
        await supabase.from('service_size_rules').insert([
          {
            service_id: data.id,
            size: 'pequeno',
            duration_minutes: Math.max(30, Math.round(svc.duration_minutes * 0.75)),
            price: svc.price,
          },
          {
            service_id: data.id,
            size: 'medio',
            duration_minutes: svc.duration_minutes,
            price: svc.price,
          },
          {
            service_id: data.id,
            size: 'grande',
            duration_minutes: Math.round(svc.duration_minutes * 1.5),
            price: Math.round(svc.price * 1.25 * 100) / 100,
          },
        ])
      }
    }
  } else {
    await supabase.from('services').insert(defaults.map((svc) => ({ shop_id: shopId, ...svc })))
  }
  return { seeded: true }
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
    await seedDefaultServices(supabase, existing.id, segment)
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
  await seedDefaultServices(supabase, created.id, segment)
  return created.id
}

async function createAndCheck(segment, shopName) {
  const supabase = createClient(url, anon)
  const email = `find_${segment}_${Date.now()}@mailinator.com`
  const password = 'TestShop1!a'
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
  const expected = segment === 'pet' ? PET_DEFAULTS : [...BARBER_DEFAULTS]
  const ok =
    shop.segment === segment &&
    expected.every((n) => names.includes(n)) &&
    (segment !== 'pet' || !names.some((n) => BARBER_DEFAULTS.has(n)))

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
  return { ok, email, password, shopId }
}

async function healBarkMia() {
  const supabase = createClient(url, anon)
  const { data: shop } = await supabase
    .from('shops')
    .select('id, segment, name, owner_user_id')
    .eq('slug', 'bark-mia')
    .maybeSingle()
  if (!shop) {
    console.log('bark-mia not found')
    return false
  }
  console.log('bark-mia before', shop)
  const { data: before } = await supabase.from('services').select('name,price').eq('shop_id', shop.id)
  console.log('services before', before)

  // Sem service role não dá pra curar como outro usuário; reporta SQL necessário.
  const needsHeal =
    shop.segment !== 'pet' ||
    (before ?? []).some((s) => BARBER_DEFAULTS.has(s.name))

  if (needsHeal) {
    console.log(
      'BARK_MIA_NEEDS_SQL_MIGRATION: rode supabase/migrations/023_fix_pet_default_services.sql no SQL Editor'
    )
  }
  return needsHeal
}

const pet = await createAndCheck('pet', 'Pet Shop Seed Test')
const barber = await createAndCheck('barbershop', 'Barbearia Seed Test')
const barkNeedsSql = await healBarkMia()

console.log(
  JSON.stringify(
    {
      petOk: pet.ok,
      barberOk: barber.ok,
      barkNeedsSql,
    },
    null,
    2
  )
)

if (!pet.ok || !barber.ok) process.exit(1)
