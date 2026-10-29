// 実ブラウザでページを開き、エラーなく表示できるかを PC とスマホの画面サイズで確かめる。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.js';
import { gameDirs } from './helpers.js';

const VIEWPORTS = {
  pc: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

let browser;
let server;
let baseUrl;

before(async () => {
  ({ server, url: baseUrl } = await startServer());
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function open(pathname, device) {
  const context = await browser.newContext(VIEWPORTS[device]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(baseUrl + pathname, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { context, page, errors };
}

test('トップページがエラーなく開ける', async () => {
  const { context, errors } = await open('/', 'pc');
  await context.close();
  assert.deepEqual(errors, []);
});

for (const slug of gameDirs()) {
  for (const device of Object.keys(VIEWPORTS)) {
    test(`${slug} (${device}): エラーなく開け、横にはみ出さない`, async () => {
      const { context, page, errors } = await open(`/games/${slug}/`, device);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await context.close();
      assert.deepEqual(errors, []);
      assert.ok(overflow <= 1, `横スクロールが ${overflow}px 発生している`);
    });
  }
}
