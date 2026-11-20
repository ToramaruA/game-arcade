// アクセスのまとめの集計と文面（通信はしない）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, format, windows } from '../scripts/analytics-report.mjs';

const games = [
  { slug: 'moonlit-lighthouse', title: '月下の灯台', listed: true, added: '2026-11-14' },
  { slug: 'sunlit-giant-movers', title: '巨獣の引越し屋', listed: true, added: '2026-11-18' },
];
const host = 'game-arcade-bdt.pages.dev';
const data = (rows, refs = []) => ({ viewer: { accounts: [{ byPath: rows, byRef: refs }] } });
const row = (h, p, c, v) => ({ count: c, sum: { visits: v }, dimensions: { requestHost: h, requestPath: p } });

test('本番のページだけを、ゲームごととトップに分けて数える（プレビューは除く）', () => {
  const s = summarize(data([
    row(host, '/', 10, 8), row(host, '/games/moonlit-lighthouse/', 30, 20), row(host, '/games/moonlit-lighthouse/index.html', 5, 1),
    row(host, '/games/sunlit-giant-movers/', 12, 9), row('claude-x.game-arcade-bdt.pages.dev', '/games/moonlit-lighthouse/', 99, 99),
  ], [
    { count: 7, dimensions: { requestHost: host, refererHost: 'x.com' } },
    { count: 3, dimensions: { requestHost: host, refererHost: host } },
  ]), host, games);
  assert.equal(s.pv, 57); assert.equal(s.top, 10);
  assert.deepEqual(s.games.map((g) => [g.slug, g.pv, g.visits]), [['moonlit-lighthouse', 35, 21], ['sunlit-giant-movers', 12, 9]]);
  assert.deepEqual(s.refs, [['x.com', 7]], 'サイト内の移動は除く');
});

test('まとめの文面：先週比・公開からの日数・アクセスのないゲームも載せる', () => {
  const cur = summarize(data([row(host, '/games/moonlit-lighthouse/', 30, 20)]), host, games);
  const prev = summarize(data([row(host, '/games/moonlit-lighthouse/', 20, 10)]), host, games);
  const now = new Date('2026-11-23T00:00:00Z');
  const text = format({ cur, prev, win: windows(now), games, now });
  assert.match(text, /アクセスの記録（11\/16〜11\/22）/);
  assert.match(text, /\| 1 \| 月下の灯台 \| 30 \| \+50% \| 20 \| 9日 \|/);
  assert.match(text, /\| 2 \| 巨獣の引越し屋 \| 0 \| — \| 0 \| 5日 \|/);
  assert.match(text, /公開2週間以内/);
});
