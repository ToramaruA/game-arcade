// ゲーム画面を PC とスマホの幅で撮影し、test-results/ に保存する（見た目の自己チェック用）。
// 使い方: npm run screenshot -- <slug>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: npm run screenshot -- <slug>'); process.exit(1); }

const outDir = path.join(ROOT, 'test-results', slug);
fs.mkdirSync(outDir, { recursive: true });
const devices = {
  pc: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

const { server, url } = await startServer();
const browser = await chromium.launch();
try {
  for (const [name, options] of Object.entries(devices)) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto(`${url}/games/${slug}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const out = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: out });
    console.log(`wrote ${path.relative(ROOT, out)}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
