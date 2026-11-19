// 画面のボタンを1つずつ押して、「見えているのに押せない」「押しても何も起きない」「エラーが出る」を見つける（スマホの大きさ）。
// 時間がかかるので、この仕組みより前に作られたゲームは対象外。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameDirs } from './helpers.js';
import { startServer } from '../scripts/serve.js';
import { uiCheck } from '../scripts/ui-check.mjs';

const BEFORE_UI_CHECK = ['abyssal-signal', 'wind-garden', 'moonlight-heist', 'gaze-atelier', 'mist-whale-thread-hero', 'thunderbird-sky-fleet'];

for (const slug of gameDirs().filter((s) => !BEFORE_UI_CHECK.includes(s))) {
  test(`${slug}: 見えているボタンはすべて押せて、押すと何かが起きる`, { timeout: 300000 }, async () => {
    const { server, url } = await startServer();
    try {
      const r = await uiCheck(slug, { pc: false, base: url });
      assert.ok(r.checked.length > 0, 'ボタンが1つも見つからない');
      assert.deepEqual(r.problems, [], r.problems.join('\n'));
    } finally { server.close(); }
  });
}
