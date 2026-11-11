// Pure helpers: no API calls, no secrets.
export const REVIEW_MARKER = '<!-- clef-game-idea-review:v1 -->';
const FIELDS = ['title','genre','core_loop','one_minute','highlight','replay','visual','feasibility'];

export function parseRequest(body) {
  if (typeof body !== 'string' || body.length > 18000) throw new Error('Review body missing or too long');
  const fence = String.fromCharCode(96).repeat(3);
  const trimmed = body.trim();
  const source = trimmed.startsWith(fence) ? trimmed.replace(new RegExp('^'+fence+'(?:json)?\\s*\\n','i'), '').replace(new RegExp('\\n'+fence+'\\s*$'), '') : trimmed;
  let obj;
  try { obj = JSON.parse(source); } catch { throw new Error('Review body must contain a JSON object'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.schema_version !== 1) {
    throw new Error('Expected schema_version: 1');
  }
  if (typeof obj.context !== 'string' || !obj.context.trim() || obj.context.length > 2000) {
    throw new Error('context must be a non-empty string (max 2000 characters)');
  }
  if (!Array.isArray(obj.candidates) || obj.candidates.length < 2 || obj.candidates.length > 6) {
    throw new Error('Provide 2 to 6 candidates');
  }
  const ids = new Set();
  for (const [i,c] of obj.candidates.entries()) {
    if (!c || typeof c !== 'object' || Array.isArray(c) || c.id !== String.fromCharCode(65+i)) {
      throw new Error('Candidate IDs must be consecutive A, B, C ...');
    }
    if (ids.has(c.id)) throw new Error('Duplicate candidate ID');
    ids.add(c.id);
    for (const field of FIELDS) {
      if (typeof c[field] !== 'string' || !c[field].trim() || c[field].length > 850) {
        throw new Error('Invalid candidate field: '+field);
      }
    }
  }
  return {schema_version:1,context:obj.context,candidates:obj.candidates.map(c => ({id:c.id,...Object.fromEntries(FIELDS.map(f=>[f,c[f].trim()]))}))};
}

export const RUBRICS = {
  gameplay: [
    '0: Almost passive or no meaningful input',
    '1: One trivial repeated action; no consequential decisions',
    '2: Some choices but usually one obvious solution',
    '3: Frequent decisions with noticeable tradeoffs and player agency',
    '4: Varied meaningful decisions, changing circumstances, and strategic depth',
  ],
  replay: [
    '0: No reason to return after first look',
    '1: Very short surprise with little replay value',
    '2: Some variation but repeated play becomes predictable',
    '3: Several unlocks/challenges/meaningful variation across plays',
    '4: Strong discovery, progression and varied goals over 30+ minutes',
  ],
  visual: [
    '0: No distinct visual hook or unclear presentation',
    '1: Generic or visually confusing concept',
    '2: Some attractive imagery, weak readability',
    '3: Distinctive and readable visual identity',
    '4: Instantly recognizable, appealing, coherent visual world',
  ],
  share: [
    '0: No outcome worth showing someone',
    '1: Little variation between people\'s results',
    '2: Occasionally interesting results',
    '3: Distinct achievements/outcomes worth sharing',
    '4: Strong surprise, emergent story and easy-to-share outcomes',
  ],
};
export function buildPayload(request) {
  const state = {
    role: 'Independent critical game concept evaluator. Judge actual play, not the quality of sales language. Never assume unmentioned features exist.',
    context: request.context,
    candidates: request.candidates,
  };
  const questions = {
    preferred: {
      type:'choice',
      instructions: 'Which candidate is most likely to make a genuinely fun browser game for first-time players who continue for 10 to 30 minutes? Prefer sustained meaningful action and clear rules over flashy one-off ideas. Compare the entire state fairly.',
      criteria: Object.fromEntries(request.candidates.map(c=>[c.id,c.title+': '+c.genre+'; '+c.core_loop+'; replay: '+c.replay])),
    },
  };
  for (const c of request.candidates) {
    for (const [key,rubric] of Object.entries(RUBRICS)) {
      questions[c.id+'_'+key] = {
        type:'score',
        instructions: 'Evaluate ONLY candidate '+c.id+' ('+c.title+') for '+key+', using its actual mechanics and content; do not reward promises unsupported by the concrete design. Context contains all candidates for fair comparison.',
        criteria:rubric,
      };
    }
  }
  return {model:'clef',state,questions};
}

export function interpretResponse(request, apiResponse) {
  const root = apiResponse?.result ?? apiResponse;
  if (apiResponse?.success === false || !root?.answers) throw new Error('Clef response missing answers');
  const choice = root.answers.preferred;
  const ids = request.candidates.map(c=>c.id);
  if (choice?.type !== 'choice' || !ids.includes(choice.choice)) throw new Error('Clef choice answer invalid');
  const probabilities = {};
  for (const id of ids) {
    const p = choice.probabilities?.[id];
    if (!Number.isFinite(p) || p<0 || p>1) throw new Error('Clef choice probability invalid');
    probabilities[id] = Number(p.toFixed(4));
  }
  const ranking = request.candidates.map(c => {
    const scores = {};
    for (const key of Object.keys(RUBRICS)) {
      const a = root.answers[c.id+'_'+key];
      if (a?.type !== 'score' || !Number.isFinite(a.score) || a.score<0 || a.score>4) {
        throw new Error('Clef '+c.id+'_'+key+' score invalid');
      }
      scores[key] = Number(a.score.toFixed(3));
    }
    const weighted = Number((scores.gameplay*.45 + scores.replay*.25 + scores.visual*.15 + scores.share*.15).toFixed(3));
    const eligible = scores.gameplay>=2.5 && scores.replay>=2;
    return {id:c.id,title:c.title,scores,weighted,eligible};
  }).sort((a,b)=>b.weighted-a.weighted);
  const candidate = ranking.find(c=>c.id===choice.choice);
  const backup = ranking.find(c=>c.eligible);
  const winner = candidate.eligible ? candidate.id : (backup?.id??null);
  return {
    schema_version:1,
    status:winner ? 'ok' : 'revise',
    selected:winner,
    clef_preferred:choice.choice,
    choice_probabilities:probabilities,
    ranking,
    note:winner===choice.choice ? 'Clef preferred option passes the minimum gameplay/replay check.' :
      winner ? 'Clef preferred option failed the minimum gameplay/replay check; highest eligible weighted option shown for review.' :
      'No candidate passed the minimum gameplay/replay check. Revise candidates before creating a [GAME] issue.',
  };
}

export function resultComment(result) {
  const fence = String.fromCharCode(96).repeat(3);
  const lines = [
    REVIEW_MARKER,
    result.status==='error'?'## Clef review: ERROR':result.status==='revise'?'## Clef review: REVISE':'## Clef review: OK',
    '',
    'Machine-readable decision (scores are model estimates, not measured player enjoyment):',
    '',
    fence+'json',JSON.stringify(result,null,2),fence,
  ];
  if (Array.isArray(result.ranking)) {
    lines.push('','| Candidate | Gameplay | Replay | Visual | Share | Weighted | Pass |',
      '|---|---:|---:|---:|---:|---:|---|');
    for (const c of result.ranking) {
      const safe = String(c.title).replace(/[|\x60\r\n]/g,' ').slice(0,80);
      lines.push('| '+c.id+': '+safe+' | '+c.scores.gameplay+' | '+c.scores.replay+' | '+c.scores.visual+' | '+c.scores.share+' | '+c.weighted+' | '+(c.eligible?'yes':'no')+' |');
    }
  }
  lines.push('','The final game concept must still undergo detailed design and critique. Never treat probability as proof that a game is fun.');
  return lines.join('\n');
}
