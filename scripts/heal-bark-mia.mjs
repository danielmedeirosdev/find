/**
 * Aplica a cura da Bark & Mia (e demais PET mis-seeded) com service role.
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node --env-file=.env scripts/heal-bark-mia.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'

function loadEnv() {
  const file = existsSync('.env') ? '.env' : '.env.local'
  const parsed = existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l && !l.startsWith('#') && l.includes('='))
          .map((l) => {
            const i = l.indexOf('=')
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
          })
      )
    : {}
  return { ...parsed, ...process.env }
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const service = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !service) {
  console.error('Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, service)
const BARBER = new Set(['Corte', 'Barba', 'Corte + Barba'])

async function healShop(shop) {
  await supabase.from('shops').update({ segment: 'pet' }).eq('id', shop.id)
  const { data: services } = await supabase
    .from('services')
    .select('id, name')
    .eq('shop_id', shop.id)
  const bad = (services ?? []).filter((s) => BARBER.has(s.name))
  const good = (services ?? []).filter((s) => !BARBER.has(s.name))
  if (bad.length) {
    const ids = bad.map((s) => s.id)
    await supabase.from('service_size_rules').delete().in('service_id', ids)
    await supabase.from('booking_services').delete().in('service_id', ids)
    await supabase.from('services').delete().in('id', ids)
  }
  if (good.length === 0) {
    for (const svc of [
      { name: 'Banho', price: 50, duration_minutes: 60 },
      { name: 'Tosa', price: 60, duration_minutes: 90 },
      { name: 'Banho + Tosa', price: 100, duration_minutes: 120 },
    ]) {
      const { data } = await supabase
        .from('services')
        .insert({ shop_id: shop.id, ...svc })
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
  }
  const { data: after } = await supabase
    .from('services')
    .select('name, price')
    .eq('shop_id', shop.id)
    .order('name')
  return after
}

const { data: bark } = await supabase.from('shops').select('*').eq('slug', 'bark-mia').maybeSingle()
if (!bark) {
  console.error('bark-mia not found')
  process.exit(1)
}
console.log('before', bark.segment, (await supabase.from('services').select('name').eq('shop_id', bark.id)).data)
const after = await healShop(bark)
console.log('after', after)

// Also replace handle_new_user via raw SQL if possible
const sql = readFileSync('supabase/migrations/023_fix_pet_default_services.sql', 'utf8')
console.log('Migration file ready (' + sql.length + ' chars). Apply in SQL Editor if trigger still ignores segment.')
