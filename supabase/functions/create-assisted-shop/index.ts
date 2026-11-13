import { executeAssisted } from './operations.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
const anon = Deno.env.get('SUPABASE_ANON_KEY')!
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const siteUrl = Deno.env.get('ONEFIND_SITE_URL') || 'https://www.onefind.com.br'
const previewUrl = 'https://find-git-feature-seguranca-conta-assistida-onefind.vercel.app'

Deno.serve(async req => {
  const origin = req.headers.get('origin') || ''
  const allowed = [siteUrl, 'https://onefind.com.br', previewUrl]
  const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : siteUrl, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }
  const respond = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return respond(405, { error: 'Método não permitido' })

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  if (!jwt) return respond(401, { error: 'Não autenticado' })
  const auth = createClient(url, anon)
  const { data: { user }, error: authError } = await auth.auth.getUser(jwt)
  if (authError || !user || user.app_metadata?.onefind_platform_admin !== true) return respond(403, { error: 'Sem permissão' })
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  try { return await executeAssisted(admin, await req.json(), respond, origin) } catch { return respond(400,{error:'Solicitação inválida'}) }
})
