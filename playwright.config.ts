import { defineConfig } from "@playwright/test";
const proxyUrl = process.env.HTTPS_PROXY
  ? new URL(process.env.HTTPS_PROXY)
  : null;
const proxy = proxyUrl
  ? {
      server: `${proxyUrl.protocol}//${proxyUrl.host}`,
      username: decodeURIComponent(proxyUrl.username),
      password: decodeURIComponent(proxyUrl.password),
      bypass: "localhost,127.0.0.1",
    }
  : undefined;
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  timeout: 180000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.ONEFIND_BASE_URL || "http://127.0.0.1:5173",
    headless: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    proxy,
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: process.env.ONEFIND_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 5173",
        port: 5173,
        reuseExistingServer: true,
      },
});
