import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
test("public legacy pages and dashboard controls share usable mobile layout", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["/faq", "/privacidade"]) {
      await page.goto(route);
      await expect(page.locator(".mkt-site")).toBeVisible();
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: `/tmp/polish-${route.slice(1)}-${width}.png`,
        animations: "disabled",
      });
    }
  }
  const path = "/tmp/onefind-copy-account.json";
  if (fs.existsSync(path)) {
    const account = JSON.parse(fs.readFileSync(path, "utf8"));
    await page.goto("/painel");
    await page.getByPlaceholder("Ex: contato@negocio.com").fill(account.email);
    await page.getByPlaceholder("Sua senha").fill(account.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  } else {
    const account = {
      email: `qa.polish.${Date.now()}@example.com`,
      password: "Aa1!" + crypto.randomBytes(20).toString("base64url"),
    };
    await page.goto("/painel?modo=cadastro");
    await page.locator("input[type=text]").fill("QA Visual");
    await page.getByLabel("E-mail", { exact: true }).fill(account.email);
    await page.getByLabel("Senha", { exact: true }).fill(account.password);
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    fs.writeFileSync(path, JSON.stringify(account), { mode: 0o600 });
  }
  await expect(
    page.getByRole("heading", { name: "Seu dia no onefind" }),
  ).toBeVisible({ timeout: 30000 });
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/painel/dashboard?aba=agenda");
    await expect(
      page.getByRole("button", { name: "Dia seguinte", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".workspace-location")).toHaveCount(0);
    const input = await page.locator("input[type=date]").first().boundingBox();
    const next = await page
      .getByRole("button", { name: "Dia seguinte", exact: true })
      .boundingBox();
    expect(input!.x + input!.width).toBeLessThanOrEqual(next!.x - 6);
    const previous = await page
      .locator("input[type=date]")
      .first()
      .inputValue();
    await page
      .getByRole("button", { name: "Dia seguinte", exact: true })
      .click();
    await expect(page.locator("input[type=date]").first()).not.toHaveValue(
      previous,
    );
    await page.screenshot({
      path: `/tmp/polish-agenda-${width}.png`,
      animations: "disabled",
    });
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await expect(page.locator("#mkt-menu")).not.toContainText("Entrar no painel");
  await page.getByRole("button", { name: "Fechar menu", exact: true }).click();
  await page.goto("/minhas-reservas");
  await expect(page.getByText("Nenhuma reserva ainda",{exact:true})).toBeVisible({timeout:30000});
  await expect(page.locator(".mkt-site")).toBeVisible();
  await page.screenshot({
    path: "/tmp/polish-reservas.png",
    animations: "disabled",
  });
});
