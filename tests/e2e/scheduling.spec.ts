import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { data } from './api'
const account = JSON.parse(fs.readFileSync(process.env.ONEFIND_QA_ACCOUNT || '/tmp/onefind-qa-account.json', 'utf8'))
const fixture = JSON.parse(fs.readFileSync('/tmp/onefind-qa-fixture.json', 'utf8'))

test('public and internal scheduling offer the same valid slots and persist the selected services', async ({ page }) => {
  test.setTimeout(300000)
  await page.setViewportSize({ width: 390, height: 844 })
  const login = async () => {
    await page.goto('/painel')
    await page.getByPlaceholder('Ex: contato@negocio.com').fill(account.email)
    await page.getByPlaceholder('Sua senha').fill(account.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Seu dia no onefind' })).toBeVisible({ timeout: 30000 })
  }
  await login()
  const suffix = String(Date.now())
  const staff = (await data(page, 'barbers', 'POST', { shop_id: fixture.shopId, name: `QA Agenda ${suffix}` }))[0]
  const customer = (await data(page, 'shop_customers', 'POST', { shop_id: fixture.shopId, name: 'QA Tutor Agenda', phone: '199' + suffix.slice(-8) }))[0]
  const pet = (await data(page, 'pets', 'POST', { shop_id: fixture.shopId, customer_id: customer.id, name: `QA Pet ${suffix}`, size: 'medio' }))[0]
  const services = await data(page, 'services', 'POST', [
    { shop_id: fixture.shopId, name: `QA Banho Agenda ${suffix}`, price: 50, duration_minutes: 30 },
    { shop_id: fixture.shopId, name: `QA Hidratação Agenda ${suffix}`, price: 20, duration_minutes: 30 },
  ])
  await data(page, 'service_size_rules', 'POST', { service_id: services[0].id, size: 'medio', price: 60, duration_minutes: 45 })
  await data(page, 'service_barbers', 'POST', services.map((service: { id: string }) => ({ shop_id: fixture.shopId, service_id: service.id, barber_id: staff.id })))
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const date = tomorrow.toISOString().slice(0, 10), weekday = tomorrow.getDay()
  const holiday = new Date(tomorrow); holiday.setDate(holiday.getDate() + 7)
  const closedDate = holiday.toISOString().slice(0, 10)
  await data(page, 'barber_schedule', 'POST', { barber_id: staff.id, day_of_week: weekday, is_active: true, start_time: '09:00', end_time: '18:00' })
  await data(page, 'barber_time_off', 'POST', { shop_id: fixture.shopId, barber_id: staff.id, starts_on: date, ends_on: date, start_time: '13:00', end_time: '14:00' })
  const closure = (await data(page, 'shop_closures', 'POST', { shop_id: fixture.shopId, starts_on: closedDate, ends_on: closedDate, label: 'QA Agenda fechamento' }))[0]
  await data(page, 'rpc/create_operational_booking', 'POST', { p_shop_id: fixture.shopId, p_barber_id: staff.id, p_customer_id: customer.id, p_pet_id: pet.id, p_date: date, p_time: '10:00', p_service_ids: [services[0].id] })
  const internal = async () => {
    await page.goto('/painel/dashboard?aba=agenda')
    await page.getByRole('button', { name: '+ Novo agendamento', exact: true }).click()
    await page.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption(customer.id)
    await page.getByRole('combobox', { name: 'Pet', exact: true }).selectOption(pet.id)
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    for (const service of services) await page.getByRole('checkbox', { name: new RegExp(service.name) }).check()
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await expect(page.getByTestId('booking-schedule-picker').getByRole('button', { name: staff.name, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  const selectDate = async (target: Page) => {
    const picker = target.getByTestId('booking-schedule-picker')
    await expect(picker.getByText('Duração calculada: 1h 15min', { exact: true })).toBeVisible()
    await picker.getByRole('group', { name: 'Dia da semana', exact: true }).getByRole('button').click()
    await expect(picker.locator(`[data-date="${closedDate}"]`)).toHaveCount(0)
    await picker.locator(`[data-date="${date}"]`).click()
    return picker
  }
  await internal()
  const picker = await selectDate(page)
  const times = async (target: Page) => target.getByTestId('booking-schedule-picker').getByRole('button').filter({ hasText: /^\d{2}:\d{2}$/ }).allTextContents()
  const internalSlots = await times(page)
  expect(internalSlots).toContain('10:45')
  for (const unavailable of ['09:00', '10:00', '12:00', '13:00', '17:00']) expect(internalSlots).not.toContain(unavailable)
  await expect(page.locator('input[type="time"]')).toHaveCount(0)
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const box of await picker.getByRole('button').evaluateAll(nodes => nodes.map(node => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, height: node.getBoundingClientRect().height })))) {
      expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(width); expect(box.height).toBeGreaterThanOrEqual(44)
    }
  }
  await page.screenshot({ path: '/tmp/onefind-internal-scheduling.png', fullPage: true })
  // Clear only this browser's session, then exercise the public page anonymously.
  await page.evaluate(() => localStorage.clear())
  await page.goto(`/pet/${fixture.shopId}`)
  await page.getByPlaceholder('Ex: (11) 99999-9999').fill(customer.phone)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(pet.name) }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  for (const service of services) await page.getByRole('checkbox', { name: new RegExp(service.name) }).check()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  const publicPicker = await selectDate(page)
  expect(await times(page)).toEqual(internalSlots)
  await publicPicker.getByRole('button', { name: '11:00', exact: true }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click()
  await expect(page).toHaveURL(/confirmacao\//, { timeout: 30000 })
  await page.evaluate(() => localStorage.clear())
  await login()
  await internal()
  const refreshed = await selectDate(page)
  await expect(refreshed.getByRole('button', { name: '11:00', exact: true })).toHaveCount(0)
  await refreshed.getByRole('button', { name: '14:00', exact: true }).click()
  await page.getByRole('combobox', { name: 'Repetição', exact: true }).selectOption('7')
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Nenhum agendamento foi criado')
  await page.getByRole('combobox', { name: 'Repetição', exact: true }).selectOption('0')
  await refreshed.getByRole('button', { name: '14:00', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('link', { name: /Mandar comprovante/ })).toHaveAttribute('href', /wa.me/)
  const saved = (await data(page, `bookings?barber_id=eq.${staff.id}&time=eq.14:00&select=*,booking_services(*)`))[0]
  expect(saved.date).toBe(date); expect(saved.duration_minutes).toBe(75); expect(Number(saved.quoted_amount)).toBe(80); expect(saved.booking_services).toHaveLength(2)
  await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  await page.getByRole('button', { name: 'Próximos', exact: true }).click()
  await page.getByTestId(`booking-${saved.id}`).getByRole('button', { name: 'Editar / adicionar serviços', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Editar atendimento', exact: true })
  await expect(edit.getByRole('button', { name: '14:00', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await edit.getByRole('button', { name: '15:00', exact: true }).click()
  await edit.getByLabel('Observações').fill('QA remarcado com disponibilidade')
  await edit.getByRole('button', { name: 'Salvar atendimento', exact: true }).click()
  await expect(edit).toBeHidden()
  await expect.poll(async () => (await data(page, `bookings?id=eq.${saved.id}&select=time`))[0].time).toBe('15:00:00')
  // A failed availability request blocks saving, and retry restores real slots.
  await page.route('**/rest/v1/barber_schedule*', route => route.abort())
  await page.goto('/painel/dashboard?aba=agenda')
  await page.getByRole('button', { name: '+ Novo agendamento', exact: true }).click()
  await page.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption(customer.id)
  await page.getByRole('combobox', { name: 'Pet', exact: true }).selectOption(pet.id)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('checkbox', { name: new RegExp(services[0].name) }).check()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByTestId('booking-schedule-picker').getByRole('alert')).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('button', { name: 'Confirmar agendamento', exact: true })).toBeDisabled()
  await page.unroute('**/rest/v1/barber_schedule*')
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByTestId('booking-schedule-picker').getByRole('button', { name: staff.name, exact: true })).toBeVisible()
  // Cleanup only the temporary QA closure, so other QA flows are unaffected.
  await data(page, `shop_closures?id=eq.${closure.id}`, 'DELETE')
})
