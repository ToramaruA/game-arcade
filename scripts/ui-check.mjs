// 画面に見えているボタンを1つずつ押して、「押せない」「押しても何も起きない」「エラーが出る」を見つける。
// 使い方: npm run ui-check -- <slug> [--pc]
// 調べる画面：タイトル → （はじめる系のボタンで）遊ぶ画面。各画面で、見えているボタンを毎回まっさらな状態から1つだけ押す。
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START_WORDS = /はじめる|始める|つづき|スタート|start|開始|遊ぶ|プレイ|出航|出発/i;

// 見えていて押せるボタン（とボタン役の要素）を集める
async function visibleButtons(page) {
  return page.evaluate(() => {
    const out = [];
    const els = [...document.querySelectorAll('button, [role="button"], a[href]:not([href^="http"]):not([href^="/"])')];
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || cs.display === 'none' || el.disabled) return;
      if (el.closest('[hidden]')) return;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
      const x = r.left + r.width / 2; const y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      const covered = !(top && (top === el || el.contains(top)));
      const label = (el.getAttribute('aria-label') || el.textContent || el.id || '').trim().replace(/\s+/g, ' ').slice(0, 24);
      out.push({ i, id: el.id, label, x, y, covered, coverer: covered && top ? (top.id || top.className || top.tagName).toString().slice(0, 30) : '' });
    });
    return out;
  });
}

// 押したあとに何か変わったか（DOM の見た目・URL・キャンバスの絵）
async function snapshot(page) {
  return page.evaluate(() => {
    const vis = [...document.querySelectorAll('body *')].filter((e) => !e.closest('[hidden]') && e.getClientRects().length).length;
    const hidden = [...document.querySelectorAll('[hidden]')].map((e) => e.id).join(',');
    const text = document.body.innerText.slice(0, 2000);
    const cv = document.querySelector('canvas'); let img = '';
    try { img = cv ? cv.toDataURL('image/jpeg', 0.2).slice(-400) : ''; } catch { img = ''; }
    return { vis, hidden, text, url: location.href, img };
  });
}
const changed = (a, b) => a.hidden !== b.hidden || a.text !== b.text || a.url !== b.url || a.vis !== b.vis;

export async function uiCheck(slug, { pc = false, base } = {}) {
  const { chromium } = await import(path.join(ROOT, 'node_modules', 'playwright', 'index.mjs'));
  const browser = await chromium.launch();
  const vp = pc ? { viewport: { width: 1280, height: 800 } } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
  const url = `${base}/games/${slug}/`;
  const problems = []; const checked = [];
  const fresh = async (setup) => {
    const ctx = await browser.newContext(vp); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(url); await page.waitForTimeout(700);
    if (setup) await setup(page);
    return { ctx, page, errs };
  };
  const tap = async (page, b) => { if (pc) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await page.waitForTimeout(500); };

  async function checkScreen(name, setup) {
    const { ctx, page } = await fresh(setup);
    const list = await visibleButtons(page); await ctx.close();
    for (const b of list) {
      const key = `${name}：${b.label || b.id || '(名前なし)'}`;
      if (b.covered) { problems.push(`${key} … 見えているのに押せない（上に「${b.coverer}」が重なっている）`); checked.push(key); continue; }
      const s = await fresh(setup);
      const before = await snapshot(s.page);
      await tap(s.page, b);
      const after = await snapshot(s.page);
      if (s.errs.length) problems.push(`${key} … 押すとエラー：${s.errs[0].slice(0, 80)}`);
      else if (!changed(before, after) && before.img === after.img) problems.push(`${key} … 押しても何も変わらない`);
      checked.push(key); await s.ctx.close();
    }
    return list;
  }

  const titleList = await checkScreen('タイトル', null);
  const start = titleList.find((b) => START_WORDS.test(b.label) && !b.covered);
  if (start) {
    await checkScreen('遊ぶ画面', async (page) => { await tap(page, start); await page.waitForTimeout(600); });
  } // 「はじめる」に当たるボタンがなければ、最初の画面がそのまま遊ぶ画面（タイトルなし）とみなす
  await browser.close();
  return { problems, checked };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2); const slug = args.find((a) => !a.startsWith('--'));
  if (!slug) { console.error('使い方: npm run ui-check -- <slug> [--pc]'); process.exit(1); }
  const { startServer } = await import(path.join(ROOT, 'scripts', 'serve.js'));
  const { server, url } = await startServer();
  try {
    for (const pc of args.includes('--pc') ? [true] : [false, true]) {
      const r = await uiCheck(slug, { pc, base: url });
      console.log(`■ ${pc ? 'PC' : 'スマホ'}：${r.checked.length}個のボタンを押した`);
      console.log(r.problems.length ? r.problems.map((p) => `NG ${p}`).join('\n') : 'OK 押せないボタン・何も起きないボタン・エラーはない');
    }
  } finally { server.close(); }
}
