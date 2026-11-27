// Buffer の投稿実績レポート（通信はモック。実 API は呼ばない）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertReadOnly, classifyMetric, run, analyze, format } from '../scripts/x-metrics-report.mjs';

const TOKEN = 'secret-token-xyz';
const BASE = 'https://game-arcade-bdt.pages.dev/games/';
const games = [
  { slug: 'moonlit-lighthouse', title: '月下の灯台', listed: true },
  { slug: 'wind-garden', title: '風の庭', listed: true },
];

const sentPosts = [
  { id: 'p1', text: '灯台を守ろう\n\n' + BASE + 'moonlit-lighthouse/', status: 'sent', sentAt: '2026-11-15T03:00:00Z', dueAt: '2026-11-15T02:59:00Z',
    metricsUpdatedAt: '2026-11-20T00:00:00Z',
    metrics: [{ type: 'impressions', name: 'Impressions', value: 120, unit: 'count' }, { type: 'likes', name: 'Likes', value: 3, unit: 'count' }, { type: 'clicks', name: 'Clicks', value: 2, unit: 'count' }] },
  { id: 'p2', text: '別の告知 ' + BASE + 'unknown-game/', status: 'sent', sentAt: null, dueAt: '2026-11-18T00:00:00Z', metricsUpdatedAt: null, metrics: [] },
];
const errorPost = { id: 'p3', text: '失敗した投稿', status: 'error', sentAt: null, dueAt: null, metricsUpdatedAt: null, metrics: null };

function mockBuffer({ introspection = true, statusFilter = true, channels = [{ id: 'ch1', service: 'twitter' }] } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const { query, variables } = JSON.parse(init.body);
    calls.push({ query, variables, auth: init.headers.Authorization });
    const ok = (data) => ({ ok: true, json: async () => ({ data }) });
    const gqlError = (message) => ({ ok: true, json: async () => ({ errors: [{ message, extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }] }) });
    if (query.includes('__type')) {
      if (!introspection) return gqlError('Introspection disabled');
      if (variables.n) return ok({ __type: { fields: ['type', 'name', 'value', 'unit'].map((name) => ({ name })) } });
      return ok({ __type: { fields: ['id', 'text', 'status', 'sentAt', 'dueAt', 'metricsUpdatedAt'].map((name) => ({ name, type: { kind: 'SCALAR', name: 'String' } }))
        .concat({ name: 'metrics', type: { kind: 'LIST', name: null, ofType: { kind: 'OBJECT', name: 'PostMetric' } } }) } });
    }
    if (query.includes('organizations')) return ok({ account: { organizations: [{ id: 'org1' }] } });
    if (query.includes('channels(')) return ok({ channels });
    if (query.includes('posts(')) {
      if (query.includes('status: [sent]')) {
        if (!statusFilter) return gqlError('Unknown field status');
        // 2 pages to check pagination
        if (!variables.cursor) return ok({ posts: { edges: [{ node: sentPosts[0] }], pageInfo: { hasNextPage: true, endCursor: 'c1' } } });
        return ok({ posts: { edges: [{ node: sentPosts[1] }], pageInfo: { hasNextPage: false, endCursor: null } } });
      }
      return ok({ posts: { edges: [...sentPosts, errorPost].map((node) => ({ node })), pageInfo: { hasNextPage: false } } });
    }
    throw new Error('unexpected query ' + query);
  };
  return { calls, fetchImpl };
}

test('mutation や subscription は送る前に止める', () => {
  assert.throws(() => assertReadOnly('mutation { createPost(input: {}) { id } }'));
  assert.throws(() => assertReadOnly('  # c\nmutation X { deletePost }'));
  assert.throws(() => assertReadOnly('query { a } mutation { b }'));
  assert.doesNotThrow(() => assertReadOnly('query ($a: String) { posts { id } }'));
});

test('汎用 clicks はリンククリックと断定しない', () => {
  assert.equal(classifyMetric({ type: 'clicks', name: 'Clicks' }), 'genericClicks');
  assert.equal(classifyMetric({ type: 'link_clicks', name: 'Link clicks' }), 'linkClicks');
  assert.equal(classifyMetric({ type: 'url_clicks' }), 'linkClicks');
  assert.equal(classifyMetric({ type: 'impressions' }), 'impressions');
  assert.equal(classifyMetric({ type: 'retweets' }), 'engagement');
});

test('送信済み投稿と指標を読み、欠損は 0 にしない・失敗を分けて数える', async () => {
  const { calls, fetchImpl } = mockBuffer();
  const { report, text } = await run({ token: TOKEN, fetchImpl, games });
  for (const c of calls) {
    assert.doesNotMatch(c.query, /mutation/i, '読み取りだけ');
    assert.equal(c.auth, 'Bearer ' + TOKEN);
  }
  assert.ok(calls.some((c) => c.query.includes('status: [sent]') && c.variables.cursor === 'c1'), '次のページも読む');
  assert.equal(report.sentCount, 2);
  assert.equal(report.withMetrics, 1);
  assert.equal(report.withoutMetrics, 1);
  assert.equal(report.failedCount, 1);
  assert.deepEqual(report.byStatus, { sent: 2, error: 1 });
  assert.deepEqual(report.categories.impressions, ['impressions']);
  assert.deepEqual(report.categories.genericClicks, ['clicks']);
  assert.deepEqual(report.categories.linkClicks, []);
  assert.deepEqual(report.gamesWithoutSentPost, ['wind-garden']);
  assert.equal(report.rows[0].slug, 'moonlit-lighthouse');
  assert.equal(report.rows[0].sentAt, '2026-11-15T03:00:00Z');
  // 文面
  assert.ok(!text.includes(TOKEN));
  assert.match(text, /リンククリック.*取得不可/);
  assert.match(text, /汎用クリック.*取得できた（clicks）/);
  assert.match(text, /\| p2 \| unknown-game \|.*\| 取得不可 \| 2026-11-18T00:00:00Z \| 未更新 \| 空（未更新） \|/);
  assert.match(text, /Impressions（impressions） 120/);
  assert.doesNotMatch(text.split('\n').find((l) => l.startsWith('| p2')), /\b0\b/);
});

test('スキーマを調べられない・status で絞れないときも、公式例の項目で読む', async () => {
  const { calls, fetchImpl } = mockBuffer({ introspection: false, statusFilter: false });
  const { report, text } = await run({ token: TOKEN, fetchImpl, games });
  assert.equal(report.fields.introspected, false);
  assert.ok(calls.some((c) => c.query.includes('posts(') && c.query.includes('metricsUpdatedAt') && c.query.includes('metrics { type name value unit }')));
  assert.equal(report.sentCount, 2);
  assert.match(text, /sentAt）：API にない（dueAt は予定時刻/);
});

test('X チャンネルが1つでなければ止まる（推測しない）', async () => {
  const none = mockBuffer({ channels: [{ id: 'a', service: 'instagram' }] });
  await assert.rejects(run({ token: TOKEN, fetchImpl: none.fetchImpl }), /found 0/);
  const two = mockBuffer({ channels: [{ id: 'a', service: 'twitter' }, { id: 'b', service: 'twitter' }] });
  await assert.rejects(run({ token: TOKEN, fetchImpl: two.fetchImpl }), /found 2/);
});

test('鍵がなければ通信せずに止まる', async () => {
  let called = false;
  await assert.rejects(run({ token: '', fetchImpl: async () => { called = true; } }), /BUFFER_API_KEY/);
  assert.equal(called, false);
});

test('metrics 自体が API にない投稿は「取得不可」', () => {
  const report = analyze({ sent: [{ id: 'x', text: 't' }], all: [], fields: { scalars: [], metrics: [], introspected: true }, sentComplete: true, allComplete: true });
  const text = format(report);
  assert.match(text, /metrics：API にない/);
  assert.match(text, /\| x \| （URLなし） \| t \| 取得不可 \| 取得不可 \| 未更新 \| 取得不可 \|/);
});

test('手動実行だけで、読み取り権限だけのワークフロー', () => {
  const yml = readFileSync(new URL('../.github/workflows/x-metrics-check.yml', import.meta.url), 'utf8');
  assert.match(yml, /workflow_dispatch/);
  assert.doesNotMatch(yml, /schedule:|push:|pull_request/);
  assert.match(yml, /permissions:\n  contents: read\n\n/);
  assert.doesNotMatch(yml, /write/);
});
