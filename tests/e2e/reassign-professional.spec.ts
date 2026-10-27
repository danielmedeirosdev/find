import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { data } from './api'

test('owner reassigns an appointment to another available professional', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/painel?modo=cadastro')
  await page.locator('input[type=text]').fill('QA Agenda diária')
  await page.getByLabel('E-mail', { exact: true }).fill(`qa.agenda.day.${Date.now()}@example.com`)
  await page.getByLabel('Senha', { exact: true }).fill('A1!' + crypto.randomBytes(20).toString('base64url'))
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Seu dia no onefind' })).toBeVisible({ timeout: 30000 })
  const shop = (await data(page, 'shops?select=*'))[0]
  const staff = (await data(page, 'barbers', 'POST', { shop_id: shop.id, name: 'QA Agenda' }))[0]
  await data(page, 'barber_schedule', 'POST', Array.from({ length: 7 }, (_, day) => ({ barber_id: staff.id, day_of_week: day, is_active: true, start_time: '09:00', end_time: '18:00' })))
  const base = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())}T12:00:00`)
  const dateAt = (days: number) => { const d = new Date(base); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const fridayOffset = ((5 - base.getDay() + 7) % 7) || 7
  const friday = dateAt(fridayOffset), saturday = dateAt(fridayOffset + 1)
  const booking = async (date: string, time: string, name: string) => (await data(page, 'bookings', 'POST', { shop_id: shop.id, barber_id: staff.id, date, time, client_name: name, client_phone: '19999990000', duration_minutes: 5, status: 'scheduled', services_amount: 10, quoted_amount: 10 }))[0]
  await booking(friday, '09:00', 'QA Sexta cedo')
  const late = await booking(friday, '15:00', 'QA Sexta tarde')
  await booking(saturday, '10:00', 'QA Sábado')
  const service = (await data(page,'services','POST',{shop_id:shop.id,name:'QA banho',price:10,duration_minutes:5}))[0]
  await data(page,'booking_services','POST',{booking_id:late.id,service_id:service.id})
  const second = (await data(page,'barbers','POST',{shop_id:shop.id,name:'QA Outro profissional'}))[0]
  await data(page,'barber_schedule','POST',Array.from({length:7},(_,day)=>({barber_id:second.id,day_of_week:day,is_active:true,start_time:'09:00',end_time:'18:00'})))
  await page.goto('/painel/dashboard?aba=agenda')
  await page.getByLabel('Consultar dia',{exact:true}).fill(friday)
  await page.getByTestId(`booking-${late.id}`).getByRole('button',{name:'Editar / adicionar serviços'}).click()
  const modal=page.getByRole('dialog',{name:'Editar atendimento'})
  await modal.getByRole('button',{name:second.name,exact:true}).click()
  await modal.getByRole('button',{name:'12:00',exact:true}).click()
  await modal.getByRole('button',{name:'Salvar atendimento',exact:true}).click()
  await expect(modal).toBeHidden()
  const saved=(await data(page,`bookings?id=eq.${late.id}`))[0]
  expect(saved.barber_id).toBe(second.id)
  expect(saved.time).toBe('12:00:00')
  expect(Number(saved.quoted_amount)).toBe(10)
  await expect(page.getByTestId(`booking-${late.id}`)).toContainText(second.name)
})
