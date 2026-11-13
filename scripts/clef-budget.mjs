// Repository-wide reservations. Caller must serialize all planning review jobs.
export const LIMIT = 5;
export const MARKER = '<!-- clef-budget-reservation:v1 -->';
export function budgetWindow(now = new Date()) {
  const day = now.toISOString().slice(0,10);
  return {day, since:day+'T00:00:00Z', retry_after:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString()};
}
export function countAttempts(comments, day) {
  return comments.filter(c => {
    if (c.user?.login !== 'github-actions[bot]' || c.created_at?.slice(0,10) !== day) return false;
    const body=c.body || '';
    if (body.startsWith(MARKER)) return true;
    // Count calls made before this budget was installed, without double-counting new results.
    return /^<!-- clef-game-(idea|design)-review:v1 -->/.test(body) &&
      !/"budget_reserved":\s*true/.test(body) && /"status":\s*"(ok|revise|error)"/.test(body);
  }).length;
}
export async function reserveAttempt({repo,issue,token,fetchImpl=fetch,clock=()=>new Date()}) {
  const w=budgetWindow(clock());
  const base='https://api.github.com/repos/'+repo;
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  let used=0;
  for(let page=1;;page++) {
    const res=await fetchImpl(base+'/issues/comments?since='+encodeURIComponent(w.since)+'&per_page=100&page='+page,{headers,signal:AbortSignal.timeout(30000)});
    if(!res.ok) throw new Error('Budget lookup failed');
    const comments=await res.json();
    if(!Array.isArray(comments)) throw new Error('Budget response invalid');
    used+=countAttempts(comments,w.day);
    if(used>=LIMIT) return {allowed:false,...w,used};
    if(comments.length<100) break;
  }
  if(budgetWindow(clock()).day!==w.day) throw new Error('Budget day changed; retry later');
  const res=await fetchImpl(base+'/issues/'+issue+'/comments',{
    method:'POST',headers,signal:AbortSignal.timeout(30000),
    body:JSON.stringify({body:MARKER+'\n'+JSON.stringify({day:w.day,attempt:used+1,limit:LIMIT})+'\nClef API attempt reserved (failures also consume this slot).'})
  });
  if(!res.ok) throw new Error('Budget reservation failed');
  if(budgetWindow(clock()).day!==w.day) throw new Error('Budget day changed; retry later');
  return {allowed:true,...w,used:used+1};
}
