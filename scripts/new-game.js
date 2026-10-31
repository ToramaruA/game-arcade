// 使い方: npm run new-game -- <slug> "<タイトル>" "<説明>"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL, SLUG_PATTERN } from './config.js';
import { writeAll as writeSiteIndex } from './site-index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [slug, title, description] = process.argv.slice(2);
if (!slug || !title || !description || !SLUG_PATTERN.test(slug)) {
  console.error('usage: npm run new-game -- <slug: a-z0-9 と -> "<タイトル>" "<説明>"');
  process.exit(1);
}
const dest = path.join(ROOT, 'site', 'games', slug);
if (fs.existsSync(dest)) {
  console.error(`site/games/${slug} は既に存在します`);
  process.exit(1);
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const vars = { SLUG: slug, TITLE: escape(title), DESCRIPTION: escape(description), SITE_URL };
const tpl = path.join(ROOT, 'templates', 'game');
fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(tpl)) {
  const text = fs.readFileSync(path.join(tpl, name), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  fs.writeFileSync(path.join(dest, name), text);
}

const manifestPath = path.join(ROOT, 'site', 'games', 'games.json');
const games = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
games.push({ slug, title, description, listed: true, added: new Date().toISOString().slice(0, 10) });
fs.writeFileSync(manifestPath, JSON.stringify(games, null, 2) + '\n');
writeSiteIndex(); // sitemap.xml とトップの一覧も更新
console.log(`created site/games/${slug}/ — 次に npm run og -- ${slug} で共有画像を作る`);
