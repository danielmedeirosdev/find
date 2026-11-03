import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { data } from './api';

test('owner can verify payment, see pending/errors and recover the panel without another charge', async ({page}) => {
  const account = JSON.parse(fs.readFileSync('/tmp/onefind-copy-account.json','utf8'));
  await page.goto('/painel');
  await page.getByPlaceholder('Ex: contato@negocio.com').fill(account.email);
  await page.getByPlaceholder('Sua senha').fill(account.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Seu dia no onefind'})).toBeVisible({timeout:30000});
  const shop = (await data(page, 'shops?select=*'))[0];
  let active = false;
  let mode: 'pending'|'error'|'active' = 'pending';
  let checks = 0;
  let charges = 0;
  await page.route('**/functions/v1/create-subscription', route => { charges++; return route.fulfill({status:500,json:{error:'No charges allowed in recovery test'}}); });
  await page.route('**/functions/v1/check-subscription', async route => {
    checks++;
    expect(route.request().postDataJSON()).toEqual({shop_id:shop.id});
    if (mode === 'error') return route.fulfill({status:502,json:{error:'Provider unavailable'}});
    if (mode === 'active') active = true;
    await route.fulfill({json:{active}});
  });
  await page.route('**/rest/v1/shops?*', route => {
    if(route.request().method() !== 'GET') return route.continue();
    const row = {...shop,subscription_status:active?'active':'blocked',complimentary_until:null,asaas_subscription_id:'sub_controlled_test'};
    return route.fulfill({json:route.request().headers()['accept']?.includes('vnd.pgrst.object')?row:[row]});
  });
  await page.reload();
  const button=page.getByRole('button',{name:'Já paguei · conferir pagamento',exact:true});
  await expect(button).toBeEnabled();
  expect(checks).toBe(1); // Initial reconciliation, no polling loop.
  await button.click();
  await expect(page.getByRole('status')).toContainText('Não pague novamente');
  mode='error';
  await button.click();
  await expect(page.getByRole('status')).toContainText('Não foi possível conferir agora');
  for(const width of [320,375,390,430]) {
    await page.setViewportSize({width,height:844});
    await button.scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:`/tmp/payment-recovery-${width}.png`});
  }
  mode='active';
  await button.click();
  await expect(page.getByRole('heading',{name:'Seu dia no onefind'})).toBeVisible();
  expect(charges).toBe(0);
});

test('deployed reconciliation enforces auth and shop ownership without modifying billing', async ({page}) => {
  const account = JSON.parse(fs.readFileSync('/tmp/onefind-copy-account.json','utf8'));
  await page.goto('/painel');
  await page.getByPlaceholder('Ex: contato@negocio.com').fill(account.email);
  await page.getByPlaceholder('Sua senha').fill(account.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Seu dia no onefind'})).toBeVisible({timeout:30000});
  const shop=(await data(page,'shops?select=*'))[0];
  const env=fs.readFileSync('.env.local','utf8');
  const url=env.match(/VITE_SUPABASE_URL=(.*)/)![1],key=env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)![1];
  const responses=await page.evaluate(async({url,key,shopId})=>{
    const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'))!;
    const token=JSON.parse(localStorage.getItem(k)!).access_token;
    const call=async(id:string,auth:boolean)=>{
      const response=await fetch(`${url}/functions/v1/check-subscription`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,...(auth?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({shop_id:id})});
      return {status:response.status,body:await response.json()};
    };
    return [await call(shopId,true),await call('00000000-0000-0000-0000-000000000000',true),await call(shopId,false)];
  },{url,key,shopId:shop.id});
  expect(responses[0]).toEqual({status:200,body:{active:shop.subscription_status === 'active'}});
  expect(responses[1].status).toBe(403);
  expect(responses[2].status).toBe(401);
});
