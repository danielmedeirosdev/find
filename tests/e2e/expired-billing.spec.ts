import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { data } from "./api";
test("expired account collects and saves document before Pix or card", async ({
  page,
}) => {
  const account = JSON.parse(
    fs.readFileSync("/tmp/onefind-copy-account.json", "utf8"),
  );
  await page.goto("/painel");
  await page.getByPlaceholder("Ex: contato@negocio.com").fill(account.email);
  await page.getByPlaceholder("Sua senha").fill(account.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Seu dia no onefind" }),
  ).toBeVisible({ timeout: 30000 });
  const shop = (await data(page, "shops?select=*"))[0];
  const original = shop.cpf_cnpj;
  await data(page, `shops?id=eq.${shop.id}`, "PATCH", { cpf_cnpj: null });
  await page.route("**/rest/v1/shops?*", async (route) => {
    if(route.request().method() !== 'GET') return route.continue();
    if(new URL(route.request().url()).searchParams.get('select') === 'cpf_cnpj') return route.continue();
    const row={...shop,cpf_cnpj:null,subscription_status:'blocked',complimentary_until:null};
    await route.fulfill({json:route.request().headers()['accept']?.includes('vnd.pgrst.object') ? row : [row]});
  });
  const methods: string[] = [];
  await page.route("**/functions/v1/create-subscription", async (route) => {
    methods.push(route.request().postDataJSON().billing_type);
    await route.fulfill({ json: { alreadyActive: true } });
  });
  try {
    await page.reload();
    const doc = page.getByLabel("CPF ou CNPJ do responsável", { exact: true });
    await expect(doc).toBeVisible();
    await page
      .getByRole("button", { name: "Continuar com Pix", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("11 dígitos");
    expect(methods).toHaveLength(0);
    await doc.fill("529.982.247-25");
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await doc.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/billing-document-${width}.png` });
    }
    await page
      .getByRole("button", { name: "Continuar com Pix", exact: true })
      .click();
    await expect.poll(() => methods.length).toBe(1);
    expect(
      (await data(page, `shops?id=eq.${shop.id}&select=cpf_cnpj`))[0].cpf_cnpj,
    ).toBe("52998224725");
    await expect(
      page.getByRole("button", { name: "Continuar com Pix", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Cartão", exact: true }).click();
    await doc.fill("11.222.333/0001-81");
    await page
      .getByRole("button", { name: "Continuar com cartão", exact: true })
      .click();
    await expect.poll(() => methods.length).toBe(2);
    expect(methods).toEqual(["PIX", "CREDIT_CARD"]);
    expect(
      (await data(page, `shops?id=eq.${shop.id}&select=cpf_cnpj`))[0].cpf_cnpj,
    ).toBe("11222333000181");
  } finally {
    await page.unrouteAll({behavior:"ignoreErrors"});
    await data(page, `shops?id=eq.${shop.id}`, "PATCH", { cpf_cnpj: original });
  }
});
