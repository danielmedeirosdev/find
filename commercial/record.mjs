#!/usr/bin/env node
/**
 * Grava o comercial ONEFIND em 1080x1920 via Playwright.
 */
import { chromium } from 'playwright';
import { mkdir, readdir, rename } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DURATION_MS = 28000;
const OUT_DIR = path.join(__dirname, 'raw');
const HTML = path.join(__dirname, 'onefind-commercial.html');

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-web-security', '--font-render-hinting=none'],
});

const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: OUT_DIR,
    size: { width: 1080, height: 1920 },
  },
  colorScheme: 'dark',
});

const page = await context.newPage();
await page.goto(`file://${HTML}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(DURATION_MS + 500);
await context.close();
await browser.close();

const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.webm'));
if (!files.length) throw new Error('Nenhum vídeo gravado');
const latest = files.sort().at(-1);
const webm = path.join(OUT_DIR, latest);
const target = path.join(__dirname, 'video-visual.webm');
await rename(webm, target);
console.log('Gravado:', target);
