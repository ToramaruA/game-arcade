import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDesignRequest,buildDesignPayload,interpretDesignResponse,
  designResultComment,DESIGN_MARKER,DESIGN_FIELDS,DESIGN_RUBRICS
} from '../scripts/clef-design-judge-core.mjs';

const design=Object.fromEntries(DESIGN_FIELDS.map(f=>[f,'Concrete '+f+' description with interactions, level mechanics and consequences.']));
const request={
  schema_version:1,phase:'design',revision:1,context:'Evaluate sustained gameplay, not pitch language.',
  idea_review_url:'https://github.com/ToramaruA/game-arcade/issues/60',
  selected_idea:{id:'A',title:'Night Maze'},design,
};
function answerSet(score=3.2,yes=0.85) {
  const answers={};
  for(const key of Object.keys(DESIGN_RUBRICS)) answers[key]={type:'score',score};
  answers.ready_to_build={type:'noul',noul:yes};
  return {success:true,result:{answers}};
}
test('design JSON schema is validated, with revision required for re-review',()=>{
  assert.deepEqual(parseDesignRequest(JSON.stringify(request)),request);
  assert.equal(Object.keys(buildDesignPayload(request).questions).length,6);
  assert.equal(buildDesignPayload(request).questions.ready_to_build.type,'noul');
  assert.throws(()=>parseDesignRequest(JSON.stringify({...request,revision:0})),/revision/);
  assert.throws(()=>parseDesignRequest(JSON.stringify({...request,design:{...design,core_decisions:''}})),/core_decisions/);
  assert.throws(()=>parseDesignRequest(JSON.stringify({...request,phase:'idea'})),/phase/);
  assert.throws(()=>parseDesignRequest(JSON.stringify({...request,idea_review_url:'https://evil.example/'})),/idea_review_url/);
  assert.throws(()=>parseDesignRequest(JSON.stringify({...request,design:{...design,start_screen:'X'.repeat(3501)}})),/start_screen/);
});
test('high scores and sufficient yes probability pass production gate',()=>{
  const result=interpretDesignResponse(request,answerSet());
  assert.equal(result.status,'ok');
  assert.equal(result.revision,1);
  assert.equal(result.weak_areas.length,0);
  assert.ok(designResultComment(result).startsWith(DESIGN_MARKER));
});
test('low gameplay or readiness blocks production and identifies weak areas',()=>{
  const bad=answerSet();
  bad.result.answers.depth.score=1.2;
  const r=interpretDesignResponse(request,bad);
  assert.equal(r.status,'revise');
  assert.deepEqual(r.weak_areas,['depth']);
  const reluctant=interpretDesignResponse(request,answerSet(3.2,0.2));
  assert.equal(reluctant.status,'revise');
  assert.deepEqual(reluctant.weak_areas,[]);
});
test('malformed or missing Clef answers never pass',()=>{
  const bad=answerSet();
  delete bad.result.answers.longevity;
  assert.throws(()=>interpretDesignResponse(request,bad),/score invalid/);
  const badNoul=answerSet();
  badNoul.result.answers.ready_to_build.noul=NaN;
  assert.throws(()=>interpretDesignResponse(request,badNoul),/readiness probability invalid/);
  assert.throws(()=>interpretDesignResponse(request,{success:false,result:{}}),/missing answers/);
});
