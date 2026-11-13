// Invoked from a restricted GitHub Actions issues event. API credentials are never logged.
import fs from 'node:fs';
import {quotaDeferral} from './clef-cloudflare-error.mjs';
import {findPriorDesignResult} from './clef-review-replay.mjs';
import {parseRequest,buildPayload,interpretResponse,resultComment} from './clef-game-judge-core.mjs';
import {parseDesignRequest,buildDesignPayload,interpretDesignResponse,designResultComment} from './clef-design-judge-core.mjs';

async function postRelay({repo,token,issueNumber,sourceCommentId,phase,revision,status}) {
  // GitHub PR conversation bot comments are supported as immediate ChatGPT event triggers.
  // Keep the actual Clef verdict on its original review Issue; the relay has metadata only.
  // PR #70 is a permanent, unmerged event bridge. It must remain open.
  const relayPayload = {
    schema_version: 1,
    source_issue: issueNumber,
    source_comment_id: sourceCommentId,
    phase,
    revision,
    status,
  };
  const commentUrl = 'https://api.github.com/repos/'+repo+'/issues/70/comments';
  const headers = {Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'};
  // A retry can reuse the same Clef result. Read the relay's existing comments
  // first so one source verdict never wakes ChatGPT twice.
  for (let page=1;page<=100;page++) {
    const check = await fetch(commentUrl+'?per_page=100&page='+page, {
      headers,signal:AbortSignal.timeout(30000),
    });
    if (!check.ok) throw new Error('Cannot check existing Clef relay HTTP '+check.status);
    const comments = await check.json();
    if (!Array.isArray(comments)) throw new Error('Invalid existing Clef relay comments');
    for (const comment of comments) {
      if (comment.user?.login !== 'github-actions[bot]' ||
          !comment.body?.startsWith('<!-- clef-review-relay:v1 -->\n')) continue;
      let existing;
      try { existing = JSON.parse(comment.body.slice('<!-- clef-review-relay:v1 -->\n'.length)); }
      catch { continue; }
      if (existing?.source_issue !== issueNumber ||
          existing?.source_comment_id !== sourceCommentId) continue;
      if (existing.schema_version !== 1 || existing.phase !== phase ||
          existing.revision !== revision || existing.status !== status) {
        throw new Error('Conflicting Clef relay for source comment '+sourceCommentId);
      }
      console.log('Clef result '+sourceCommentId+' is already relayed to PR #70; skip duplicate.');
      return;
    }
    if (comments.length < 100) break;
    if (page === 100) throw new Error('Too many relay comments to verify safely');
  }
  const relay = await fetch('https://api.github.com/repos/'+repo+'/issues/70/comments', {
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
    body:JSON.stringify({body:'<!-- clef-review-relay:v1 -->\n'+JSON.stringify(relayPayload)}),
    signal:AbortSignal.timeout(30000),
  });
  if (!relay.ok) throw new Error('ChatGPT wakeup relay HTTP '+relay.status);
}

async function main() {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const issue = event.issue;
  if (!issue || !issue.title?.startsWith('[CLEF-REVIEW] ') || issue.user?.login!=='ToramaruA' || issue.state!=='open') {
    throw new Error('Unauthorized or invalid issue event');
  }
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo!=='ToramaruA/game-arcade') throw new Error('Wrong repository');
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Missing GitHub token');
  const commentUrl = 'https://api.github.com/repos/'+repo+'/issues/'+issue.number+'/comments';
  let decision;
  let failed = false;
  // The same review issue moves from ideation to detailed design when its
  // JSON body is edited. Existing clients without a phase remain supported.
  let designMode = false;
  let revision = null;
  try {
    const object = JSON.parse(issue.body ?? '');
    designMode = object?.phase === 'design';
  } catch {
    // The original idea-review format may include a JSON code fence.
  }
  // Same-revision retries after relay failure re-use the existing Clef result.
  if (designMode) {
    const parsed = parseDesignRequest(issue.body);
    revision = parsed.revision;
    const previous = await findPriorDesignResult({
      commentUrl, revision,
      headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28'},
    });
    if (previous) {
      await postRelay({repo,token,issueNumber:issue.number,sourceCommentId:previous.id,
        phase:'design',revision,status:previous.status});
      console.log('Recovered existing Clef result and relayed to PR #70 without another API call.');
      return;
    }
  }
  try {
    const request = designMode ? parseDesignRequest(issue.body) : parseRequest(issue.body);
    if (designMode) revision = request.revision;
    const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!cloudflareToken || !accountId || !/^[a-zA-Z0-9_-]+$/.test(accountId)) throw new Error('Cloudflare secrets missing/invalid');
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+'/ai/run/@cf/cloudflare/clef', {
      method:'POST',
      headers:{Authorization:'Bearer '+cloudflareToken,'Content-Type':'application/json'},
      body:JSON.stringify(designMode ? buildDesignPayload(request) : buildPayload(request)),
      signal:AbortSignal.timeout(90000),
    });
    if (!response.ok) {
      let quota = null;
      if (response.status === 429) {
        let errorBody = null;
        try { errorBody = await response.json(); } catch { /* Non-JSON error is not quota proof. */ }
        quota = quotaDeferral(response.status, errorBody);
      }
      if (quota) {
        decision = {schema_version:1,...(designMode ? {phase:'design',revision} : {}),...quota};
      } else {
        throw new Error('Clef API HTTP '+response.status);
      }
    } else {
      const json = await response.json();
      decision = designMode ? interpretDesignResponse(request,json) : interpretResponse(request,json);
    }
  } catch (e) {
    failed = true;
    // Only an allowlisted failure description, not raw model input, response or credentials.
    const msg = String(e.message||'unknown');
    const safe = /^(Clef API HTTP \d{3}|Clef .*invalid|Clef response missing answers|.*(missing|invalid|long|schema_version|candidates|IDs|Duplicate|field|JSON object|characters).*)$/.test(msg) ? msg.slice(0,160) : 'review failed (inspect protected workflow logs)';
    decision = {schema_version:1,...(designMode ? {phase:'design',revision} : {}),status:'error',reason:safe};
  }
  const post = await fetch(commentUrl,{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
    body:JSON.stringify({body:designMode ? designResultComment(decision) : resultComment(decision)}),
    signal:AbortSignal.timeout(30000),
  });
  if (!post.ok) throw new Error('GitHub comment API HTTP '+post.status);
  const postedComment = await post.json();
  if (!Number.isSafeInteger(postedComment?.id) || postedComment?.user?.login !== 'github-actions[bot]') {
    throw new Error('GitHub result comment response invalid; relay not posted');
  }

  await postRelay({repo,token,issueNumber:issue.number,sourceCommentId:postedComment.id,
    phase:designMode?'design':'idea',revision:designMode?revision:null,status:decision.status});
  console.log('Clef '+(designMode ? 'design' : 'idea')+' review: '+decision.status+' (issue #'+issue.number+'); event relay posted to PR #70.');
  if (failed) process.exitCode = 1;
}
main().catch(e => { console.error('Review action failed: '+String(e.message).slice(0,100)); process.exitCode=1; });
