import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { data } from './api'
const account = JSON.parse(fs.readFileSync(process.env.ONEFIND_QA_ACCOUNT || '/tmp/onefind-qa-account.json', 'utf8'))
const fixture = JSON.parse(fs.readFileSync('/tmp/onefind-qa-fixture.json', 'utf8'))
function clock(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const part = (name: string) => parts.find(item => item.type === name)!.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}
async function setup(page: Page) {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/painel')
  await page.getByPlaceholder('Ex: contato@negocio.com').fill(account.email)
  await page.getByPlaceholder('Sua senha').fill(account.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Seu dia no onefind' })).toBeVisible({ timeout: 30000 })
  const serverTime: string = await data(page, 'rpc/current_booking_time', 'POST', {})
  const today = clock(serverTime).date
  const staff = (await data(page, 'barbers', 'POST', { shop_id: fixture.shopId, name: `QA Relógio ${Date.now()}` }))[0]
  const service = (await data(page, 'services', 'POST', { shop_id: fixture.shopId, name: `QA Horário ${Date.now()}`, price: 10, duration_minutes: 15 }))[0]
  await data(page, 'service_barbers', 'POST', { shop_id: fixture.shopId, service_id: service.id, barber_id: staff.id })
  await data(page, 'barber_schedule', 'POST', { barber_id: staff.id, day_of_week: new Date(`${today}T12:00:00`).getDay(), is_active: true, start_time: '00:00', end_time: '23:59' })
  const customer = (await data(page, `shop_customers?id=eq.${fixture.customerId}`))[0]
  const pet = (await data(page, `pets?id=eq.${fixture.petId}`))[0]
  await page.evaluate(() => localStorage.clear())
  return { today, serverTime, service, customer, pet }
}
async function publicSchedule(page: Page, values: Awaited<ReturnType<typeof setup>>) {
  await page.goto(`/pet/${fixture.shopId}`)
  await page.getByPlaceholder('Ex: (11) 99999-9999').fill(values.customer.phone)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(values.pet.name) }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('checkbox', { name: new RegExp(values.service.name) }).check()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  const picker = page.getByTestId('booking-schedule-picker')
  await picker.getByRole('group', { name: 'Dia da semana', exact: true }).getByRole('button').click()
  return picker
}
test('today hides elapsed slots using real server time even when the device clock is behind', async ({ page }) => {
  const values = await setup(page)
  await page.clock.install({ time: new Date(Date.parse(values.serverTime) - 3 * 3600000) })
  const picker = await publicSchedule(page, values)
  const current = clock(values.serverTime)
  if (current.time >= '23:30') {
    await expect(picker.locator(`[data-date="${values.today}"]`)).toHaveCount(0)
    return
  }
  await picker.locator(`[data-date="${values.today}"]`).click()
  const slots = await picker.getByRole('button').filter({ hasText: /^\d{2}:\d{2}$/ }).allTextContents()
  expect(slots.length).toBeGreaterThan(0)
  expect(slots.every(time => time > current.time)).toBe(true)
  await expect(picker.getByRole('button', { name: '00:00', exact: true })).toHaveCount(0)
  await page.screenshot({ path: '/tmp/onefind-today-only-future-slots.png', fullPage: true })
})
test('an open public calendar removes a slot as it expires and clears its selection on resume', async ({ page }) => {
  const values = await setup(page)
  await page.clock.install({ time: new Date(`${values.today}T09:14:00Z`) })
  let serverTime = `${values.today}T15:14:00Z` // 12:14 in São Paulo
  await page.route('**/rest/v1/rpc/current_booking_time', route => route.fulfill({ json: serverTime }))
  const picker = await publicSchedule(page, values)
  await picker.locator(`[data-date="${values.today}"]`).click()
  await expect(picker.getByRole('button', { name: '12:00', exact: true })).toHaveCount(0)
  await picker.getByRole('button', { name: '12:15', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeEnabled()
  serverTime = `${values.today}T15:15:05Z`
  await page.clock.fastForward(65000)
  await expect(picker.getByRole('button', { name: '12:15', exact: true })).toHaveCount(0)
  await expect(picker.getByRole('button', { name: '12:30', exact: true })).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled()
  await picker.getByRole('button', { name: '12:30', exact: true }).click()
  serverTime = `${values.today}T20:10:00Z`
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(picker.getByRole('button', { name: '12:30', exact: true })).toHaveCount(0)
  await expect(picker.getByRole('button', { name: '17:15', exact: true })).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled()
})
