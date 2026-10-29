import {test,expect} from '@playwright/test'
import crypto from 'node:crypto'
import {data} from './api'

test('reserved time, deferred completion, partial and full receipt on mobile',async({page})=>{
 await page.goto('/painel?modo=cadastro')
 await page.locator('input[type=text]').fill('QA Flex isolado')
 await page.getByLabel('E-mail',{exact:true}).fill(`qa.flex.${Date.now()}@example.com`)
 await page.getByLabel('Senha',{exact:true}).fill('Aa1!'+crypto.randomBytes(20).toString('base64url'))
 await page.getByRole('button',{name:'Criar conta',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Seu dia no onefind'})).toBeVisible({timeout:30000})
 const shop=(await data(page,'shops?select=*'))[0]
 const staff=(await data(page,'barbers','POST',{shop_id:shop.id,name:'QA Flex '+Date.now()}))[0]
 await data(page,'barber_schedule','POST',Array.from({length:7},(_,day)=>({barber_id:staff.id,day_of_week:day,is_active:true,start_time:'09:00',end_time:'18:00'})))
 const c=(await data(page,'shop_customers','POST',{shop_id:shop.id,name:'QA Flex Tutor '+Date.now(),phone:'19999990000'}))[0]
 const pet=(await data(page,'pets','POST',{shop_id:shop.id,customer_id:c.id,name:'QA Flex Pet',size:'medio',species:'cao'}))[0]
 const services=await data(page,'services','POST',[{shop_id:shop.id,name:'QA banho '+Date.now(),price:50,duration_minutes:60},{shop_id:shop.id,name:'QA extra '+Date.now(),price:20,duration_minutes:15}])
 const date=new Date();date.setDate(date.getDate()+7);const day=date.toISOString().slice(0,10)
 const create=(time:string)=>data(page,'rpc/create_operational_booking','POST',{p_shop_id:shop.id,p_barber_id:staff.id,p_customer_id:c.id,p_pet_id:pet.id,p_date:day,p_time:time,p_service_ids:[services[0].id]})
 const id=await create('10:00');await create('11:00')
 await page.goto('/painel/dashboard?aba=agenda');await page.getByLabel('Consultar dia',{exact:true}).fill(day)
 let card=page.getByTestId(`booking-${id}`)
 await card.getByRole('button',{name:'Editar / adicionar serviços'}).click()
 const edit=page.getByRole('dialog',{name:'Editar atendimento'})
 await edit.locator(`input[value="${services[1].id}"]`).check()
 await expect(edit.getByLabel('Tempo reservado na agenda (min)')).toHaveValue('60')
 for(const width of [320,375,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`/tmp/onefind-flex-edit-${width}.png`})}
 await edit.getByRole('button',{name:'Salvar atendimento'}).click();await expect(edit).toBeHidden()
 const saved=(await data(page,`bookings?id=eq.${id}`))[0];expect(saved.duration_minutes).toBe(60);expect(Number(saved.quoted_amount)).toBe(70)
 await card.getByRole('button',{name:'Confirmar',exact:true}).click();await card.getByRole('button',{name:'Iniciar',exact:true}).click();await card.getByRole('button',{name:'Finalizar atendimento',exact:true}).click()
 const completion=page.getByRole('dialog',{name:'Finalizar atendimento'})
 await completion.getByRole('button',{name:'Pagar depois',exact:true}).click()
 for(const width of [320,375,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`/tmp/onefind-flex-complete-${width}.png`})}
 await completion.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(completion).toBeHidden()
 expect((await data(page,`bookings?id=eq.${id}`))[0].status).toBe('completed');expect(await data(page,`financial_transactions?booking_id=eq.${id}`)).toHaveLength(0)
 await page.goto('/painel/dashboard?aba=cashflow')
 const debt=page.locator('section').filter({has:page.getByRole('heading',{name:'Pagamentos pendentes'})}).locator('div').filter({hasText:c.name}).filter({has:page.getByRole('button',{name:'Registrar pagamento',exact:true})}).first()
 await debt.getByRole('button',{name:'Registrar pagamento',exact:true}).click()
 const receipt=page.getByRole('dialog',{name:'Registrar pagamento'})
 await receipt.getByLabel('Valor recebido (R$)').fill('20')
 await receipt.getByRole('button',{name:'Registrar',exact:true}).click();await expect(receipt).toBeHidden()
 expect(Number((await data(page,`financial_transactions?booking_id=eq.${id}`))[0].amount)).toBe(20)
 await page.reload();await debt.getByRole('button',{name:'Registrar pagamento',exact:true}).click()
 await expect(receipt.getByLabel('Valor recebido (R$)')).toHaveValue('50,00')
 await receipt.getByRole('button',{name:'Registrar',exact:true}).click();await expect(receipt).toBeHidden()
 const tx=await data(page,`financial_transactions?booking_id=eq.${id}`);expect(tx).toHaveLength(2);expect(tx.reduce((sum:number,t:{amount:number})=>sum+Number(t.amount),0)).toBe(70)
 for(const width of [320,375,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`/tmp/onefind-flex-cash-${width}.png`})}
})
