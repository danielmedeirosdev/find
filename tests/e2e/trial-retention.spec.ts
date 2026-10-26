import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { data } from './api'

test('deleting and recreating an account with the same email keeps the original trial deadline', async ({ page }) => {
  const email = `qa.trial.${Date.now()}.${crypto.randomBytes(4).toString('hex')}@example.com`
  const password = 'Aa1!' + crypto.randomBytes(20).toString('base64url')
  const signup = async (name: string) => {
    await page.goto('/painel?modo=cadastro')
    await page.locator('input[type=text]').fill(name)
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Senha', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Seu dia no onefind' })).toBeVisible({ timeout: 30000 })
    return (await data(page, 'shops?select=id,trial_ends_at,subscription_status'))[0]
  }
  const remove = async (name: string) => {
    await page.goto('/painel/dashboard?aba=info')
    await page.getByRole('button', { name: 'Excluir pet shop', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Tem certeza absoluta?' })
    await dialog.getByPlaceholder(name).fill(name)
    await dialog.getByRole('button', { name: 'Sim, excluir tudo', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Entrar no painel' })).toBeVisible({ timeout: 30000 })
  }
  const first = await signup('QA teste original')
  expect(new Date(first.trial_ends_at).getTime()).toBeGreaterThan(Date.now() + 29 * 86400000)
  await remove('QA teste original')
  const second = await signup('QA teste recriado')
  expect(second.id).not.toBe(first.id)
  expect(second.trial_ends_at).toBe(first.trial_ends_at)
  expect(second.subscription_status).toBe('trial')
  await remove('QA teste recriado')
})
