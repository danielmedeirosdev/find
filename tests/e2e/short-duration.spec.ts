import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { data } from './api'

test('short service durations can be created and edited on mobile without changing prices', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/painel?modo=cadastro')
  await page.locator('input[type=text]').fill('QA Duração livre')
  await page.getByLabel('E-mail', { exact: true }).fill(`qa.duration.${Date.now()}@example.com`)
  await page.getByLabel('Senha', { exact: true }).fill('A1!' + crypto.randomBytes(20).toString('base64url'))
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Seu dia no onefind' })).toBeVisible({ timeout: 30000 })
  const shop = (await data(page, 'shops?select=*'))[0]
  await page.goto('/painel/dashboard?aba=services')
  await page.getByPlaceholder('Ex: Banho + Tosa').fill('QA Escovação dental')
  await page.getByPlaceholder('Ex: 80,00').fill('10')
  const minutes = page.getByLabel('Minutos para qualquer porte')
  await minutes.fill('5')
  expect(await minutes.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(true)
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByPlaceholder('Ex: Banho + Tosa')).toHaveValue('')
  const service = (await data(page, `services?shop_id=eq.${shop.id}`))[0]
  expect(service.duration_minutes).toBe(5)
  expect(Number(service.price)).toBe(10)
  await page.getByRole('button', { name: 'Configurar serviço', exact: true }).click()
  const edit = page.getByRole('button', { name: 'Salvar duração', exact: true }).locator('..')
  await edit.getByText('Duração por porte', { exact: true }).click()
  for (const [label, value] of [['Pequeno (min)', '1'], ['Médio (min)', '3'], ['Grande (min)', '5']]) {
    await edit.getByLabel(label, { exact: true }).fill(value)
  }
  await edit.getByRole('button', { name: 'Salvar duração', exact: true }).click()
  await expect(edit).toBeHidden()
  const rules = await data(page, `service_size_rules?service_id=eq.${service.id}`)
  expect(Object.fromEntries(rules.map((r: { size: string; duration_minutes: number }) => [r.size, r.duration_minutes]))).toEqual({ pequeno: 1, medio: 3, grande: 5 })
  expect(Number((await data(page, `services?id=eq.${service.id}`))[0].price)).toBe(10)
  await page.reload()
  await page.getByRole('button', { name: 'Configurar serviço', exact: true }).click()
  await expect(page.getByLabel('Médio (min)', { exact: true })).toHaveValue('3')
  await page.screenshot({ path: '/tmp/onefind-free-duration-mobile.png', fullPage: true })
})
