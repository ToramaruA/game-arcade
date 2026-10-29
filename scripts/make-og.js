// ゲーム画面を 1200x630 で撮影して site/games/<slug>/og.png を作る。
// 使い方: npm run og -- <slug>   （ゲーム側に ?og=1 用の見せ方を用意してもよい）
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: npm run og -- <slug>'); process.exit(1); }

const { server, url } = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(`${url}/games/${slug}/?og=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const out = path.join(ROOT, 'site', 'games', slug, 'og.png');
  await page.screenshot({ path: out });
  console.log(`wrote ${path.relative(ROOT, out)}`);
} finally {
  await browser.close();
  server.close();
}
