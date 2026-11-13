// Invoked from a restricted GitHub Actions issues event. API credentials are never logged.
import fs from 'node:fs';
import {reserveAttempt} from './clef-budget.mjs';
import {parseRequest,buildPayload,interpretResponse,resultComment} from './clef-game-judge-core.mjs';
import {parseDesignRequest,buildDesignPayload,interpretDesignResponse,designResultComment} from './clef-design-judge-core.mjs';

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
  let budgetReserved = false;
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
  try {
    const request = designMode ? parseDesignRequest(issue.body) : parseRequest(issue.body);
    if (designMode) revision = request.revision;
    const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!cloudflareToken || !accountId || !/^[a-zA-Z0-9_-]+$/.test(accountId)) throw new Error('Cloudflare secrets missing/invalid');
    const budget = await reserveAttempt({repo,issue:issue.number,token});
    if (!budget.allowed) {
      decision = {schema_version:1,...(designMode ? {phase:'design',revision} : {}),
        status:'deferred',reason:'Daily Clef planning limit reached (5 attempts). Keep this design; do not reject it.',
        retry_after:budget.retry_after};
    } else {
    budgetReserved = true;
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+'/ai/run/@cf/cloudflare/clef', {
      method:'POST',
      headers:{Authorization:'Bearer '+cloudflareToken,'Content-Type':'application/json'},
      body:JSON.stringify(designMode ? buildDesignPayload(request) : buildPayload(request)),
      signal:AbortSignal.timeout(90000),
    });
    if (!response.ok) throw new Error('Clef API HTTP '+response.status);
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
  if (budgetReserved) decision.budget_reserved = true;
  const post = await fetch(commentUrl,{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
    body:JSON.stringify({body:designMode ? designResultComment(decision) : resultComment(decision)}),
    signal:AbortSignal.timeout(30000),
  });
  if (!post.ok) throw new Error('GitHub comment API HTTP '+post.status);
  console.log('Clef '+(designMode ? 'design' : 'idea')+' review: '+decision.status+' (issue #'+issue.number+').');
  if (failed) process.exitCode = 1;
}
main().catch(e => { console.error('Review action failed: '+String(e.message).slice(0,100)); process.exitCode=1; });
