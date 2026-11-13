import test from 'node:test';
import assert from 'node:assert/strict';
import {latestMatchingDesignResult,findPriorDesignResult} from '../scripts/clef-review-replay.mjs';
const mk=(id,rev,status='revise',actor='github-actions[bot]')=>({
  id,user:{login:actor},body:'<!-- clef-game-design-review:v1 -->\n'+
  '\`\`\`json\n'+JSON.stringify({schema_version:1,phase:'design',revision:rev,status})+'\n\`\`\`'
});
test('replay only matching latest finalized bot decision',()=>{
 assert.deepEqual(latestMatchingDesignResult([mk(1,1),mk(2,2),mk(3,2,'error'),mk(4,2,'revise','user')],2),{id:2,status:'revise'});
 assert.equal(latestMatchingDesignResult([mk(1,1),mk(2,2,'deferred')],2),null);
});
test('replay does not require a new API reservation',async()=>{
 const calls=[];
 const result=await findPriorDesignResult({commentUrl:'https://api.github.com/repos/a/b/issues/68/comments',headers:{Authorization:'Bearer test'},revision:2,
 fetchImpl:async (u,o)=>{calls.push({u,o});return {ok:true,json:async()=>[mk(12,2,'ok')]};}});
 assert.deepEqual(result,{id:12,status:'ok'});assert.equal(calls.length,1);
 assert.ok(calls[0].u.includes('per_page=100'));assert.equal(calls[0].o.method,undefined);
});
test('failure to read result blocks replay',async()=>{
 await assert.rejects(findPriorDesignResult({commentUrl:'x',headers:{},revision:2,fetchImpl:async()=>({ok:false})}),/Cannot verify/);
});
