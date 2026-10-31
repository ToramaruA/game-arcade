// games.json から、検索エンジン向けの sitemap.xml と、トップページの静的なゲーム一覧を作る。
// 使い方: npm run site-index        … ファイルを書き換える
//         （テストでは buildSitemap / buildList と現在のファイルを比べ、更新漏れを検出する）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from './config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SITEMAP = path.join(ROOT, 'site', 'sitemap.xml');
export const INDEX = path.join(ROOT, 'site', 'index.html');
export const START = '<!-- games:start（npm run site-index で自動生成） -->';
export const END = '<!-- games:end -->';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const listedGames = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'games', 'games.json'), 'utf8'))
  .filter((g) => g.listed !== false);

export function buildSitemap(games = listedGames()) {
  const urls = [`${SITE_URL}/`, ...games.map((g) => `${SITE_URL}/games/${g.slug}/`)];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n') + '\n</urlset>\n';
}

export function buildList(games = listedGames()) {
  return games.map((g) => `      <li><a href="/games/${esc(g.slug)}/"><img src="/games/${esc(g.slug)}/og.png" alt="${esc(g.title)}のゲーム画面" loading="lazy" width="1200" height="630"><strong>${esc(g.title)}</strong><span>${esc(g.description)}</span></a></li>`).join('\n');
}

export function listBlock(html) {
  const a = html.indexOf(START); const b = html.indexOf(END);
  if (a < 0 || b < a) throw new Error('index.html に games の目印がありません');
  return html.slice(a + START.length, b).replace(/^\n|\n\s*$/g, '');
}

export function writeAll() {
  fs.writeFileSync(SITEMAP, buildSitemap());
  const html = fs.readFileSync(INDEX, 'utf8');
  const a = html.indexOf(START); const b = html.indexOf(END);
  const indent = html.slice(html.lastIndexOf('\n', a) + 1, a);
  fs.writeFileSync(INDEX, html.slice(0, a + START.length) + '\n' + buildList() + '\n' + indent + html.slice(b));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeAll();
  console.log('updated site/sitemap.xml and the game list in site/index.html');
}
