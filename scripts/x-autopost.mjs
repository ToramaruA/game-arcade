// Publish newly added games to the single X channel connected to Buffer.
// This file has no side effects when imported by unit tests.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from './config.js';

const GAMES_FILE = 'site/games/games.json';
const BUFFER_ENDPOINT = 'https://api.buffer.com';

export function newlyPublishedGames(previous, current) {
  const previousSlugs = new Set(previous.map((game) => game.slug));
  return current.filter((game) =>
    game.listed === true &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.slug) &&
    !previousSlugs.has(game.slug)
  );
}

// Conservative approximation of X's weighted character count: Japanese/emoji = 2,
// most ASCII = 1; links are treated as 23 characters.
export function makeAnnouncement(game, siteUrl = SITE_URL) {
  const url = siteUrl.replace(/\/$/, '') + '/games/' + game.slug + '/';
  const title = String(game.title || '').trim();
  const description = String(game.description || '').trim();
  if (!title || !description) throw new Error('Missing game title or description: ' + game.slug);
  const before = '🎮 新作ゲーム公開！\n\n' + title + '\n\n';
  const after = '\n\n▶ 今すぐ遊ぶ\n' + url;
  const weight = (text) => [...text].reduce((sum, ch) =>
    sum + (ch.codePointAt(0) > 0x7f ? 2 : 1), 0);
  // Reserve space for the URL (23) and leave margin for network count rules.
  const available = 245 - weight(before) - weight('\n\n▶ 今すぐ遊ぶ\n') - 23;
  if (available <= 0) throw new Error('Game title is too long for X: ' + game.slug);
  let shortened = '';
  for (const ch of [...description]) {
    if (weight(shortened + ch) > available - 2) break;
    shortened += ch;
  }
  if (shortened.length < description.length) shortened += '…';
  return { url, imageUrl: url + 'og.png', text: before + shortened + after };
}

export function alreadyAnnounced(posts, gameUrl) {
  return posts.some((post) => typeof post?.text === 'string' && post.text.includes(gameUrl));
}

async function bufferQuery(token, query, variables = {}) {
  const response = await fetch(BUFFER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Buffer API returned HTTP ' + response.status);
  const result = await response.json();
  if (result.errors?.length) {
    const first = result.errors[0];
    throw new Error('Buffer GraphQL error (' + (first.extensions?.code || 'unknown') + '): ' + first.message);
  }
  return result.data;
}

async function findXChannel(token) {
  const data = await bufferQuery(token, 'query { account { organizations { id } } }');
  const matches = [];
  for (const organization of data.account.organizations) {
    const channels = await bufferQuery(token,
      'query ($org: OrganizationId!) { channels(input: { organizationId: $org }) { id service isDisconnected isLocked } }',
      { org: organization.id });
    for (const channel of channels.channels || []) {
      if (channel.service === 'twitter') matches.push({ ...channel, organizationId: organization.id });
    }
  }
  if (matches.length !== 1) {
    throw new Error('Exactly one X channel is required, but found ' + matches.length +
      '. Do not guess the destination account.');
  }
  if (matches[0].isDisconnected || matches[0].isLocked) {
    throw new Error('The X channel in Buffer is disconnected or locked.');
  }
  return matches[0];
}

async function findExistingPost(token, channel, gameUrl) {
  let after = null;
  for (let page = 0; page < 20; page += 1) {
    const result = await bufferQuery(token,
      'query ($org: OrganizationId!, $ch: ChannelId!, $cursor: String) {' +
        ' posts(first: 50, after: $cursor, input: {' +
        ' organizationId: $org, filter: { channelIds: [$ch] } }) {' +
        ' edges { node { id text } } pageInfo { hasNextPage endCursor } } }',
      { org: channel.organizationId, ch: channel.id, cursor: after });
    const posts = result.posts;
    if (alreadyAnnounced((posts.edges || []).map((edge) => edge.node), gameUrl)) return true;
    if (!posts.pageInfo?.hasNextPage) return false;
    after = posts.pageInfo.endCursor;
    if (!after) throw new Error('Buffer pagination returned no next cursor.');
  }
  // Fail closed instead of risking a duplicate when history is large.
  throw new Error('Could not check all Buffer posts; aborting to prevent a duplicate.');
}

async function isDeployed(game, announcement) {
  try {
    const page = await fetch(announcement.url, { signal: AbortSignal.timeout(12000), redirect: 'follow' });
    if (!page.ok || !String(page.headers.get('content-type')).includes('text/html')) return false;
    const html = await page.text();
    // A successful status alone is insufficient; Cloudflare could serve a fallback page.
    if (!html.includes(announcement.url) || !html.includes('<title>')) return false;
    const image = await fetch(announcement.imageUrl, {
      method: 'HEAD', signal: AbortSignal.timeout(12000), redirect: 'follow'
    });
    return image.ok && String(image.headers.get('content-type')).includes('image/png');
  } catch {
    return false;
  }
}

async function waitForDeployment(game, announcement) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await isDeployed(game, announcement)) return;
    if (attempt < 23) await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  throw new Error('Cloudflare site/og.png not ready; no X post created for ' + game.slug);
}

async function publish(token, channel, announcement) {
  const input = {
    channelId: channel.id,
    text: announcement.text,
    schedulingType: 'automatic',
    mode: 'shareNow',
    assets: [{ image: { url: announcement.imageUrl } }],
  };
  const result = await bufferQuery(token,
    'mutation ($input: CreatePostInput!) { createPost(input: $input) {' +
    ' ... on PostActionSuccess { post { id status } }' +
    ' ... on MutationError { message } } }',
    { input });
  if (!result.createPost?.post?.id) {
    throw new Error('Buffer did not accept the post: ' +
      (result.createPost?.message || 'unknown error'));
  }
  console.log('Buffer accepted game announcement. Post ID: ' + result.createPost.post.id +
    '. X delivery status: ' + (result.createPost.post.status || 'not confirmed'));
}

export async function main() {
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    // Manual run is a safe, read-only preview; never publish existing games.
    const slug = process.env.PREVIEW_SLUG;
    const games = JSON.parse(readFileSync(GAMES_FILE, 'utf8'));
    const game = games.find((entry) => entry.slug === slug && entry.listed === true);
    if (!game) throw new Error('Unknown public game slug: ' + slug);
    console.log('DRY RUN ONLY: ' + JSON.stringify(makeAnnouncement(game), null, 2));
    return;
  }
  if (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Publishing is only allowed on pushes to main.');
  }
  const before = process.env.PUSH_BEFORE;
  const after = process.env.GITHUB_SHA;
  if (!/^[0-9a-f]{40}$/.test(before || '') || /^0{40}$/.test(before)) {
    throw new Error('Missing or invalid previous commit SHA; refusing to publish.');
  }
  if (!/^[0-9a-f]{40}$/.test(after || '')) throw new Error('Missing current commit SHA.');
  const previous = JSON.parse(execFileSync('git', ['show', before + ':' + GAMES_FILE], { encoding: 'utf8' }));
  const current = JSON.parse(readFileSync(GAMES_FILE, 'utf8'));
  const added = newlyPublishedGames(previous, current);
  if (added.length === 0) {
    console.log('No newly listed games. No X posts created.');
    return;
  }
  const token = process.env.BUFFER_API_KEY;
  if (!token) throw new Error('BUFFER_API_KEY secret is missing.');
  const channel = await findXChannel(token);
  for (const game of added) {
    const announcement = makeAnnouncement(game);
    await waitForDeployment(game, announcement);
    if (await findExistingPost(token, channel, announcement.url)) {
      console.log('Already posted; skipping: ' + game.slug);
      continue;
    }
    await publish(token, channel, announcement);
  }
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('X auto-post aborted: ' + error.message);
    process.exitCode = 1;
  });
}
