import { test, expect } from "@playwright/test";

const features = [
  "agenda",
  "clientes-e-pets",
  "servicos",
  "pacotes",
  "financeiro",
  "equipe",
];
const labels = [
  "Agenda",
  "Clientes e pets",
  "Serviços",
  "Pacotes",
  "Financeiro",
  "Equipe",
];
test("marketing pages, demos and navigation work across mobile sizes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 375, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 844 });
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Comece em");
    await expect(page.locator("h1 > [aria-hidden=true]")).toContainText(
      "1 minuto.",
    );
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".mkt-hero-image")).toHaveJSProperty(
      "naturalWidth",
      1024,
    );
    expect(
      await page.evaluate(() =>
        document.fonts.check('500 30px "Onefind Display"'),
      ),
    ).toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      animations: "disabled",
      path: `/tmp/onefind-story-hero-${width}.png`,
    });
    await page
      .getByRole("link", { name: "Ver como funciona", exact: true })
      .click();
    for (let i = 0; i < features.length; i++) {
      await page.getByRole("tab", { name: labels[i], exact: true }).click();
      await expect(
        page.getByRole("tab", { name: labels[i], exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#feature-panel .mkt-demo-top")).toContainText(
        labels[i],
      );
      await expect(page.locator(".mkt-demo-bottom")).toContainText(
        "Dados fictícios",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    }
    await page.getByRole("tab", { name: "Agenda", exact: true }).click();
    await page
      .getByRole("tab", { name: "Agenda", exact: true })
      .press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Clientes e pets", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("tab", { name: "Clientes e pets", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.locator("#recursos").scrollIntoViewIfNeeded();
    await page.screenshot({
      animations: "disabled",
      path: `/tmp/onefind-story-demo-${width}.png`,
    });
    await page.locator("#planos").scrollIntoViewIfNeeded();
    await expect(page.locator(".mkt-price")).toContainText("R$ 60");
    await page.screenshot({
      animations: "disabled",
      path: `/tmp/onefind-story-price-${width}.png`,
    });
    await page
      .locator("summary")
      .filter({ hasText: "Preciso de cartão para testar?" })
      .click();
    await expect(page.locator("details[open]")).toContainText("30 dias grátis");
    if (width < 700) {
      await page
        .getByRole("button", { name: "Abrir menu", exact: true })
        .click();
      await expect(page.locator("#mkt-menu")).toBeVisible();
      await expect(page.locator("#mkt-menu")).toContainText(
        "Conhecer o onefind",
      );
      await expect(
        page
          .locator("#mkt-menu")
          .getByRole("link", { name: "Entrar no painel", exact: true }),
      ).toHaveAttribute("href", "/painel");
      await expect(
        page
          .locator("#mkt-menu")
          .getByRole("link", { name: "Agenda", exact: true }),
      ).toHaveCount(0);
      if (width === 390)
        await page.screenshot({
          path: "/tmp/onefind-menu-clarified.png",
          animations: "disabled",
        });
      await page
        .locator("#mkt-menu")
        .getByRole("link", { name: "Conhecer os recursos", exact: true })
        .click();
      await expect(page).toHaveURL(/\/#recursos$/);
      await expect(page.locator("#mkt-menu")).toHaveCount(0);
    }
    for (const feature of features) {
      await page.goto(`/recursos/${feature}`);
      await expect(page.locator(".mkt-detail-grid h1")).toBeVisible();
      await expect(page.locator(".mkt-detail-points article")).toHaveCount(3);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
      await expect(page.locator("link[rel=canonical]")).toHaveAttribute(
        "href",
        `https://www.onefind.com.br/recursos/${feature}`,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Pausar movimento" }),
  ).toHaveCount(0);
  const rail = page.locator(".mkt-rail").first();
  await page.evaluate(() => window.scrollTo({ top: 650, behavior: "instant" }));
  await expect
    .poll(() => rail.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe("matrix(1, 0, 0, 1, 0, 0)");
  const first = await rail.evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(500);
  expect(await rail.evaluate((el) => getComputedStyle(el).transform)).toBe(
    first,
  );
  await page.evaluate(() => window.scrollBy({ top: 180, behavior: "instant" }));
  await expect
    .poll(() => rail.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(first);
  await page.evaluate(() =>
    window.scrollBy({ top: -180, behavior: "instant" }),
  );
  await expect
    .poll(() => rail.evaluate((el) => getComputedStyle(el).transform))
    .toBe(first);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(rail).toHaveCSS("transform", "none");
  await page.locator(".mkt-nav-start").click();
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/");
  await page
    .getByRole("link", { name: "Testar 30 dias grátis", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/painel\?segment=pet&modo=cadastro/);
  await expect(
    page.getByRole("button", { name: "Criar conta", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
