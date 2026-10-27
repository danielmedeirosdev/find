import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { data } from './api'

test('agenda opens a chosen day directly, moves between days and keeps reminder links working', async ({ page }) => {
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
  const early = await booking(friday, '09:00', 'QA Sexta cedo')
  const late = await booking(friday, '15:00', 'QA Sexta tarde')
  const next = await booking(saturday, '10:00', 'QA Sábado')
  // The daily consultation also keeps completed attendance visible.
  await data(page, `bookings?id=eq.${early.id}`, 'PATCH', { status: 'completed' })
  await page.goto('/painel/dashboard?aba=agenda')
  const day = page.getByLabel('Consultar dia', { exact: true })
  await day.fill(friday)
  await expect(page.getByTestId(`booking-${early.id}`)).toBeVisible()
  await expect(page.getByTestId(`booking-${late.id}`)).toBeVisible()
  await expect(page.getByTestId(`booking-${next.id}`)).toHaveCount(0)
  expect(await page.locator('[data-testid^="booking-"]').evaluateAll(elements => elements.map(el => el.getAttribute('data-testid')))).toEqual([`booking-${early.id}`, `booking-${late.id}`])
  await page.getByRole('button', { name: 'Dia seguinte', exact: true }).click()
  await expect(day).toHaveValue(saturday)
  await expect(page.getByTestId(`booking-${next.id}`)).toBeVisible()
  await expect(page.getByTestId(`booking-${late.id}`)).toHaveCount(0)
  await page.getByRole('button', { name: 'Dia anterior', exact: true }).click()
  await expect(page.getByTestId(`booking-${late.id}`)).toBeVisible()
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await day.fill(dateAt(fridayOffset + 3))
  await expect(page.getByText('Nenhum agendamento neste dia.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hoje', exact: true }).click()
  await expect(day).toHaveValue(dateAt(0))
  await page.getByRole('button', { name: 'Amanhã', exact: true }).click()
  await expect(day).toHaveValue(dateAt(1))
  await page.getByRole('button', { name: 'Próximos', exact: true }).click()
  await expect(page.getByTestId(`booking-${late.id}`)).toBeVisible()
  await expect(page.getByTestId(`booking-${next.id}`)).toBeVisible()
  await page.goto(`/painel/dashboard?aba=agenda&atendimento=${next.id}`)
  await expect(day).toHaveValue(saturday)
  await expect(page.getByTestId(`booking-${next.id}`)).toBeVisible()
  await expect(page.getByTestId(`booking-${late.id}`)).toHaveCount(0)
  await page.screenshot({ path: '/tmp/onefind-agenda-day-mobile.png', fullPage: true })
  // A failed day query must show an error, not an empty or stale agenda.
  await page.route('**/rest/v1/bookings?**', async route => {
    const request = new URL(route.request().url())
    if (request.searchParams.get('date') === `eq.${friday}`) await route.abort('failed')
    else await route.continue()
  })
  await day.fill(friday)
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible({ timeout: 30000 })
  await expect(page.getByTestId(`booking-${next.id}`)).toHaveCount(0)
  await page.unroute('**/rest/v1/bookings?**')
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByTestId(`booking-${late.id}`)).toBeVisible()
})
