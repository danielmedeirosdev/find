import { test, expect } from '@playwright/test'
import fs from 'node:fs'
test('operational screens remain readable at phone and desktop widths', async ({page})=>{
 test.skip(!fs.existsSync('/tmp/onefind-copy-account.json'), 'Requires the QA account fixture')
 const account=JSON.parse(fs.readFileSync('/tmp/onefind-copy-account.json','utf8'))
 await page.goto('/painel',{waitUntil:'domcontentloaded'})
 await page.getByPlaceholder('Ex: contato@negocio.com').fill(account.email)
 await page.getByPlaceholder('Sua senha').fill(account.password)
 await page.getByRole('button',{name:'Entrar',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Seu dia no onefind'})).toBeVisible({timeout:30000})
 for(const width of [320,390,1440]) {
  await page.setViewportSize({width,height:900})
  for(const tab of ['agenda','customers','pets','services','packages','cashflow','team']) {
   await page.goto('/painel/dashboard?aba='+tab,{waitUntil:'domcontentloaded'})
   await expect(page.locator('.of-workspace')).toBeVisible({timeout:30000})
   if(tab==='agenda') {
    const day=await page.locator('input[type=date]').first().inputValue()
    await page.getByRole('button',{name:'Dia seguinte',exact:true}).click()
    await expect(page.locator('input[type=date]').first()).not.toHaveValue(day)
    await expect(page.locator('.of-week-strip [aria-pressed=true]')).toHaveCount(1)
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
   await page.screenshot({path:`/tmp/workspace-${tab}-${width}.png`,fullPage:true})
  }
 }
})
