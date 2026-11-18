# 自動プレイヤー（ゲームごと）

ゲームを作ったら、`tests/autoplay/<slug>.mjs` に自動プレイヤーを置く。
`npm run autoplay -- <slug>` で戦法ごとの勝ち数を表にし、`npm test` で最低限の約束を確かめる。
ゲームのルールは毎回違うので、自動プレイヤーはゲームごとに書く（共通なのは下の形と、表を出すコマンドだけ）。

## 書く形

```js
// ステージ（面・夜・章など）。name は表に出す名前
export const stages = [{ id: 0, name: '第1夜' }, ...];

// 戦法。kind は次の3種類を、それぞれ1つ以上
//   noop  … 何もしない（または最低限の操作だけ）。これで勝てる面があってはいけない
//   naive … 1つの戦法だけ・でたらめ など、遊びの核を使わない遊び方
//   core  … 遊びの核を使う遊び方（Issue の「遊びの核」で考えて決める判断をする）
export const strategies = [
  { id: 'noop', name: '何もしない', kind: 'noop' },
  { id: 'redOnly', name: '赤だけ', kind: 'naive' },
  { id: 'full', name: '網目＋合図', kind: 'core' },
];

// 1回遊ぶ。同じ (stage, strategy, seed) なら同じ結果になること（乱数は seed から作る）
// 戻り値：{ win: boolean, score?: number, note?: string }
export function play(stage, strategy, seed) { ... }
```

- ルールは `logic.js`（DOM なし）にあるので、ブラウザなしで速く何度も遊ばせられる。
- 1回の `play` は1秒以内を目安にする（表を作るのに 面の数 × 戦法 × 回数 だけ呼ぶ）。
- 自動プレイヤーは上手でなくてよい。「戦法の違いで勝ちやすさがどう変わるか」を比べるためのもの。

## 見るところ（`npm run autoplay` が判定も出す）
1. **何もしないで勝てる面がない**（あれば、その面は遊ばなくても終わる）。
2. **1つの戦法だけでほとんど勝ててしまわない**（naive の勝率が高すぎると、考える意味がない）。
3. **遊びの核を使うほど勝てる**（core の勝ち数が naive より多い）。
4. 面が進むほど勝ちにくくなる（最初の面は core ならほぼ勝てる）。
