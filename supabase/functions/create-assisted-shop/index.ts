import { createClient } from 'jsr:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
const anon = Deno.env.get('SUPABASE_ANON_KEY')!
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const adminId = Deno.env.get('ONEFIND_ADMIN_USER_ID')
const siteUrl = Deno.env.get('ONEFIND_SITE_URL') || 'https://www.onefind.com.br'

Deno.serve(async req => {
  const origin = req.headers.get('origin') || ''
  const allowed = [siteUrl, 'https://onefind.com.br']
  const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : siteUrl, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }
  const respond = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return respond(405, { error: 'Método não permitido' })
  if (!adminId) return respond(503, { error: 'Administrador não configurado' })
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  if (!jwt) return respond(401, { error: 'Não autenticado' })
  const auth = createClient(url, anon)
  const { data: { user }, error: authError } = await auth.auth.getUser(jwt)
  if (authError || !user || user.id !== adminId) return respond(403, { error: 'Sem permissão' })
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  try {
    const body = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.shopName === 'string' ? body.shopName.trim() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || name.length > 120) return respond(400, { error: 'Dados inválidos' })
    // Do not take over existing users; onboarding existing accounts requires separate consent flow.
    const { data: existing } = await admin.from('shops').select('id').eq('name', name).limit(1)
    if (existing?.length) return respond(409, { error: 'Nome de loja já utilizado. Verifique antes de continuar.' })
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { role: 'barber', shop_name: name, segment: 'pet' } })
    if (createError || !created.user) return respond(409, { error: 'Não foi possível criar usuário. Verifique se o e-mail já está cadastrado.' })
    const uid = created.user.id
    const { error: shopError } = await admin.from('shops').insert({ owner_user_id: uid, name, segment: 'pet', subscription_status: 'trial' })
    if (shopError) {
      await admin.auth.admin.deleteUser(uid)
      return respond(500, { error: 'Não foi possível preparar a loja.' })
    }
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: siteUrl + '/painel/seguranca' } })
    if (linkError || !link.properties?.action_link) return respond(500, { error: 'Loja criada, mas não foi possível gerar o convite.' })
    return respond(200, { actionLink: link.properties.action_link, shopName: name })
  } catch {
    return respond(400, { error: 'Solicitação inválida' })
  }
})
