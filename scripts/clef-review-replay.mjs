// Reuse a completed Clef design decision after a relay failure.
// Do not charge another Clef attempt just to deliver a GitHub event.
export function latestMatchingDesignResult(comments, revision) {
  for (const c of [...comments].reverse()) {
    if (c.user?.login !== 'github-actions[bot]' ||
        !c.body?.startsWith('<!-- clef-game-design-review:v1 -->')) continue;
    const match = c.body.match(/```json\s*([\s\S]*?)\s*```/);
    if (!match) continue;
    let decision;
    try { decision=JSON.parse(match[1]); } catch { continue; }
    if (decision?.schema_version!==1 || decision?.phase!=='design' ||
        decision.revision!==revision ||
        !['ok','revise'].includes(decision.status)) continue;
    if (!Number.isSafeInteger(c.id)) continue;
    return {id:c.id, status:decision.status};
  }
  return null;
}

export async function findPriorDesignResult({commentUrl,headers,revision,fetchImpl=fetch}) {
  const comments=[];
  for(let page=1;page<=100;page++){
    const separator=commentUrl.includes('?')?'&':'?';
    const response=await fetchImpl(commentUrl+separator+'per_page=100&page='+page,
      {headers,signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error('Cannot verify existing Clef verdict');
    const batch=await response.json();
    if(!Array.isArray(batch)) throw new Error('Invalid Clef comment list');
    comments.push(...batch);
    if(batch.length<100) return latestMatchingDesignResult(comments,revision);
  }
  throw new Error('Too many Clef comments to check safely');
}
