import {test,expect} from '@playwright/test'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {data} from './api'
const account=JSON.parse(fs.readFileSync(process.env.ONEFIND_QA_ACCOUNT||'/tmp/onefind-qa-account.json','utf8'))
const fixture=JSON.parse(fs.readFileSync('/tmp/onefind-qa-fixture.json','utf8'))
test('staff login exposes only permitted areas and data',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto('/painel')
 await page.getByPlaceholder('Ex: contato@negocio.com').fill(account.email)
 await page.getByPlaceholder('Sua senha').fill(account.password)
 await page.getByRole('button',{name:'Entrar',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Seu dia no onefind'})).toBeVisible({timeout:30000})
 const staffName=`QA Staff ${Date.now()}`
 const staff=(await data(page,'barbers','POST',{shop_id:fixture.shopId,name:staffName}))[0]
 await page.goto('/painel/dashboard?aba=team')
 const card=page.getByRole('heading',{name:staffName,exact:true}).locator("xpath=ancestor::div[contains(@class,'rounded-lg') and contains(@class,'p-4')][1]")
 await card.getByRole('button',{name:'Criar acesso',exact:true}).click()
 const email=`qa.staff.${Date.now()}@example.com`,password='Aa1!'+crypto.randomBytes(20).toString('base64url')
 await card.getByPlaceholder('E-mail de acesso').fill(email)
 await card.getByPlaceholder('Senha temporária forte').fill(password)
 await card.getByRole('button',{name:'Criar acesso',exact:true}).last().click()
 await expect.poll(async()=>(await data(page,`barbers?id=eq.${staff.id}`))[0].user_id,{timeout:30000}).toBeTruthy()
 await page.getByRole('button',{name:/Conta de/}).click()
 await page.getByRole('button',{name:'Sair da conta'}).click()
 await expect(page.getByRole('heading',{name:'Entrar no painel'})).toBeVisible()
 await page.getByPlaceholder('Ex: contato@negocio.com').fill(email)
 await page.getByPlaceholder('Sua senha').fill(password)
 await page.getByRole('button',{name:'Entrar',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Minha agenda'})).toBeVisible({timeout:30000})
 await expect(page.getByRole('button',{name:'Financeiro',exact:true})).toHaveCount(0)
 await page.goto('/painel/dashboard?aba=cashflow')
 await expect(page.getByRole('heading',{name:'Minha agenda'})).toBeVisible()
 expect(await data(page,'financial_transactions?select=id')).toEqual([])
 expect(await data(page,'shops?select=id')).toEqual([{id:fixture.shopId}])
})
