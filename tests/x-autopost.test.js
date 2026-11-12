import test from 'node:test';
import assert from 'node:assert/strict';
import { newlyPublishedGames, makeAnnouncement, alreadyAnnounced } from '../scripts/x-autopost.mjs';

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
