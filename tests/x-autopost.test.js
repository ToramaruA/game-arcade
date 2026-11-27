import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newlyPublishedGames, makeAnnouncement, alreadyAnnounced, readPromo, announcementFor, validatePromoText } from '../scripts/x-autopost.mjs';

const game = {
  slug: 'another-world',
  listed: true,
  title: '不思議な世界',
  description: 'とても長い冒険'.repeat(80),
};

test('only newly added, listed games are announced', () => {
  const previous = [{ slug: 'older', listed: true }];
  const current = [
    { slug: 'older', listed: true, title: 'Edited' },
    game,
    { slug: 'hidden', listed: false },
  ];
  assert.deepEqual(newlyPublishedGames(previous, current).map((entry) => entry.slug), ['another-world']);
});

test('a newly listed existing game is not re-announced', () => {
  const previous = [{ slug: 'older', listed: false }];
  const current = [{ slug: 'older', listed: true }];
  assert.deepEqual(newlyPublishedGames(previous, current), []);
});

test('announcement contains game link, image, title, and shortened description', () => {
  const post = makeAnnouncement(game, 'https://game-arcade-bdt.pages.dev/');
  assert.equal(post.url, 'https://game-arcade-bdt.pages.dev/games/another-world/');
  assert.equal(post.imageUrl, post.url + 'og.png');
  assert.match(post.text, /不思議な世界/);
  assert.match(post.text, /…/);
  assert.ok([...post.text].length < 260);
});

test('previous Buffer posts with the same URL suppress duplicates', () => {
  const url = 'https://game-arcade-bdt.pages.dev/games/another-world/';
  assert.ok(alreadyAnnounced([{ text: '遊ぼう！ ' + url, id: 'a' }], url));
  assert.equal(alreadyAnnounced([{ text: '別のゲーム', id: 'b' }], url), false);
});

test('missing title or description fails closed', () => {
  assert.throws(() => makeAnnouncement({ slug: 'valid', title: '', description: 'test' }));
});

test('custom illustration and copy are selected together with the canonical link', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x-promo-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const folder = path.join(root, game.slug, 'promo');
  fs.mkdirSync(folder, { recursive: true });
  const site = 'https://example.com/';
  assert.equal(announcementFor(game, site, root).imageUrl, site + 'games/another-world/og.png');
  fs.writeFileSync(path.join(folder, 'x-post.txt'), '雲の上で冒険しよう。');
  assert.throws(() => readPromo(game.slug, root), /Incomplete/);
  assert.equal(announcementFor(game, site, root).imageUrl, site + 'games/another-world/og.png');
  fs.writeFileSync(path.join(folder, 'x-main.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0l8AAAAASUVORK5CYII=', 'base64'));
  const post = announcementFor(game, site, root);
  assert.equal(post.imageUrl, post.url + 'promo/x-main.png');
  assert.equal(post.text, '雲の上で冒険しよう。\n\n' + post.url);
  assert.ok(alreadyAnnounced([{ text: post.text }], post.url));
  fs.writeFileSync(path.join(folder, 'x-main.png'), 'not a PNG');
  assert.throws(() => readPromo(game.slug, root), /PNG/);
  assert.equal(announcementFor(game, site, root).imageUrl, post.url + 'og.png');
});

test('custom text reserves room for the link and rejects URLs', () => {
  assert.equal(validatePromoText('鳥'.repeat(110)).length, 110);
  assert.throws(() => validatePromoText('鳥'.repeat(111)));
  assert.throws(() => validatePromoText('遊ぶ https://example.com/'));
  assert.throws(() => validatePromoText('  '));
});

test('committed promo assets, if present, form a valid pair', () => {
  const games = JSON.parse(fs.readFileSync('site/games/games.json', 'utf8'));
  for (const entry of games) readPromo(entry.slug);
});
