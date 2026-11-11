import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRequest,buildPayload,interpretResponse,resultComment,REVIEW_MARKER} from '../scripts/clef-game-judge-core.mjs';
const candidates = ['A','B'].map((id,i)=>({
  id, title:'Test '+id,genre:'Puzzle',core_loop:i?'Tap and watch':'Move and choose routes',
  one_minute:'Choose a route and act',highlight:'A risky decision',replay:'Levels change',
  visual:'Colorful maze with clear controls',feasibility:'HTML5 canvas and JS',
}));
const request = {schema_version:1, context:'Prefer meaningful interactive play over passive spectacle',candidates};
test('request schema validation and bounded questions',()=>{
  assert.deepEqual(parseRequest(JSON.stringify(request)),request);
  assert.equal(Object.keys(buildPayload(request).questions).length,9);
  assert.throws(()=>parseRequest(JSON.stringify({...request,candidates:[{...candidates[0],id:'Q'},candidates[1]]})),/IDs/);
  assert.throws(()=>parseRequest('not json'),/JSON/);
  assert.throws(()=>parseRequest(JSON.stringify({...request,candidates:[candidates[0]]})),/2 to 6/);
});
test('Clef responses are parsed and checked, with no fictitious explanation',()=>{
  const answers = {preferred:{type:'choice',choice:'A',probabilities:{A:0.8,B:0.2}}};
  for(const [id,val] of [['A',3.5],['B',1.5]]) {
    for(const metric of ['gameplay','replay','visual','share']) answers[id+'_'+metric]={type:'score',score:val};
  }
  const result=interpretResponse(request,{success:true,result:{answers}});
  assert.equal(result.selected,'A');
  assert.equal(result.status,'ok');
  assert.equal(result.ranking[0].id,'A');
  assert.ok(resultComment(result).includes(REVIEW_MARKER));
  answers.A_gameplay.score=0.5;
  const reassessed=interpretResponse(request,{result:{answers}});
  assert.equal(reassessed.selected,null);
  assert.equal(reassessed.status,'revise');
  answers.A_gameplay.score=3.5;
  delete answers.B_replay;
  assert.throws(()=>interpretResponse(request,{result:{answers}}),/score invalid/);
});
