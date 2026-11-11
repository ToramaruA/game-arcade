// Detailed game design gate for the same [CLEF-REVIEW] issue used for idea selection.
export const DESIGN_MARKER = '<!-- clef-game-design-review:v1 -->';
export const DESIGN_FIELDS = [
  'title','genre','player_goal','core_decisions','first_30_seconds',
  'minute_by_minute','short_and_long_loops','levels_and_content',
  'difficulty_progression','control_feedback','start_screen','climax_screen',
  'failure_and_retry','replay_motivation','technical_scope','critical_review','fun_explanation'
];
export const DESIGN_RUBRICS = {
  depth: [
    '0: Little or no player agency; mostly watching or clicking through',
    '1: Repeated trivial choices with one obvious answer',
    '2: Some tradeoffs but the same strategy repeatedly wins',
    '3: Several meaningful choices per minute; risks and tradeoffs change',
    '4: Strong evolving decisions with multiple viable strategies and mastery',
  ],
  longevity: [
    '0: A one-off gimmick that is exhausted in one minute',
    '1: Content and choices are quickly repeated with no fresh challenge',
    '2: Some variety, but likely becomes predictable within ten minutes',
    '3: Designed content, challenges and meaningful progression last 10-30 minutes',
    '4: Sustained discovery and varied interesting decisions over 30+ minutes',
  ],
  clarity: [
    '0: Controls, goals and feedback are unspecified',
    '1: First-time users cannot tell what to do',
    '2: Explains the goal but tutorial or screen readability is weak',
    '3: First 30 seconds demonstrate the goal and controls naturally',
    '4: Excellent teach-by-doing introduction with intuitive controls and feedback',
  ],
  progression: [
    '0: No clear progress, achievements, feedback or learning',
    '1: Repetition without a difficulty or discovery curve',
    '2: Progression exists but lacks motivating rewards or new decisions',
    '3: Difficulty grows meaningfully, with learning and satisfying payoffs',
    '4: Carefully paced mastery, surprising discoveries and substantial rewards',
  ],
  coherence: [
    '0: Rules, content and interface contradict each other',
    '1: Critical mechanics or consequences are unspecified',
    '2: Design has substantial gaps or mismatched rewards and mechanics',
    '3: Mechanics, levels, rewards and screens are mostly coherent',
    '4: Complete, internally consistent playable design with feasible scope',
  ],
};
const THRESHOLDS = {depth:2.5,longevity:2.5,clarity:2,progression:2,coherence:2.5};
export const READY_THRESHOLD = 0.7;

export function parseDesignRequest(body) {
  if (typeof body !== 'string' || body.length > 42000) throw new Error('Design body missing or too long');
  const trim = body.trim();
  // JSON-only request. Avoid markdown escaping ambiguity or partial snapshots.
  let r;
  try { r=JSON.parse(trim); } catch { throw new Error('Design body must be a JSON object'); }
  if (!r || Array.isArray(r) || r.schema_version!==1 || r.phase!=='design') throw new Error('Expected phase: design and schema_version: 1');
  if (!Number.isSafeInteger(r.revision) || r.revision<1 || r.revision>100) throw new Error('revision must be a positive integer');
  if (typeof r.context!=='string' || !r.context.trim() || r.context.length>2500) throw new Error('Invalid design context');
  if (typeof r.selection_record!=='string' || !r.selection_record.trim() || r.selection_record.length>12000) throw new Error('Invalid selection_record');
  if (typeof r.idea_review_url!=='string' || !/^https:\/\/github\.com\/ToramaruA\/game-arcade\/issues\/\d+$/.test(r.idea_review_url)) throw new Error('Invalid idea_review_url');
  if (!r.selected_idea || typeof r.selected_idea!=='object' || !/^[A-F]$/.test(r.selected_idea.id) ||
      typeof r.selected_idea.title!=='string' || !r.selected_idea.title.trim() || r.selected_idea.title.length>160) throw new Error('Invalid selected_idea');
  const d=r.design;
  if (!d || typeof d!=='object' || Array.isArray(d)) throw new Error('Missing design');
  for (const field of DESIGN_FIELDS) {
    if (typeof d[field]!=='string' || !d[field].trim() || d[field].length>3500) throw new Error('Invalid design field: '+field);
  }
  return {
    schema_version:1,phase:'design',revision:r.revision,
    context:r.context.trim(),selection_record:r.selection_record.trim(),idea_review_url:r.idea_review_url,
    selected_idea:{id:r.selected_idea.id,title:r.selected_idea.title.trim()},
    design:Object.fromEntries(DESIGN_FIELDS.map(k=>[k,d[k].trim()])),
  };
}

export function buildDesignPayload(req) {
  const questions={};
  for (const [metric,criteria] of Object.entries(DESIGN_RUBRICS)) {
    questions[metric] = {
      type:'score',
      instructions:'Evaluate the detailed browser game design for '+metric+'. Use ONLY explicitly specified mechanics and scenes. Assess how this will play, not how convincing the proposal sounds. For uncertainty or missing concrete content, prefer the lower score.',
      criteria,
    };
  }
  questions.ready_to_build={
    type:'noul',
    instructions:'Based on the actual game design, is it ready to implement as an engaging, understandable browser game with meaningful decisions and enough content for 10 to 30 minutes? Answer YES only if the core interaction, first 30 seconds, levels, progression, failure/retry and UI are concretely specified and mutually consistent. Ignore attractive promises.',
  };
  return {
    model:'clef',
    state:{
      role:'Independent critical pre-production game designer. No code execution or playtesting: judge only supplied design.',
      context:req.context,chosen_idea:req.selected_idea,
      design:req.design,
    },
    questions,
  };
}
export function interpretDesignResponse(req,apiResponse) {
  const root=apiResponse?.result??apiResponse;
  if (apiResponse?.success===false || !root?.answers) throw new Error('Clef design response missing answers');
  const scores={};
  for (const key of Object.keys(DESIGN_RUBRICS)) {
    const answer=root.answers[key];
    if (answer?.type!=='score' || !Number.isFinite(answer.score) || answer.score<0 || answer.score>4) {
      throw new Error('Clef design score invalid: '+key);
    }
    scores[key]=Number(answer.score.toFixed(3));
  }
  const n=root.answers.ready_to_build;
  if (n?.type!=='noul' || !Number.isFinite(n.noul) || n.noul<0 || n.noul>1) {
    throw new Error('Clef design readiness probability invalid');
  }
  const readiness=Number(n.noul.toFixed(4));
  const weak=Object.keys(THRESHOLDS).filter(k=>scores[k]<THRESHOLDS[k]);
  const passed=weak.length===0 && readiness>=READY_THRESHOLD;
  const overall=Number((Object.values(scores).reduce((a,b)=>a+b,0)/Object.keys(scores).length).toFixed(3));
  return {
    schema_version:1,phase:'design',revision:req.revision,
    status:passed?'ok':'revise',ready_to_build_probability:readiness,minimum_ready_probability:READY_THRESHOLD,
    scores,score_average:overall,minimum_scores:THRESHOLDS,weak_areas:weak,
    note:passed?'Passes provisional design-review thresholds; this is not a substitute for playtesting.':
      'Revise the lowest-scoring areas and re-submit the same issue with revision incremented. Clef does not provide written design fixes.',
  };
}
export function designResultComment(result) {
  const fence=String.fromCharCode(96).repeat(3);
  const lines=[
    DESIGN_MARKER,
    '## Clef detailed design review: '+result.status.toUpperCase(),
    '',
    'This is an estimate from a text-based model, not a measurement from gameplay.',
    '',
    fence+'json',JSON.stringify(result,null,2),fence,
  ];
  if (result.scores) {
    lines.push('','| Criterion | Score (0–4) | Minimum |',
      '|---|---:|---:|');
    for (const [k,v] of Object.entries(result.scores)) lines.push('| '+k+' | '+v+' | '+THRESHOLDS[k]+' |');
    lines.push('','Ready-to-build YES score: '+(100*result.ready_to_build_probability).toFixed(1)+'% (provisional threshold '+(100*READY_THRESHOLD)+'%).');
    lines.push('','If revisions are needed, interpret the weak scores with ChatGPT and update the design. No explanation is generated by Clef itself.');
  }
  return lines.join('\n');
}
