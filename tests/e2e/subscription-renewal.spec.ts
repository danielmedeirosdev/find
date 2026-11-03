import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {data} from './api';
async function login(page:Page) {
 const a=JSON.parse(fs.readFileSync('/tmp/onefind-copy-account.json','utf8'));
 await page.goto('/painel');await page.getByPlaceholder('Ex: contato@negocio.com').fill(a.email);await page.getByPlaceholder('Sua senha').fill(a.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Seu dia no onefind'})).toBeVisible({timeout:30000});
}
test('paid dates, authorized card renewal, decline and manual Pix work on mobile without real charges',async({page})=>{
 await login(page);const shop=(await data(page,'shops?select=*'))[0];
 let automatic=false;let declines=true;const mutations:string[]=[];let checkout=0;
 const billing=()=>({paidUntil:'2026-12-04',daysRemaining:31,nextDueDate:'2026-12-04',billingType:automatic?'CREDIT_CARD':'PIX',automaticRenewal:automatic,cardLast4:automatic?'4242':null,cardBrand:automatic?'VISA':null,canConfigureCard:true,hasSubscription:true,pixAutomatic:'unavailable'});
 await page.route('**/rest/v1/shops?*',route=>{
   if(route.request().method()!=='GET') return route.continue();
   const row={...shop,subscription_status:'active',complimentary_until:null,asaas_subscription_id:'sub_qa_controlled'};
   return route.fulfill({json:route.request().headers()['accept']?.includes('vnd.pgrst.object')?row:[row]});
 });
 await page.route('**/functions/v1/create-subscription',route=>{checkout++;return route.fulfill({status:500,json:{error:'Real checkout blocked in test'}})});
 await page.route('**/functions/v1/manage-subscription',async route=>{
   const body=route.request().postDataJSON();expect(body.shop_id).toBe(shop.id);
   if(body.action==='summary') return route.fulfill({json:billing()});
   mutations.push(body.action);expect(body.consent).toBe(true);expect(body.request_id).toMatch(/^[a-f0-9-]{36}$/);
   if(body.action==='enable_card') {
     expect(body.card.number).toBe('4242424242424242');expect(body.card.ccv).toBe('123');
     if(declines) return route.fulfill({status:502,json:{error:'Controlled provider refusal'}});
     automatic=true;
   }else if(body.action==='use_pix') automatic=false;
   else throw Error('Unexpected billing operation');
   return route.fulfill({json:billing()});
 });
 await page.goto('/painel/dashboard?aba=subscription');
 await expect(page.getByText('04/12/2026',{exact:true})).toHaveCount(2);
 await expect(page.getByText('31 dias restantes',{exact:true})).toBeVisible();
 await expect(page.getByText('Pix manual: pague a fatura a cada mês.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cadastrar cartão',exact:true}).click();
 const form=page.getByRole('form',{name:'Cadastrar renovação automática'});
 await form.getByRole('button',{name:'Autorizar renovação mensal',exact:true}).click();expect(mutations).toEqual([]);
 await form.getByLabel('Nome no cartão',{exact:true}).fill('Titular Teste');
 await form.getByLabel('Número do cartão',{exact:true}).fill('4242424242424242');
 await form.getByLabel('Validade',{exact:true}).fill('12/2030');await form.getByLabel('CVV',{exact:true}).fill('123');
 await form.getByLabel('E-mail do titular',{exact:true}).fill('titular@example.com');
 await form.getByLabel('CPF ou CNPJ do titular',{exact:true}).fill('52998224725');
 await form.getByLabel('CEP',{exact:true}).fill('13060-367');await form.getByLabel('Número do endereço',{exact:true}).fill('10');await form.getByLabel('Telefone do titular',{exact:true}).fill('11999999999');
 await form.getByRole('button',{name:'Autorizar renovação mensal',exact:true}).click();expect(mutations).toEqual([]);
 for(const width of [320,375,390,430]) {
   await page.setViewportSize({width,height:844});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:`/tmp/subscription-form-top-${width}.png`});
   await form.getByRole('checkbox').scrollIntoViewIfNeeded();
   await page.screenshot({path:`/tmp/subscription-form-bottom-${width}.png`});
 }
 await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Autorizar renovação mensal',exact:true}).click();
 await expect(form.getByRole('alert')).toContainText('Não foi possível cadastrar');
 await expect(form.getByLabel('CVV',{exact:true})).toHaveValue('');
 declines=false;await form.getByLabel('CVV',{exact:true}).fill('123');await form.getByRole('button',{name:'Autorizar renovação mensal',exact:true}).click();
 await expect(form).toHaveCount(0);await expect(page.getByText('Renovação automática no cartão final 4242.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Desativar renovação automática',exact:true}).click();
 await page.getByRole('button',{name:'Manter cartão',exact:true}).click();expect(mutations).toEqual(['enable_card','enable_card']);
 await page.getByRole('button',{name:'Desativar renovação automática',exact:true}).click();await page.getByRole('button',{name:'Confirmar Pix manual',exact:true}).click();
 await expect(page.getByText('Pix manual: pague a fatura a cada mês.',{exact:true})).toBeVisible();
 await expect(page.getByText('31 dias restantes',{exact:true})).toBeVisible();expect(checkout).toBe(0);expect(mutations).toEqual(['enable_card','enable_card','use_pix']);
 expect(await page.evaluate(()=>JSON.stringify(localStorage).includes('4242424242424242'))).toBe(false);
 for(const width of [320,375,390,430,1440]) {await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`/tmp/subscription-summary-${width}.png`});}
});

test('live billing summary, ownership, audit permissions and missing consent are enforced',async({page})=>{
 await login(page);const shop=(await data(page,'shops?select=*'))[0];
 const env=fs.readFileSync('.env.local','utf8');const url=env.match(/VITE_SUPABASE_URL=(.*)/)![1],key=env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)![1];
 const r=await page.evaluate(async({url,key,id})=>{
   const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'))!;const token=JSON.parse(localStorage.getItem(k)!).access_token;
   const call=async(body:Record<string,unknown>,auth=true)=>{const res=await fetch(`${url}/functions/v1/manage-subscription`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:res.status,body:await res.json()}};
   return [await call({shop_id:id,action:'summary'}),await call({shop_id:'00000000-0000-0000-0000-000000000000',action:'summary'}),await call({shop_id:id,action:'summary'},false),await call({shop_id:id,action:'enable_card',consent:false})];
 },{url,key,id:shop.id});
 expect(r[0].status).toBe(200);expect(r[0].body.hasSubscription).toBe(false);expect(['unavailable','unverified']).toContain(r[0].body.pixAutomatic);
 console.log('Live read-only provider check:',JSON.stringify({hasSubscription:r[0].body.hasSubscription,pixAutomatic:r[0].body.pixAutomatic}));
 expect(r[1].status).toBe(403);expect(r[2].status).toBe(401);expect(r[3].status).toBeGreaterThanOrEqual(400);
 expect(await data(page,'subscription_renewal_consents?select=id')).toEqual([]);
 const unchanged=(await data(page,`shops?id=eq.${shop.id}&select=subscription_status,asaas_subscription_id`))[0];expect(unchanged.subscription_status).toBe(shop.subscription_status);expect(unchanged.asaas_subscription_id).toBe(shop.asaas_subscription_id);
});
