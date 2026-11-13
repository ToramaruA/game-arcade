import test from 'node:test';
import assert from 'node:assert/strict';
import {countAttempts,reserveAttempt,budgetWindow,MARKER} from '../scripts/clef-budget.mjs';
const clock=()=>new Date('2026-11-13T01:00:00Z');
const comment=(body,day='2026-11-13',login='github-actions[bot]')=>({body,created_at:day+'T00:30:00Z',user:{login}});
test('UTC reset is 09:00 JST, previous day does not count',()=>{
 assert.equal(budgetWindow(new Date('2026-11-12T23:59:59Z')).retry_after,'2026-11-13T00:00:00.000Z');
 assert.equal(countAttempts([comment(MARKER),comment(MARKER,'2026-11-12'),comment(MARKER,undefined,'ToramaruA')],'2026-11-13'),1);
});
test('legacy results count; reserved results and deferrals do not double count',()=>{
 const prefix='<!-- clef-game-design-review:v1 -->';
 assert.equal(countAttempts([comment(MARKER),comment(prefix+'{"status":"error","budget_reserved":true}'),comment(prefix+'{"status":"ok"}'),comment(prefix+'{"status":"deferred"}')],'2026-11-13'),2);
});
test('fifth attempt is reserved and sixth is blocked across issues',async()=>{
 const ledger=Array.from({length:4},()=>comment(MARKER));
 let posts=0;
 const fetchImpl=async(url,options)=>{
  if(options.method==='POST'){posts++;ledger.push(comment(JSON.parse(options.body).body));return {ok:true};}
  return {ok:true,json:async()=>ledger};
 };
 assert.equal((await reserveAttempt({repo:'o/r',issue:1,token:'test',fetchImpl,clock})).allowed,true);
 assert.equal((await reserveAttempt({repo:'o/r',issue:2,token:'test',fetchImpl,clock})).allowed,false);
 assert.equal(posts,1);
});
test('all comment pages counted',async()=>{
 let calls=0;
 const fetchImpl=async()=>({ok:true,json:async()=>++calls===1?Array.from({length:100},()=>comment('unrelated')):Array.from({length:5},()=>comment(MARKER))});
 assert.equal((await reserveAttempt({repo:'o/r',issue:1,token:'test',fetchImpl,clock})).allowed,false);
 assert.equal(calls,2);
});
test('lookup and reservation errors fail closed',async()=>{
 await assert.rejects(reserveAttempt({repo:'o/r',issue:1,token:'test',clock,fetchImpl:async()=>({ok:false})}),/lookup/);
 await assert.rejects(reserveAttempt({repo:'o/r',issue:1,token:'test',clock,fetchImpl:async(u,o)=>o.method?{ok:false}:{ok:true,json:async()=>[]}}),/reservation/);
});
