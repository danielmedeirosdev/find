import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { data } from './api'

test.use({ launchOptions: { executablePath: process.env.ONEFIND_CHROMIUM_PATH } })
test('assisted invitation, owner password, trial and pending services on mobile', async ({ page }) => {
  test.skip(!process.env.ONEFIND_QA_ACTIVATION_LINK, 'Requires a disposable assisted invitation')
  const token = new URL(process.env.ONEFIND_QA_ACTIVATION_LINK!).searchParams.get('token_hash')!
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ativar?token_hash=' + token)
  await expect(page.getByRole('heading', { name: 'Ativar acesso ao onefind' })).toBeVisible()
  await expect(page.getByLabel('Nova senha', { exact: true })).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
  const password = 'Qa!9' + crypto.randomBytes(22).toString('hex')
  await page.getByLabel('Nova senha', { exact: true }).fill(password)
  await page.getByLabel('Confirmar senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Ativar minha conta', exact: true }).click()
  await expect(page).toHaveURL(/\/painel\/dashboard/)
  const shops = await data(page, 'shops?select=id,trial_ends_at,onboarding_completed')
  expect(shops).toHaveLength(1)
  expect(shops[0].onboarding_completed).toBe(true)
  expect(Math.abs((Date.parse(shops[0].trial_ends_at) - Date.now()) / 86400000 - 30)).toBeLessThan(0.01)
  await page.goto('/painel/dashboard?aba=services')
  await expect(page.getByRole('heading', { name: 'Complete sua configuração' })).toBeVisible()
  const pending = page.getByRole('button', { name: 'Completar QA Banho pendente', exact: true })
  await expect(pending).toBeVisible()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/onefind-assisted-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await pending.click()
  await page.getByLabel('Preço (R$)', { exact: true }).fill('80,50')
  await page.getByLabel('Duração (minutos)', { exact: true }).fill('45')
  await page.getByRole('button', { name: 'Confirmar serviço', exact: true }).click()
  await expect(pending).toHaveCount(0)
  const services = await data(page, 'services?select=name,price,duration_minutes')
  expect(services.find((service: { name: string }) => service.name === 'QA Banho pendente')).toMatchObject({ price: 80.5, duration_minutes: 45 })
  expect(await data(page, 'assisted_service_drafts?select=id')).toHaveLength(0)
  const initialDeadline = shops[0].trial_ends_at
  const email = await page.evaluate(() => { const key = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'))!; return JSON.parse(localStorage.getItem(key)!).user.email as string })
  // Reusing a consumed invitation must fail and never silently attach an existing login.
  await page.goto('/ativar?token_hash=' + token)
  await expect(page.getByRole('alert')).toContainText('expirou ou já foi utilizado')
  await page.goto('/painel')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/painel\/dashboard/)
  expect((await data(page, 'shops?select=trial_ends_at'))[0].trial_ends_at).toBe(initialDeadline)
})
