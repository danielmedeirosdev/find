import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

Deno.serve(async (req) => {
  const jsonHeaders = { 'Content-Type': 'application/json' }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const token = req.headers.get('x-heal-token') || ''
    const expected = Deno.env.get('HEAL_PET_SERVICES_TOKEN') || ''
    if (!expected || token !== expected) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const slug = typeof body.slug === 'string' ? body.slug : 'bark-mia'

    const { data: shop, error: shopErr } = await supabase
      .from('shops')
      .select('id, name, segment, slug')
      .eq('slug', slug)
      .maybeSingle()
    if (shopErr) throw shopErr
    if (!shop) {
      return new Response(JSON.stringify({ error: 'shop_not_found', slug }), {
        status: 404,
        headers: jsonHeaders,
      })
    }

    await supabase.from('shops').update({ segment: 'pet' }).eq('id', shop.id)

    const { data: services } = await supabase
      .from('services')
      .select('id, name')
      .eq('shop_id', shop.id)

    const barberNames = new Set(['Corte', 'Barba', 'Corte + Barba'])
    const bad = (services ?? []).filter((s) => barberNames.has(s.name))
    const good = (services ?? []).filter((s) => !barberNames.has(s.name))

    if (bad.length) {
      const ids = bad.map((s) => s.id)
      await supabase.from('service_size_rules').delete().in('service_id', ids)
      await supabase.from('booking_services').delete().in('service_id', ids)
      await supabase.from('services').delete().in('id', ids)
    }

    const needSeed =
      good.length === 0 ||
      !['Banho', 'Tosa', 'Banho + Tosa'].every((n) => good.some((s) => s.name === n))

    const inserted: string[] = []
    if (needSeed && good.length === 0) {
      const defaults = [
        { name: 'Banho', price: 50, duration_minutes: 60 },
        { name: 'Tosa', price: 60, duration_minutes: 90 },
        { name: 'Banho + Tosa', price: 100, duration_minutes: 120 },
      ]
      for (const svc of defaults) {
        const { data } = await supabase
          .from('services')
          .insert({ shop_id: shop.id, ...svc })
          .select('id, name')
          .single()
        if (data) {
          inserted.push(data.name)
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

    return new Response(
      JSON.stringify({
        ok: true,
        shop: { ...shop, segment: 'pet' },
        removed: bad.map((s) => s.name),
        inserted,
        services: after,
      }),
      { headers: jsonHeaders }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: jsonHeaders }
    )
  }
})
