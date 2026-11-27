// 自動プレイヤーの約束ごと（tests/autoplay/README.md）。新しいゲームには自動プレイヤーを置く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, gameDirs } from './helpers.js';
import { checkPlayer, loadPlayer } from '../scripts/autoplay.mjs';

// この仕組みより前に作られたゲーム（自動プレイヤーなしでよい）
const BEFORE_AUTOPLAY = ['abyssal-signal', 'wind-garden', 'moonlight-heist', 'gaze-atelier', 'mist-whale-thread-hero', 'thunderbird-sky-fleet'];

for (const slug of gameDirs()) {
  const file = path.join(ROOT, 'tests', 'autoplay', `${slug}.mjs`);
  if (BEFORE_AUTOPLAY.includes(slug) && !fs.existsSync(file)) continue;
  test(`${slug}: 自動プレイヤーの形式が正しく、指定された放置検証を満たす`, async () => {
    assert.ok(fs.existsSync(file), `tests/autoplay/${slug}.mjs がない（tests/autoplay/README.md の形で作る）`);
    const mod = await loadPlayer(file);
    assert.deepEqual(checkPlayer(mod), [], '自動プレイヤーの形');
    // 放置で勝てないことが仕様上必要な作品だけ、この戦法を明示的に登録する。
    for (const sg of mod.strategies.filter((s) => s.kind === 'noop')) {
      for (const st of mod.stages) {
        const r = mod.play(st, sg, 1);
        assert.equal(typeof r?.win, 'boolean', 'play の戻り値に win（true/false）がない');
        assert.equal(r.win, false, `「${sg.name}」で ${st.name} に勝ててしまう`);
      }
    }
  });
}
