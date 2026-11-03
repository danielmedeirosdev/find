import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFor } from "../_shared/cors.ts";
import { asaasFetch } from "../_shared/asaas-client.ts";
import { summarizeSubscription, type ProviderSubscription } from "../_shared/subscription-summary.ts";
import { configureRenewal } from "../_shared/configure-renewal.ts";
import type { BillingPayment } from "../_shared/payment-entitlement.ts";

Deno.serve(async req => {
  const cors = corsFor(req);
  const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{...cors.headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method==='OPTIONS') return reply({},cors.allowed?200:403);
  if(!cors.allowed) return reply({error:'Forbidden origin'},403);
  if(req.method!=='POST') return reply({error:'Method not allowed'},405);
  let audit: {id:string; admin:ReturnType<typeof createClient>}|null=null;
  try {
    const authorization=req.headers.get('Authorization');
    if(!authorization) return reply({error:'Unauthorized'},401);
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user) return reply({error:'Unauthorized'},401);
    const body=await req.json();
    if(typeof body.shop_id!=='string') return reply({error:'Loja inválida.'},400);
    if(!['summary','enable_card','use_pix'].includes(body.action)) return reply({error:'Operação inválida.'},400);
    const {data:shop,error}=await client.from('shops').select('id, asaas_customer_id, asaas_subscription_id, complimentary_until')
      .eq('id',body.shop_id).eq('owner_user_id',user.id).maybeSingle();
    if(error) throw error;
    if(!shop) return reply({error:'Forbidden'},403);
    const apiKey=Deno.env.get('ASAAS_API_KEY');
    if(!apiKey) throw new Error('Provider unavailable');
    let subscription:ProviderSubscription|null=null;
    let payments:BillingPayment[]=[];
    if(shop.asaas_subscription_id&&shop.asaas_customer_id) {
      const result=await Promise.all([
        asaasFetch<ProviderSubscription>({path:`/subscriptions/${encodeURIComponent(shop.asaas_subscription_id)}`,apiKey}),
        asaasFetch<{data?:BillingPayment[];hasMore?:boolean}>({path:`/payments?subscription=${encodeURIComponent(shop.asaas_subscription_id)}&customer=${encodeURIComponent(shop.asaas_customer_id)}&dueDate%5Bge%5D=${new Date(Date.now()-62*86400000).toISOString().slice(0,10)}&limit=100`,apiKey}),
      ]);
      subscription=result[0];
      if(subscription.customer!==shop.asaas_customer_id||result[1].hasMore) throw new Error('Provider mismatch');
      payments=result[1].data??[];
    }
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
    const summary=summarizeSubscription(subscription,payments,shop.asaas_customer_id,today,shop.complimentary_until);
    if(body.action==='summary') {
      // Only the account type is used to check a documented Pix Automatic prerequisite.
      // Do not expose merchant identity or provider credentials to the client.
      let pixAutomatic:'unavailable'|'unverified'='unverified';
      try {
        const merchant=await asaasFetch<{personType?:string}>({path:'/myAccount/commercialInfo',apiKey});
        if(merchant.personType==='FISICA') pixAutomatic='unavailable';
      } catch { /* Billing details remain usable when account information is restricted. */ }
      return reply({...summary,hasSubscription:Boolean(subscription),pixAutomatic});
    }
    if(!subscription || subscription.status!=='ACTIVE' || subscription.cycle!=='MONTHLY' || subscription.value!==60) {
      return reply({error:'Não encontramos uma assinatura mensal disponível para esta alteração.'},409);
    }
    if(body.consent!==true) return reply({error:'Confirme a alteração antes de continuar.'},400);
    if(typeof body.request_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.request_id)) return reply({error:'Atualize a página antes de confirmar.'},400);
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Persist consent before a provider write. Repeated request IDs cannot repeat that write.
    const recorded=await admin.from('subscription_renewal_consents').insert({id:body.request_id,shop_id:shop.id,created_by:user.id,action:body.action,subscription_id:subscription.id,next_due_date:summary.nextDueDate});
    if(recorded.error) return reply({error:recorded.error.code==='23505'?'Esta solicitação já foi recebida. Atualize os dados do plano.':'Não foi possível registrar a autorização. Tente novamente.'},409);
    audit={id:body.request_id,admin};
    let cardRegistration:Record<string,unknown>|undefined;
    if(body.action==='enable_card') {
      if(!summary.canConfigureCard) return reply({error:'Regularize a mensalidade atual antes de cadastrar a renovação automática.'},409);
      const card=body.card??{};
      const holder=body.holder??{};
      const digits=(v:unknown)=>typeof v==='string'?v.replace(/\D/g,''):'';
      const number=digits(card.number),month=digits(card.expiryMonth),year=digits(card.expiryYear),ccv=digits(card.ccv);
      const cpfCnpj=digits(holder.cpfCnpj),postalCode=digits(holder.postalCode),phone=digits(holder.phone);
      if(number.length<13||number.length>19||!/^\d{3,4}$/.test(ccv)||Number(month)<1||Number(month)>12||year.length!==4||
        ![11,14].includes(cpfCnpj.length)||postalCode.length!==8||phone.length<10||phone.length>11||
        typeof card.holderName!=='string'||card.holderName.trim().length<3||typeof holder.email!=='string'||!/^\S+@\S+\.\S+$/.test(holder.email)||
        typeof holder.addressNumber!=='string'||!holder.addressNumber.trim()) return reply({error:'Confira os dados do cartão e do titular.'},400);
      const expiry=Number(year)*12+Number(month);
      const now=new Date();
      if(expiry<now.getUTCFullYear()*12+now.getUTCMonth()+1) return reply({error:'Confira a validade do cartão.'},400);
      const remoteIp=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip');
      if(!remoteIp) return reply({error:'Não foi possível validar a conexão. Atualize a página e tente novamente.'},400);
      cardRegistration={
        creditCard:{holderName:card.holderName.trim(),number,expiryMonth:month.padStart(2,'0'),expiryYear:year,ccv},
        creditCardHolderInfo:{name:card.holderName.trim(),email:holder.email,cpfCnpj,postalCode,addressNumber:holder.addressNumber.trim(),phone},remoteIp,
      };
    }
    const current=await configureRenewal(subscription.id,body.action,cardRegistration,options=>asaasFetch({...options,apiKey}));
    if(current.customer!==shop.asaas_customer_id) throw new Error('Provider mismatch');
    const refreshed=summarizeSubscription(current,payments,shop.asaas_customer_id,today,shop.complimentary_until);
    const confirmed=body.action==='enable_card'?refreshed.automaticRenewal:current.billingType==='PIX';
    if(!confirmed) throw new Error('Provider did not confirm renewal');
    const completed=await admin.from('subscription_renewal_consents').update({outcome:'confirmed',confirmed_at:new Date().toISOString()}).eq('id',body.request_id);
    if(completed.error) throw new Error('Consent confirmation failed');
    console.info('Subscription payment method updated',{shopId:shop.id,userId:user.id,billingType:current.billingType});
    return reply({...refreshed,hasSubscription:true});
  } catch {
    if(audit) await audit.admin.from('subscription_renewal_consents').update({outcome:'unknown'}).eq('id',audit.id);
    // Never echo provider errors that may contain payment data.
    return reply({error:'Não foi possível concluir a operação no Asaas. Confira os dados ou tente novamente em instantes.'},502);
  }
});
