// Read-only report of X posts sent through Buffer and the metrics Buffer exposes for them.
// It never creates, deletes, schedules or edits posts: every request is a GraphQL `query`,
// checked by assertReadOnly() before it is sent.
// Usage (GitHub Actions, manual only): BUFFER_API_KEY=... node scripts/x-metrics-report.mjs
// Buffer's API is experimental, so the Post fields are discovered by introspection and
// anything Buffer does not return is reported as "not available", never as 0.
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BUFFER_ENDPOINT = 'https://api.buffer.com';
const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const NA = '取得不可';

// Optional Post fields we ask for when the schema has them (id and text are required).
const SCALAR_FIELDS = ['status', 'sentAt', 'dueAt', 'createdAt', 'updatedAt', 'metricsUpdatedAt', 'channelId'];
const METRIC_FIELDS = ['type', 'name', 'value', 'unit'];

export function assertReadOnly(query) {
  const text = String(query).replace(/#[^\n]*/g, '').trim();
  if (!/^(query\b|\{)/.test(text) || /\bmutation\b|\bsubscription\b/i.test(text)) {
    throw new Error('Refusing to send a non-read-only GraphQL operation.');
  }
}

export function makeClient(token, fetchImpl = fetch) {
  if (!token) throw new Error('BUFFER_API_KEY secret is missing.');
  return async function bufferQuery(query, variables = {}) {
    assertReadOnly(query);
    const response = await fetchImpl(BUFFER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Buffer API returned HTTP ' + response.status);
    const result = await response.json();
    if (result.errors?.length) {
      const first = result.errors[0];
      const error = new Error('Buffer GraphQL error (' + (first.extensions?.code || 'unknown') + '): ' +
        String(first.message || '').replaceAll(token, '***'));
      error.graphql = true;
      throw error;
    }
    return result.data;
  };
}

const unwrap = (type) => { let t = type; while (t?.ofType) t = t.ofType; return t; };

// Which Post fields (and metric subfields) exist. Falls back to Buffer's documented example.
export async function discoverPostFields(q) {
  const fallback = { scalars: ['status', 'dueAt', 'metricsUpdatedAt'], metrics: METRIC_FIELDS, introspected: false };
  let post;
  try {
    post = (await q('query { __type(name: "Post") { fields { name type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } }')).__type;
  } catch (error) {
    if (!error.graphql) throw error;
    return fallback;
  }
  if (!post?.fields?.length) return fallback;
  const names = new Map(post.fields.map((f) => [f.name, f]));
  const scalars = SCALAR_FIELDS.filter((name) => names.has(name));
  let metrics = [];
  const metricType = names.has('metrics') ? unwrap(names.get('metrics').type) : null;
  if (metricType?.name) {
    try {
      const sub = (await q('query ($n: String!) { __type(name: $n) { fields { name } } }', { n: metricType.name })).__type;
      const subNames = new Set((sub?.fields || []).map((f) => f.name));
      metrics = METRIC_FIELDS.filter((name) => subNames.has(name));
    } catch (error) {
      if (!error.graphql) throw error;
      metrics = METRIC_FIELDS;
    }
  }
  return { scalars, metrics, introspected: true };
}

export function postSelection(fields) {
  const metrics = fields.metrics.length ? ' metrics { ' + fields.metrics.join(' ') + ' }' : '';
  return 'id text ' + fields.scalars.join(' ') + metrics;
}

export async function findXChannel(q) {
  const data = await q('query { account { organizations { id } } }');
  const matches = [];
  for (const organization of data?.account?.organizations || []) {
    const channels = await q(
      'query ($org: OrganizationId!) { channels(input: { organizationId: $org }) { id service isDisconnected isLocked } }',
      { org: organization.id });
    for (const channel of channels?.channels || []) {
      if (['twitter', 'x'].includes(String(channel.service).toLowerCase())) matches.push({ ...channel, organizationId: organization.id });
    }
  }
  if (matches.length !== 1) {
    throw new Error('Exactly one X channel is required, but found ' + matches.length + '. Not guessing the account.');
  }
  return matches[0];
}

export async function fetchPosts(q, channel, fields, status = null) {
  const statusFilter = status ? ', status: [' + status + ']' : '';
  const query = 'query ($org: OrganizationId!, $ch: ChannelId!, $cursor: String) {' +
    ' posts(first: ' + PAGE_SIZE + ', after: $cursor, input: { organizationId: $org,' +
    ' filter: { channelIds: [$ch]' + statusFilter + ' } }) {' +
    ' edges { node { ' + postSelection(fields) + ' } } pageInfo { hasNextPage endCursor } } }';
  const posts = [];
  let after = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = (await q(query, { org: channel.organizationId, ch: channel.id, cursor: after })).posts;
    posts.push(...(result?.edges || []).map((edge) => edge.node));
    if (!result?.pageInfo?.hasNextPage) return { posts, complete: true };
    after = result.pageInfo.endCursor;
    if (!after) break;
  }
  return { posts, complete: false };
}

// Only explicit link/URL clicks count as link clicks; a bare "clicks" is kept separate.
export function classifyMetric(metric) {
  const key = (String(metric?.type || '') + ' ' + String(metric?.name || '')).toLowerCase();
  if (/impression|view|reach/.test(key)) return 'impressions';
  if (/link|url/.test(key) && /click/.test(key)) return 'linkClicks';
  if (/click/.test(key)) return 'genericClicks';
  if (/like|favorite|repl|comment|retweet|repost|quote|share|bookmark|engagement|reaction/.test(key)) return 'engagement';
  return 'other';
}

export const CATEGORY_LABELS = {
  impressions: '表示回数（impressions 相当）',
  engagement: '反応（いいね・返信・リポスト等）',
  linkClicks: 'リンククリック（type/name に link・url を明示）',
  genericClicks: '汎用クリック（リンククリックとは断定しない）',
  other: 'その他',
};

const SLUG_IN_URL = /\/games\/([a-z0-9]+(?:-[a-z0-9]+)*)\//;
const isNumber = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

export function analyze({ sent, all, fields, sentComplete, allComplete, games = [] }) {
  const titles = Object.fromEntries(games.map((g) => [g.slug, g.title]));
  const byStatus = {};
  for (const post of all || []) {
    const s = post.status || '（status 取得不可）';
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  const failed = (all || []).filter((p) => /error|fail/i.test(String(p.status || '')));
  const seen = Object.fromEntries(Object.keys(CATEGORY_LABELS).map((k) => [k, new Set()]));
  const rows = (sent || []).map((post) => {
    const slug = SLUG_IN_URL.exec(String(post.text || ''))?.[1] || null;
    const metrics = Array.isArray(post.metrics) ? post.metrics : null;
    const valued = (metrics || []).filter((m) => isNumber(m.value));
    for (const m of valued) seen[classifyMetric(m)].add(m.type || m.name || '?');
    return {
      id: post.id,
      slug,
      title: slug ? titles[slug] || null : null,
      excerpt: String(post.text || '').split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 30) || '',
      sentAt: post.sentAt ?? null,
      dueAt: post.dueAt ?? null,
      metricsUpdatedAt: post.metricsUpdatedAt ?? null,
      metrics,
      hasMetrics: valued.length > 0,
    };
  });
  const announced = new Set(rows.map((r) => r.slug).filter(Boolean));
  return {
    fields,
    byStatus,
    failedCount: failed.length,
    sentCount: rows.length,
    withMetrics: rows.filter((r) => r.hasMetrics).length,
    withoutMetrics: rows.filter((r) => !r.hasMetrics).length,
    complete: sentComplete && allComplete,
    rows,
    categories: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v].sort()])),
    gamesWithoutSentPost: games.filter((g) => g.listed === true && !announced.has(g.slug)).map((g) => g.slug),
  };
}

const metricText = (m) => {
  const label = m.name || m.type || '?';
  const type = m.type && m.name && m.type !== m.name ? '（' + m.type + '）' : '';
  const value = isNumber(m.value) ? String(m.value) + (m.unit && m.unit !== 'count' ? ' ' + m.unit : '') : NA;
  return label + type + ' ' + value;
};

export function format(report) {
  const lines = [];
  const f = report.fields;
  lines.push('## Buffer の X 投稿実績（読み取りのみ）', '');
  lines.push('- 取得方法：' + (f.introspected ? 'スキーマを調べて、ある項目だけを取得' : 'スキーマを調べられず、公式例の項目で取得'));
  lines.push('- 送信時刻（sentAt）：' + (f.scalars.includes('sentAt') ? 'API にある' : 'API にない（dueAt は予定時刻で、実際の送信時刻ではない）'));
  lines.push('- metrics：' + (f.metrics.length ? 'API にある（' + f.metrics.join('/') + '）' : 'API にない'));
  if (!report.complete) lines.push('- ⚠ 投稿が多く、全件は取得できていない（件数は下限）');
  lines.push('');
  lines.push('### 件数', '');
  lines.push('- 送信済み（status: sent）：' + report.sentCount + ' 件');
  lines.push('  - 数値の metrics あり：' + report.withMetrics + ' 件／なし・未更新：' + report.withoutMetrics + ' 件（0 とは見なさない）');
  lines.push('- 配信失敗（status に error/fail）：' + report.failedCount + ' 件');
  const statuses = Object.entries(report.byStatus).sort((a, b) => b[1] - a[1]);
  lines.push('- 全投稿の status 内訳：' + (statuses.length ? statuses.map(([s, n]) => s + ' ' + n).join('、') : 'なし'));
  if (report.gamesWithoutSentPost.length) lines.push('- 送信済み投稿が見つからない公開作品：' + report.gamesWithoutSentPost.join(', '));
  lines.push('');
  lines.push('### 取得できた指標の種類', '');
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    const types = report.categories[key];
    if (key === 'other' && !types.length) continue;
    lines.push('- ' + label + '：' + (types.length ? '取得できた（' + types.join(', ') + '）' : NA));
  }
  lines.push('');
  lines.push('### 投稿ごと', '');
  lines.push('| 投稿ID | 作品 | 冒頭 | 送信時刻 | 予定時刻(dueAt) | 指標の更新 | 指標 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  const cell = (s) => String(s).replace(/\|/g, '｜').replace(/\n/g, ' ');
  for (const r of report.rows) {
    const metrics = r.metrics === null ? NA : r.metrics.length ? r.metrics.map(metricText).join('／') : '空（未更新）';
    lines.push('| ' + [r.id, r.slug || '（URLなし）', r.excerpt, r.sentAt || NA, r.dueAt || NA, r.metricsUpdatedAt || '未更新', metrics].map(cell).join(' | ') + ' |');
  }
  if (!report.rows.length) lines.push('| — | — | 送信済みの投稿なし | — | — | — | — |');
  lines.push('');
  lines.push('※ 新規投稿・削除・予約・設定変更は一切していない。取得できない値は 0 にせず「' + NA + '」「未更新」と表示している。');
  return lines.join('\n');
}

export async function run({ token, fetchImpl = fetch, games = [] }) {
  const q = makeClient(token, fetchImpl);
  const channel = await findXChannel(q);
  const fields = await discoverPostFields(q);
  const all = await fetchPosts(q, channel, fields, null);
  let sent;
  try {
    sent = await fetchPosts(q, channel, fields, 'sent');
  } catch (error) {
    // If the status filter is not supported, fall back to the status field of all posts.
    if (!error.graphql || !fields.scalars.includes('status')) throw error;
    sent = { posts: all.posts.filter((p) => String(p.status).toLowerCase() === 'sent'), complete: all.complete };
  }
  const report = analyze({ sent: sent.posts, all: all.posts, fields, sentComplete: sent.complete, allComplete: all.complete, games });
  return { report, text: format(report), channelState: { disconnected: !!channel.isDisconnected, locked: !!channel.isLocked } };
}

export async function main() {
  const token = process.env.BUFFER_API_KEY;
  let games = [];
  try { games = JSON.parse(readFileSync('site/games/games.json', 'utf8')); } catch { /* optional */ }
  const { text, channelState } = await run({ token, games });
  console.log('Buffer API: OK. X channel: 1 found (disconnected: ' + channelState.disconnected + ', locked: ' + channelState.locked + ')');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const token = process.env.BUFFER_API_KEY;
    console.error('X metrics report failed (nothing was posted or changed): ' +
      (token ? String(error.message).replaceAll(token, '***') : error.message));
    process.exitCode = 1;
  });
}
