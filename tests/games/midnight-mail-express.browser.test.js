import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../../scripts/serve.js';

let browser, server, base;
before(async () => { ({ server, url: base } = await startServer()); browser = await chromium.launch(); });
after(async () => { await browser?.close(); server?.close(); });

async function open(device) {
  const ctx = await browser.newContext(device === 'phone' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/games/midnight-mail-express/`); await page.waitForTimeout(300);
  return { ctx, page, errors };
}

test('スマホ幅390px：運行中の切符・分岐・降車ボタンが画面内に収まり、横にはみ出さない', async () => {
  const { ctx, page, errors } = await open('phone');
  await page.click('.run:not([disabled])'); await page.click('#btnStart'); await page.waitForTimeout(400);
  for (const sel of ['#btnDrop', '#brL', '#brR', '.ticket:not(.empty)', '#btnPause']) {
    const b = await page.locator(sel).first().boundingBox();
    assert.ok(b && b.x >= 0 && b.x + b.width <= 390 && b.y >= 0 && b.y + b.height <= 844, `${sel} が画面外: ${JSON.stringify(b)}`);
    assert.ok(b.height >= 30, `${sel} が小さすぎる`);
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
  await ctx.close(); assert.deepEqual(errors, []);
});

test('操作：切符選択・分岐・降車（キーボード）と、ポーズ中は時間が進まない', async () => {
  const { ctx, page, errors } = await open('pc');
  await page.click('.run:not([disabled])'); await page.click('#btnStart'); await page.waitForTimeout(300);
  await page.keyboard.press('2'); assert.equal(await page.evaluate(() => __mme.run.passengers[__mme.selected].slot), 1);
  await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => __mme.run.side[0]), 1);
  await page.keyboard.press('ArrowLeft'); assert.equal(await page.evaluate(() => __mme.run.side[0]), 0);
  await page.keyboard.press('p'); const t0 = await page.evaluate(() => __mme.segT); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => __mme.segT), t0, 'ポーズ中は進まない'); assert.ok(await page.evaluate(() => __mme.paused));
  await page.keyboard.press('p');
  await page.evaluate(() => __mme.setSegT(__mme.run.tpl.T - 1)); await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => __mme.run.phase), 'window');
  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => __mme.run.log.length), 1);
  await page.keyboard.press('Space'); // 連打しても同じ客は二重に降りない
  assert.ok(await page.evaluate(() => new Set(__mme.run.log.map((e) => e.passenger.id)).size === __mme.run.log.length));
  await ctx.close(); assert.deepEqual(errors, []);
});

test('タブが非表示になると自動でポーズ。保存が使えなくても遊べる', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/games/midnight-mail-express/`); await page.waitForTimeout(300);
  await page.click('.run:not([disabled])'); await page.click('#btnStart'); await page.waitForTimeout(200);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.ok(await page.evaluate(() => __mme.paused));
  await ctx.close(); assert.deepEqual(errors, []);
});
