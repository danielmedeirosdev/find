/* eslint-disable @typescript-eslint/no-explicit-any -- Existing admin operation payloads; ingress is validated separately. */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { executeAssisted } from '../create-assisted-shop/operations.ts'
const url=Deno.env.get('SUPABASE_URL')!
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
const respond=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
Deno.serve(async req=>{
 if(req.method!=='POST')return respond(405,{error:'Método inválido'})
 let jobId:string; let payload:any;
 try{const body=await req.json();jobId=body.jobId;const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'')||'';
 const claim=await admin.rpc('claim_assisted_setup',{p_id:jobId,p_token:token});if(claim.error)return respond(403,{error:'Não autorizado'});payload=claim.data;
 }catch{return respond(400,{error:'Solicitação inválida'})}
 let shopId:string|null=null;
 const audit=async(args:{p_id:string;p_step:string})=>{const r=await admin.rpc('audit_assisted_step',args);if(r.error)throw Error('Falha na auditoria')};
 try{
 // Validate every supplied value before creating an account.
 if(!payload.profile||typeof payload.profile.address!=='string'||!Array.isArray(payload.services)||!Array.isArray(payload.staff))throw Error('Dados incompletos');
 const known=payload.services.filter((s:any)=>typeof s.price==='number'&&typeof s.duration_minutes==='number');
 const pending=payload.services.filter((s:any)=>!known.includes(s));
 if(payload.services.length>30||payload.services.some((s:any)=>typeof s.name!=='string'||!s.name.trim()||s.name.length>100)||known.some((s:any)=>!Number.isFinite(s.price)||s.price<0||!Number.isInteger(s.duration_minutes)||s.duration_minutes<1||s.duration_minutes>720))throw Error('Serviços inválidos');
 for(const person of payload.staff){if(typeof person.name!=='string'||!person.name.trim())throw Error('Equipe inválida');for(const row of person.schedules||[]){if(!Number.isInteger(row.day_of_week)||row.day_of_week<0||row.day_of_week>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start_time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end_time)||row.start_time>=row.end_time)throw Error('Horários inválidos')}}

 if(payload.media){for(const image of payload.media){if(!['logo','banner'].includes(image.kind)||!['image/png','image/jpeg'].includes(image.mime)||typeof image.base64!=='string'||image.base64.length>2800000)throw Error('Imagem inválida')}}
 if(payload.profile.name||typeof payload.shopName!=='string'||typeof payload.email!=='string'||typeof payload.profile.address!=='string'||payload.profile.address.length>200||typeof payload.profile.description!=='string'||payload.profile.description.length>4000||(payload.profile.phone && !/^[0-9+ ()-]{10,25}$/.test(payload.profile.phone)))throw Error('Perfil inválido');
 if(!['grooming','veterinary_clinic','pet_shop','daycare_boarding','dog_walker','training','mixed','other'].includes(payload.businessType||'grooming'))throw Error('Segmento inválido');
 if(payload.staff.length>20||payload.staff.some((p:any)=>p.id||p.auth_user_id)||payload.services.some((s:any)=>s.id))throw Error('Somente novos cadastros são permitidos');
 if(Object.keys(payload.profile).some(k=>!['description','address','phone','hours_text','slogan'].includes(k)))throw Error('Campo de perfil não permitido');
 if(payload.photos?.length)throw Error('Envie fotos pelo campo media');
 for(const image of payload.media||[]){const bytes=Uint8Array.from(atob(image.base64),(c:string)=>c.charCodeAt(0));if(image.mime==='image/png'?!(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71):!(bytes[0]===255&&bytes[1]===216))throw Error('Formato de imagem inválido')}
 if(payload.services.some((s:any)=>(s.price!=null&&(typeof s.price!=='number'||!Number.isFinite(s.price)||s.price<0))||(s.duration_minutes!=null&&(!Number.isInteger(s.duration_minutes)||s.duration_minutes<1||s.duration_minutes>720))))throw Error('Preço ou duração inválidos');
 if(!Array.isArray(payload.pendingNotes||[])||(payload.pendingNotes||[]).some((x:any)=>typeof x!=='string'||x.length>1000)||!Array.isArray(payload.businessHours||[]))throw Error('Pendências inválidas');
 for(const h of payload.businessHours||[]){if(!Number.isInteger(h.day_of_week)||h.day_of_week<0||h.day_of_week>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.start_time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.end_time)||h.start_time>=h.end_time)throw Error('Horário de funcionamento inválido')}
 const create=await executeAssisted(admin,{action:'create',email:payload.email,shopName:payload.shopName},respond);const created=await create.json();if(!create.ok)throw Error(created.error);shopId=created.shopId;
 await audit({p_id:jobId,p_step:'account_created'});

 if(payload.media){for(const image of payload.media){const bytes=Uint8Array.from(atob(image.base64),(c:string)=>c.charCodeAt(0));if(image.mime==='image/png'?!(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71):!(bytes[0]===255&&bytes[1]===216))throw Error('Formato de imagem inválido');
 const path=shopId+'/'+(image.kind==='logo'?'logo':'gallery')+'/'+crypto.randomUUID()+(image.mime==='image/png'?'.png':'.jpg');const upload=await admin.storage.from('shop-media').upload(path,bytes,{contentType:image.mime,upsert:false});if(upload.error)throw Error('Falha no envio de imagem');const publicUrl=admin.storage.from('shop-media').getPublicUrl(path).data.publicUrl;
 if(image.kind==='logo')payload.profile.logo_url=publicUrl;else payload.photos=[...(payload.photos||[]),{url:publicUrl}];}}
 await audit({p_id:jobId,p_step:'media_saved'});
 const save=await executeAssisted(admin,{action:'save_full',shopId,businessType:payload.businessType||'grooming',profile:{...payload.profile,name:payload.shopName},services:known,staff:payload.staff,packages:[],photos:payload.photos||[]},respond);if(!save.ok)throw Error((await save.json()).error);
 if(pending.length){const r=await admin.from('assisted_service_drafts').insert(pending.map((s:any)=>({shop_id:shopId,name:s.name.trim(),source:payload.source||null})));if(r.error)throw Error('Não foi possível salvar serviços pendentes')}
 const notes=await admin.from('assisted_shop_setup').insert({shop_id:shopId,business_hours:payload.businessHours||[],pending_notes:payload.pendingNotes||[],source:payload.source||null});if(notes.error)throw Error('Falha ao salvar pendências');
 await audit({p_id:jobId,p_step:'configuration_saved'});
 // Same Supabase recovery link and activation route as the existing admin panel.
 const invite=await admin.auth.admin.generateLink({type:'recovery',email:payload.email,options:{redirectTo:'https://www.onefind.com.br/painel/seguranca'}});if(invite.error||!invite.data.properties?.hashed_token)throw Error('Não foi possível gerar convite');
 const done=await admin.from('shops').update({onboarding_completed:true}).eq('id',shopId);if(done.error)throw Error('Não foi possível concluir configuração');
 await audit({p_id:jobId,p_step:'invite_generated'});
 const result={shopId,actionLink:'https://www.onefind.com.br/ativar?token_hash='+encodeURIComponent(invite.data.properties.hashed_token),pendingServices:pending.map((s:any)=>s.name)};
 const finish=await admin.rpc('finish_assisted_setup',{p_id:jobId,p_shop_id:shopId,p_result:result,p_success:true});if(finish.error)throw Error('Não foi possível registrar conclusão');

 return respond(200,{ok:true});
 }catch(e){await admin.rpc('finish_assisted_setup',{p_id:jobId,p_shop_id:shopId,p_result:{error:e instanceof Error?e.message:'Falha na preparação'},p_success:false});return respond(500,{error:'Preparação incompleta; consulte a auditoria antes de repetir'})}
})
