import { test, expect } from "@playwright/test";
import fs from "node:fs";
const account = JSON.parse(
  fs.readFileSync(
    process.env.ONEFIND_QA_ACCOUNT || "/tmp/onefind-qa-account.json",
    "utf8",
  ),
);
const tabs = [
  "overview",
  "agenda",
  "customers",
  "pets",
  "services",
  "team",
  "packages",
  "cashflow",
  "reports",
  "info",
  "link",
];
for (const width of [320, 375, 390, 430, 768, 1440]) {
  test(`workspace ${width}px has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/painel");
    await page.getByPlaceholder("Ex: contato@negocio.com").fill(account.email);
    await page.getByPlaceholder("Sua senha").fill(account.password);
    await expect(page.getByPlaceholder("Ex: contato@negocio.com")).toHaveValue(
      account.email,
    );
    expect(
      await page
        .getByPlaceholder("Sua senha")
        .evaluate((e: HTMLInputElement) => e.value.length),
    ).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Seu dia no onefind" }),
    ).toBeVisible({ timeout: 30000 });
    for (const tab of tabs) {
      await page.goto(`/painel/dashboard?aba=${tab}`);
      await expect(page.locator(".dashboard-tab-content")).toBeVisible();
      await expect(
        page.locator(".dashboard-tab-content").getByText(/Carregando/),
      ).toHaveCount(0, { timeout: 20000 });
      await expect(
        page.locator(".dashboard-tab-content h2").first(),
      ).toBeVisible();
      const sizes = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(sizes.scroll, `${tab} overflows at ${width}`).toBeLessThanOrEqual(
        sizes.width,
      );
    }
    await page.goto("/painel/dashboard");
    await expect(
      page.getByRole("heading", { name: "Seu dia no onefind" }),
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/onefind-qa-${width}.png`,
      fullPage: true,
    });
  });
}
