// ブラウザを使わない構成チェック。全ゲームに共通の約束ごとを確かめる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SLUG_PATTERN } from '../scripts/config.js';
import { ROOT, GAMES_DIR, readManifest, gameDirs } from './helpers.js';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // Cloudflare Pages の1ファイル上限

test('games.json と site/games/ のディレクトリが一致する', () => {
  const manifest = readManifest();
  assert.ok(Array.isArray(manifest), 'games.json は配列');
  const slugs = manifest.map((g) => g.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slug が重複している');
  assert.deepEqual([...slugs].sort(), gameDirs().sort());
  for (const g of manifest) {
    assert.match(g.slug, SLUG_PATTERN, `slug "${g.slug}" は a-z0-9 と - のみ`);
    assert.ok(g.title?.trim(), `${g.slug}: title が空`);
    assert.ok(g.description?.trim(), `${g.slug}: description が空`);
  }
});

test('トップページが存在する', () => {
  const html = fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8');
  assert.match(html, /<title>[^<]+<\/title>/);
});

for (const slug of gameDirs()) {
  test(`${slug}: 単独の作品ページとしての要件を満たす`, () => {
    const dir = path.join(GAMES_DIR, slug);
    const htmlPath = path.join(dir, 'index.html');
    assert.ok(fs.existsSync(htmlPath), 'index.html がない');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.match(html, /<html[^>]*\slang="[^"]+"/, 'html に lang がない');
    assert.match(html, /<title>[^<]+<\/title>/, 'title がない');
    assert.match(html, /<meta name="viewport"/, 'viewport がない');
    assert.match(html, /<meta name="description" content="[^"]+"/, 'description がない');
    assert.match(html, /<meta property="og:title" content="[^"]+"/, 'og:title がない');
    assert.match(html, /<meta property="og:image" content="[^"]*\/games\/[^"]+\/og\.png"/, 'og:image がない');
    assert.ok(fs.existsSync(path.join(dir, 'og.png')), 'og.png がない（npm run og -- <slug>）');
    assert.doesNotMatch(html, /\{\{\w+\}\}/, 'テンプレートの置換漏れ');
    assert.doesNotMatch(html, /<script[^>]+src="(https?:)?\/\//, '外部スクリプトは使わない');
    assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"[^>]+href="(https?:)?\/\//, '外部CSSは使わない');
  });

  test(`${slug}: ファイルサイズが上限内`, () => {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of walk(path.join(GAMES_DIR, slug))) {
      assert.ok(fs.statSync(f).size < MAX_FILE_BYTES, `${path.relative(ROOT, f)} が大きすぎる`);
    }
  });
}
