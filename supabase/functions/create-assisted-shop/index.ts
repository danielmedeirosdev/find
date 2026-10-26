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
  try {
    const body = await req.json()
    if (body.action === 'details') {
      const shopId = typeof body.shopId === 'string' ? body.shopId : ''
      if (!/^[0-9a-f-]{36}$/i.test(shopId)) return respond(400, {error:'Loja inválida'})
      const {data:shop,error:shopError}=await admin.from('shops').select('id,name,slogan,address,phone,pet_business_type,subscription_status,trial_ends_at,onboarding_completed,created_at,owner_user_id').eq('id',shopId).eq('segment','pet').maybeSingle()
      if(shopError || !shop) return respond(404,{error:'Loja não encontrada'})
      const [services,professionals]=await Promise.all([
        admin.from('services').select('id,name,price,duration_minutes').eq('shop_id',shopId).order('name'),
        admin.from('barbers').select('id,name,role').eq('shop_id',shopId).order('name')
      ])
      if(services.error || professionals.error)return respond(500,{error:'Não foi possível carregar a configuração'})
      const ids=(professionals.data||[]).map(p=>p.id)
      const schedules=ids.length ? await admin.from('barber_schedule').select('barber_id,day_of_week,start_time,end_time,is_active').in('barber_id',ids) : {data:[],error:null}
      if(schedules.error)return respond(500,{error:'Não foi possível carregar os horários'})
      const {data:owner}=await admin.auth.admin.getUserById(shop.owner_user_id)
      return respond(200,{shop:{...shop,owner_email:owner.user?.email||null},services:services.data||[],professionals:professionals.data||[],schedules:schedules.data||[]})
    }
    if (body.action === 'overview') {
      const {data,error}=await admin.from('shops').select('id,name,segment,onboarding_completed,subscription_status,trial_ends_at,created_at,owner_user_id').eq('segment','pet').order('created_at',{ascending:false}).limit(100)
      if(error)return respond(500,{error:'Não foi possível carregar estabelecimentos'})
      return respond(200,{shops:data||[]})
    }
    if (body.action === 'list') {
      const {data,error}=await admin.from('shops').select('id,name,owner_user_id').eq('onboarding_completed',false).eq('segment','pet').order('created_at',{ascending:false}).limit(50)
      if(error)return respond(500,{error:'Não foi possível listar lojas'})
      return respond(200,{shops:data||[]})
    }
    const action = body.action === 'finish' ? 'finish' : 'create'
    if (action === 'finish') {
      const shopId = typeof body.shopId === 'string' ? body.shopId : ''
      if (!/^[0-9a-f-]{36}$/i.test(shopId)) return respond(400, {error:'Loja inválida'})
      const {data:shop,error:shopError} = await admin.from('shops').select('id,owner_user_id,onboarding_completed').eq('id',shopId).maybeSingle()
      if (shopError || !shop || shop.onboarding_completed) return respond(409,{error:'Loja inexistente ou já configurada'})
      const profile = body.profile || {}
      const phone = String(profile.phone||'').replace(/\D/g,'')
      const services = body.services, staff = body.staff, days = body.days
      const start = body.start, end = body.end
      const types = ['grooming','veterinary_clinic','pet_shop','daycare_boarding','dog_walker','training','mixed','other']
      if (!types.includes(body.businessType) || typeof profile.slogan!=='string' || profile.slogan.trim().length<3 || profile.slogan.length>120 || typeof profile.address!=='string' || profile.address.trim().length<5 || profile.address.length>200 || phone.length<10 || phone.length>13 || !Array.isArray(services) || services.length<1 || services.length>30 || !Array.isArray(staff) || staff.length<1 || staff.length>20 || !Array.isArray(days) || days.length<1 || days.some((d:unknown)=>!Number.isInteger(d)||d<0||d>6) || typeof start!=='string' || typeof end!=='string' || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start>=end) return respond(400,{error:'Confira os dados da loja'})
      if (services.some((s:{name:string;price:number;duration_minutes:number;role:string|null})=>typeof s.name!=='string'||!s.name.trim()||s.name.length>100||typeof s.price!=='number'||!Number.isFinite(s.price)||s.price<0||!Number.isInteger(s.duration_minutes)||s.duration_minutes<5||s.duration_minutes>1440) || staff.some((s:{name:string;price:number;duration_minutes:number;role:string|null})=>typeof s.name!=='string'||!s.name.trim()||s.name.length>100|| (s.role!==null && (typeof s.role!=='string'||s.role.length>100)))) return respond(400,{error:'Revise os serviços e a equipe'})
      const {error:profileError}=await admin.from('shops').update({slogan:profile.slogan.trim(),address:profile.address.trim(),phone:profile.phone,pet_business_type:body.businessType,pet_onboarding_mode:'guided'}).eq('id',shopId).eq('onboarding_completed',false)
      if(profileError) return respond(500,{error:'Não foi possível salvar os dados da loja'})
      const {data:existingServices}=await admin.from('services').select('id,name').eq('shop_id',shopId)
      for(const s of services){if(existingServices?.some((x:{id:string;name:string})=>x.name.toLowerCase()===s.name.trim().toLowerCase()))continue;const {error}=await admin.from('services').insert({shop_id:shopId,name:s.name.trim(),price:s.price,duration_minutes:s.duration_minutes});if(error)return respond(500,{error:'Erro ao salvar serviços. Revise antes de tentar novamente.'})}
      const {data:existingStaff}=await admin.from('barbers').select('id,name').eq('shop_id',shopId)
      for(const person of staff){let id=existingStaff?.find((x:{id:string;name:string})=>x.name.toLowerCase()===person.name.trim().toLowerCase())?.id; if(!id){const {data:created,error}=await admin.from('barbers').insert({shop_id:shopId,name:person.name.trim(),role:person.role||null}).select('id').single();if(error||!created)return respond(500,{error:'Erro ao salvar equipe'});id=created.id}for(const day of days){const {error}=await admin.from('barber_schedule').upsert({barber_id:id,day_of_week:day,is_active:true,start_time:start,end_time:end},{onConflict:'barber_id,day_of_week'});if(error)return respond(500,{error:'Erro ao salvar horários'})}}
      const {data:owner,error:ownerError}=await admin.auth.admin.getUserById(shop.owner_user_id)
      if(ownerError || !owner.user?.email)return respond(500,{error:'Não foi possível encontrar o responsável'})
      const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:'recovery',email:owner.user.email,options:{redirectTo:siteUrl+'/painel/seguranca'}})
      const tokenHash=link?.properties?.hashed_token
      if(linkError||!tokenHash)return respond(500,{error:'Configuração salva, mas o convite não foi gerado'})
      const {error:completedError}=await admin.from('shops').update({onboarding_completed:true}).eq('id',shopId)
      if(completedError)return respond(500,{error:'Convite gerado, mas não foi possível concluir a preparação'})
      return respond(200,{actionLink:siteUrl+'/ativar?token_hash='+encodeURIComponent(tokenHash)})
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.shopName === 'string' ? body.shopName.trim() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || name.length > 120) return respond(400, { error: 'Dados inválidos' })
    // Do not take over existing users; onboarding existing accounts requires separate consent flow.
    const { data: existing } = await admin.from('shops').select('id').eq('name', name).limit(1)
    if (existing?.length) return respond(409, { error: 'Nome de loja já utilizado. Verifique antes de continuar.' })
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { role: 'barber', shop_name: name, segment: 'pet' } })
    if (createError || !created.user) return respond(409, { error: 'Não foi possível criar usuário. Verifique se o e-mail já está cadastrado.' })
    const uid = created.user.id
    // The existing auth.users trigger creates the shop and 30-day trial.
    const { data: shop, error: shopError } = await admin.from('shops').select('id').eq('owner_user_id', uid).maybeSingle()
    if (shopError || !shop) return respond(500, { error: 'A conta foi criada, mas não foi possível confirmar a loja. Verifique o cadastro antes de tentar novamente.' })
    if (body.action === 'create') return respond(200, { shopId: shop.id })
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: siteUrl + '/painel/seguranca' } })
    const tokenHash = link?.properties?.hashed_token
    if (linkError || !tokenHash) return respond(500, { error: 'Loja criada, mas não foi possível gerar o convite.' })
    const activationOrigin = origin === previewUrl ? previewUrl : siteUrl
    const actionLink = activationOrigin + '/ativar?token_hash=' + encodeURIComponent(tokenHash)
    return respond(200, { actionLink, shopName: name })
  } catch {
    return respond(400, { error: 'Solicitação inválida' })
  }
})
