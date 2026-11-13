/* eslint-disable @typescript-eslint/no-explicit-any -- Existing admin operation payloads; ingress is validated separately. */
import { createClient } from 'jsr:@supabase/supabase-js@2'
const siteUrl = Deno.env.get('ONEFIND_SITE_URL') || 'https://www.onefind.com.br'
const previewUrl = 'https://find-git-feature-seguranca-conta-assistida-onefind.vercel.app'
export async function executeAssisted(admin: ReturnType<typeof createClient>, body: any, respond: (status:number,data:unknown)=>Response, origin='') {
    if (body.action === 'details_full') {
      const shopId = typeof body.shopId === 'string' ? body.shopId : ''
      if (!/^[0-9a-f-]{36}$/i.test(shopId)) return respond(400,{error:'Loja inválida'})
      const {data:shop,error:shopError}=await admin.from('shops').select('id,name,slogan,address,phone,hours_text,description,logo_url,slug,pet_business_type,subscription_status,trial_ends_at,onboarding_completed,created_at,owner_user_id').eq('id',shopId).eq('segment','pet').maybeSingle()
      if(shopError || !shop) return respond(404,{error:'Loja não encontrada'})
      const [servicesRes,professionalsRes,packagesRes,photosRes,closuresRes]=await Promise.all([
        admin.from('services').select('id,name,price,duration_minutes,is_active').eq('shop_id',shopId).order('name'),
        admin.from('barbers').select('id,name,role,specialty,commission_percent,photo_url').eq('shop_id',shopId).order('name'),
        admin.from('service_packages').select('id,name,description,total_sessions,price,validity_days,active').eq('shop_id',shopId).order('name'),
        admin.from('shop_photos').select('id,url,sort_order').eq('shop_id',shopId).order('sort_order'),
        admin.from('shop_closures').select('id,starts_on,ends_on,label').eq('shop_id',shopId).order('starts_on')
      ])
      if(servicesRes.error||professionalsRes.error||packagesRes.error||photosRes.error||closuresRes.error)return respond(500,{error:'Não foi possível carregar a configuração completa'})
      const serviceIds=(servicesRes.data||[]).map((x:any)=>x.id)
      const barberIds=(professionalsRes.data||[]).map((x:any)=>x.id)
      const [transportRes,schedulesRes]=await Promise.all([
        serviceIds.length ? admin.from('service_pet_transport').select('service_id,enabled,fee,pricing_mode').in('service_id',serviceIds) : Promise.resolve({data:[],error:null}),
        barberIds.length ? admin.from('barber_schedule').select('barber_id,day_of_week,start_time,end_time,is_active').in('barber_id',barberIds) : Promise.resolve({data:[],error:null})
      ])
      if(transportRes.error||schedulesRes.error)return respond(500,{error:'Não foi possível carregar horários e transporte'})
      const {data:owner}=await admin.auth.admin.getUserById(shop.owner_user_id)
      return respond(200,{
        shop:{...shop,owner_email:owner.user?.email||null},
        services:(servicesRes.data||[]).map((s:any)=>({...s,transport:(transportRes.data||[]).find((t:any)=>t.service_id===s.id)||null})),
        professionals:(professionalsRes.data||[]).map((p:any)=>({...p,schedules:(schedulesRes.data||[]).filter((x:any)=>x.barber_id===p.id)})),
        packages:packagesRes.data||[],
        photos:photosRes.data||[],
        closures:closuresRes.data||[]
      })
    }

    if (body.action === 'media_upload_url') {
      const shopId = typeof body.shopId === 'string' ? body.shopId : ''
      const folder = body.folder
      if (!/^[0-9a-f-]{36}$/i.test(shopId) || !['logo','gallery','barbers'].includes(folder)) return respond(400,{error:'Destino de mídia inválido'})
      const ext = ['jpg','jpeg','png','webp'].includes(String(body.ext||'').toLowerCase()) ? String(body.ext).toLowerCase().replace('jpeg','jpg') : 'jpg'
      const barberId = typeof body.barberId === 'string' && /^[0-9a-f-]{36}$/i.test(body.barberId) ? body.barberId : null
      const path = folder === 'barbers' && barberId
        ? shopId+'/'+folder+'/'+barberId+'/'+crypto.randomUUID()+'.'+ext
        : shopId+'/'+folder+'/'+crypto.randomUUID()+'.'+ext
      const {data,error}=await admin.storage.from('shop-media').createSignedUploadUrl(path)
      if(error || !data?.token)return respond(500,{error:'Não foi possível preparar o upload'})
      const publicUrl=admin.storage.from('shop-media').getPublicUrl(path).data.publicUrl
      return respond(200,{path,token:data.token,publicUrl})
    }

    if (body.action === 'save_full') {
      const shopId = typeof body.shopId === 'string' ? body.shopId : ''
      if (!/^[0-9a-f-]{36}$/i.test(shopId)) return respond(400,{error:'Loja inválida'})
      const profile = body.profile || {}
      const types = ['grooming','veterinary_clinic','pet_shop','daycare_boarding','dog_walker','training','mixed','other']
      if(!types.includes(body.businessType)) return respond(400,{error:'Selecione o ramo'})
      const shopPatch:any = {
        name:String(profile.name||'').trim(),
        slogan:String(profile.slogan||'').trim()||null,
        address:String(profile.address||'').trim()||null,
        phone:String(profile.phone||'').trim()||null,
        hours_text:String(profile.hours_text||'').trim()||null,
        description:String(profile.description||'').trim()||null,
        logo_url:String(profile.logo_url||'').trim()||null,
        pet_business_type:body.businessType,
        pet_onboarding_mode:'guided'
      }
      if(shopPatch.name.length<2||shopPatch.name.length>120)return respond(400,{error:'Nome da loja inválido'})
      if(profile.slug!==undefined){
        const slug=String(profile.slug||'').trim().toLowerCase()
        if(slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return respond(400,{error:'Link público inválido'})
        shopPatch.slug=slug||null
      }
      const {error:shopUpdateError}=await admin.from('shops').update(shopPatch).eq('id',shopId).eq('segment','pet')
      if(shopUpdateError)return respond(500,{error:'Não foi possível salvar a loja'})

      const incomingServices=Array.isArray(body.services)?body.services:[]
      const {data:existingServices}=await admin.from('services').select('id').eq('shop_id',shopId)
      const keepServiceIds:string[]=[]
      for(const s of incomingServices){
        const name=String(s.name||'').trim(); const price=Number(s.price); const duration=Number(s.duration_minutes)
        if(!name||!Number.isFinite(price)||price<0||!Number.isInteger(duration)||duration<5||duration>1440)return respond(400,{error:'Revise os serviços'})
        let serviceId=typeof s.id==='string'&&/^[0-9a-f-]{36}$/i.test(s.id)?s.id:null
        if(serviceId){
          const {error}=await admin.from('services').update({name,price,duration_minutes:duration,is_active:s.is_active!==false}).eq('id',serviceId).eq('shop_id',shopId)
          if(error)return respond(500,{error:'Erro ao atualizar serviço'})
        }else{
          const {data:created,error}=await admin.from('services').insert({shop_id:shopId,name,price,duration_minutes:duration,is_active:s.is_active!==false}).select('id').single()
          if(error||!created)return respond(500,{error:'Erro ao criar serviço'})
          serviceId=created.id
        }
        keepServiceIds.push(serviceId)
        const tr=s.transport||{}
        const enabled=tr.enabled===true
        const pricingMode=tr.pricing_mode==='quote'?'quote':'fixed'
        const fee=Number(tr.fee||0)
        const {error:trError}=await admin.from('service_pet_transport').upsert({service_id:serviceId,shop_id:shopId,enabled,fee:Number.isFinite(fee)&&fee>=0?fee:0,pricing_mode:pricingMode},{onConflict:'service_id'})
        if(trError)return respond(500,{error:'Erro ao salvar táxi dog'})
      }
      const removeServiceIds=(existingServices||[]).map((x:any)=>x.id).filter((id:string)=>!keepServiceIds.includes(id))
      if(removeServiceIds.length) await admin.from('services').update({is_active:false}).in('id',removeServiceIds).eq('shop_id',shopId)

      const incomingStaff=Array.isArray(body.staff)?body.staff:[]
      for(const person of incomingStaff){
        const name=String(person.name||'').trim()
        if(!name)return respond(400,{error:'Revise a equipe'})
        let id=typeof person.id==='string'&&/^[0-9a-f-]{36}$/i.test(person.id)?person.id:null
        const payload:any={shop_id:shopId,name,role:String(person.role||'').trim()||null,specialty:String(person.specialty||'').trim()||null,photo_url:String(person.photo_url||'').trim()||null}
        const cp=person.commission_percent
        payload.commission_percent=cp===null||cp===''||cp===undefined?null:Number(cp)
        if(payload.commission_percent!==null&&(!Number.isFinite(payload.commission_percent)||payload.commission_percent<0||payload.commission_percent>100))return respond(400,{error:'Comissão inválida'})
        if(id){
          const {error}=await admin.from('barbers').update(payload).eq('id',id).eq('shop_id',shopId); if(error)return respond(500,{error:'Erro ao atualizar equipe'})
        }else{
          const {data:created,error}=await admin.from('barbers').insert(payload).select('id').single(); if(error||!created)return respond(500,{error:'Erro ao criar profissional'}); id=created.id
        }
        const schedules=Array.isArray(person.schedules)?person.schedules:[]
        for(let day=0;day<=6;day++){
          const row=schedules.find((x:any)=>Number(x.day_of_week)===day)
          const start=row?.start_time||'09:00'; const end=row?.end_time||'18:00'; const active=row?.is_active===true
          const {error}=await admin.from('barber_schedule').upsert({barber_id:id,day_of_week:day,is_active:active,start_time:start,end_time:end},{onConflict:'barber_id,day_of_week'})
          if(error)return respond(500,{error:'Erro ao salvar horários da equipe'})
        }
      }

      const incomingPackages=Array.isArray(body.packages)?body.packages:[]
      const {data:existingPackages}=await admin.from('service_packages').select('id').eq('shop_id',shopId)
      const keepPackageIds:string[]=[]
      for(const p of incomingPackages){
        const name=String(p.name||'').trim(); const sessions=Number(p.total_sessions); const price=Number(p.price); const validity=p.validity_days===null||p.validity_days===''?null:Number(p.validity_days)
        if(!name||!Number.isInteger(sessions)||sessions<1||!Number.isFinite(price)||price<0|| (validity!==null&&(!Number.isInteger(validity)||validity<1)))return respond(400,{error:'Revise os pacotes'})
        let id=typeof p.id==='string'&&/^[0-9a-f-]{36}$/i.test(p.id)?p.id:null
        const payload={shop_id:shopId,name,description:String(p.description||'').trim()||null,total_sessions:sessions,price,validity_days:validity,active:p.active!==false}
        if(id){const {error}=await admin.from('service_packages').update(payload).eq('id',id).eq('shop_id',shopId);if(error)return respond(500,{error:'Erro ao atualizar pacote'})}
        else{const {data:created,error}=await admin.from('service_packages').insert(payload).select('id').single();if(error||!created)return respond(500,{error:'Erro ao criar pacote'});id=created.id}
        keepPackageIds.push(id)
      }
      const removePackageIds=(existingPackages||[]).map((x:any)=>x.id).filter((id:string)=>!keepPackageIds.includes(id))
      if(removePackageIds.length) await admin.from('service_packages').update({active:false}).in('id',removePackageIds).eq('shop_id',shopId)

      if(Array.isArray(body.photos)){
        await admin.from('shop_photos').delete().eq('shop_id',shopId)
        const rows=body.photos.filter((x:any)=>typeof x.url==='string'&&x.url.trim()).map((x:any,i:number)=>({shop_id:shopId,url:x.url.trim(),sort_order:i}))
        if(rows.length){const {error}=await admin.from('shop_photos').insert(rows);if(error)return respond(500,{error:'Erro ao salvar fotos'})}
      }

      if(Array.isArray(body.closures)){
        await admin.from('shop_closures').delete().eq('shop_id',shopId)
        const rows=body.closures.filter((x:any)=>x.starts_on&&x.ends_on).map((x:any)=>({shop_id:shopId,starts_on:x.starts_on,ends_on:x.ends_on,label:String(x.label||'Fechado').trim()||'Fechado'}))
        if(rows.length){const {error}=await admin.from('shop_closures').insert(rows);if(error)return respond(500,{error:'Erro ao salvar dias fechados'})}
      }
      return respond(200,{ok:true})
    }
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
    if (body.action === 'list_ready') {
      const {data,error}=await admin.from('shops').select('id,name,owner_user_id').eq('onboarding_completed',true).eq('pet_onboarding_mode','guided').eq('segment','pet').order('created_at',{ascending:false}).limit(100)
      if(error)return respond(500,{error:'Não foi possível listar lojas preparadas'})
      return respond(200,{shops:data||[]})
    }
    if (body.action === 'renew_invite') {
      const shopId=typeof body.shopId==='string'?body.shopId:''
      if(!/^[0-9a-f-]{36}$/i.test(shopId))return respond(400,{error:'Loja inválida'})
      const {data:shop,error:shopError}=await admin.from('shops').select('id,owner_user_id,onboarding_completed,pet_onboarding_mode').eq('id',shopId).eq('segment','pet').maybeSingle()
      if(shopError||!shop||!shop.onboarding_completed||shop.pet_onboarding_mode!=='guided')return respond(404,{error:'Loja assistida não encontrada'})
      const {data:owner,error:ownerError}=await admin.auth.admin.getUserById(shop.owner_user_id)
      if(ownerError||!owner.user?.email)return respond(500,{error:'Responsável não encontrado'})
      if(owner.user.last_sign_in_at)return respond(409,{error:'O responsável já acessou a conta. Oriente a usar Esqueci minha senha.'})
      const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:'recovery',email:owner.user.email,options:{redirectTo:siteUrl+'/painel/seguranca'}})
      const tokenHash=link?.properties?.hashed_token
      if(linkError||!tokenHash)return respond(500,{error:'Não foi possível renovar o convite'})
      return respond(200,{actionLink:siteUrl+'/ativar?token_hash='+encodeURIComponent(tokenHash)})
    }
    if (body.action === 'list') {
      const {data,error}=await admin.from('shops').select('id,name,owner_user_id').eq('onboarding_completed',false).eq('segment','pet').order('created_at',{ascending:false}).limit(50)
      if(error)return respond(500,{error:'Não foi possível listar lojas'})
      return respond(200,{shops:data||[]})
    }
    const action = body.action === 'finish' ? 'finish' : 'create'
    if (action === 'finish') {
      if (body.fullSetup === true) {
        const shopId = typeof body.shopId === 'string' ? body.shopId : ''
        if (!/^[0-9a-f-]{36}$/i.test(shopId)) return respond(400,{error:'Loja inválida'})
        const {data:shop,error:shopError}=await admin.from('shops').select('id,owner_user_id,onboarding_completed,name,phone,address,pet_business_type').eq('id',shopId).eq('segment','pet').maybeSingle()
        if(shopError||!shop)return respond(404,{error:'Loja não encontrada'})
        if(shop.onboarding_completed)return respond(409,{error:'Loja já configurada'})
        const {count:serviceCount}=await admin.from('services').select('id',{count:'exact',head:true}).eq('shop_id',shopId).eq('is_active',true)
        const {count:staffCount}=await admin.from('barbers').select('id',{count:'exact',head:true}).eq('shop_id',shopId)
        if(!shop.name||!shop.phone||!shop.address||!shop.pet_business_type||!serviceCount||!staffCount)return respond(400,{error:'Complete os dados principais, ao menos um serviço e uma pessoa da equipe antes de gerar o convite.'})
        const {data:owner,error:ownerError}=await admin.auth.admin.getUserById(shop.owner_user_id)
        if(ownerError||!owner.user?.email)return respond(500,{error:'Não foi possível encontrar o responsável'})
        const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:'recovery',email:owner.user.email,options:{redirectTo:siteUrl+'/painel/seguranca'}})
        const tokenHash=link?.properties?.hashed_token
        if(linkError||!tokenHash)return respond(500,{error:'Configuração salva, mas o convite não foi gerado'})
        const {error:completedError}=await admin.from('shops').update({onboarding_completed:true,pet_onboarding_mode:'guided'}).eq('id',shopId)
        if(completedError)return respond(500,{error:'Convite gerado, mas não foi possível concluir a preparação'})
        return respond(200,{actionLink:siteUrl+'/ativar?token_hash='+encodeURIComponent(tokenHash)})
      }
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
      if (services.some((s:any)=>typeof s.name!=='string'||!s.name.trim()||s.name.length>100||typeof s.price!=='number'||!Number.isFinite(s.price)||s.price<0||!Number.isInteger(s.duration_minutes)||s.duration_minutes<5||s.duration_minutes>1440) || staff.some((s:any)=>typeof s.name!=='string'||!s.name.trim()||s.name.length>100|| (s.role!==null && (typeof s.role!=='string'||s.role.length>100)))) return respond(400,{error:'Revise os serviços e a equipe'})
      const {error:profileError}=await admin.from('shops').update({slogan:profile.slogan.trim(),address:profile.address.trim(),phone:profile.phone,pet_business_type:body.businessType,pet_onboarding_mode:'guided'}).eq('id',shopId).eq('onboarding_completed',false)
      if(profileError) return respond(500,{error:'Não foi possível salvar os dados da loja'})
      const {data:existingServices}=await admin.from('services').select('id,name').eq('shop_id',shopId)
      for(const s of services){if(existingServices?.some((x:any)=>x.name.toLowerCase()===s.name.trim().toLowerCase()))continue;const {error}=await admin.from('services').insert({shop_id:shopId,name:s.name.trim(),price:s.price,duration_minutes:s.duration_minutes});if(error)return respond(500,{error:'Erro ao salvar serviços. Revise antes de tentar novamente.'})}
      const {data:existingStaff}=await admin.from('barbers').select('id,name').eq('shop_id',shopId)
      for(const person of staff){let id=existingStaff?.find((x:any)=>x.name.toLowerCase()===person.name.trim().toLowerCase())?.id; if(!id){const {data:created,error}=await admin.from('barbers').insert({shop_id:shopId,name:person.name.trim(),role:person.role||null}).select('id').single();if(error||!created)return respond(500,{error:'Erro ao salvar equipe'});id=created.id}for(const day of days){const {error}=await admin.from('barber_schedule').upsert({barber_id:id,day_of_week:day,is_active:true,start_time:start,end_time:end},{onConflict:'barber_id,day_of_week'});if(error)return respond(500,{error:'Erro ao salvar horários'})}}
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

}

