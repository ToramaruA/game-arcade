// 画面に依存しないゲームのルール。Node のテストからも import できるよう DOM を触らない。
// 距離は 0=遠 / 1=中 / 2=近。すべて決定的で、隠れた乱数は使わない。

export const MAX_HULL = 7;
export const MAX_STIMULI = 3;
export const DIST_LABEL = ['遠', '中', '近'];
export const STIMULI = ['light', 'sound', 'wait'];
export const STIMULUS_LABEL = { light: '照らす', sound: '音を鳴らす', wait: '静かに待つ' };

// 刺激ごとの距離の変化（接近 +1 / 維持 0 / 後退 -1）
export const SPECIES = {
  A: { name: 'リボンレイ', damage: 1, react: { light: 1, sound: -1, wait: 0 } },
  B: { name: '鎧クラゲ', damage: 2, react: { light: 0, sound: 1, wait: -1 } },
  C: { name: '海底の王', damage: 3, react: { light: -1, sound: 0, wait: 1 } },
};

// base: 遠・中・近の基礎点。ピントで +1（最大 5）。
export const ENCOUNTERS = [
  { depth: 600, species: 'A', target: '全身', base: [1, 4, 2] },
  { depth: 1200, species: 'B', target: '殻の模様', base: [1, 2, 4] },
  { depth: 1800, species: 'A', target: '発光器官', base: [1, 2, 4] },
  { depth: 2400, species: 'B', target: '捕食姿勢', base: [1, 4, 2] },
  { depth: 3000, species: 'C', target: '頭部', base: [1, 2, 4] },
];

export const ROUTES = [
  { id: 'standard', name: '標準', alert: [0, 0, 0, 0, 0] },
  { id: 'shell', name: '殻の共鳴', alert: [0, 1, 0, 0, 0] },
  { id: 'glow', name: '発光の潮', alert: [0, 0, 1, 0, 0] },
];

export const MAX_QUALITY = 25;

export const clampDist = (d) => Math.max(0, Math.min(2, d));
export const routeById = (id) => ROUTES.find((r) => r.id === id) ?? ROUTES[0];
export const cueOf = (delta) => (delta > 0 ? 'approach' : delta < 0 ? 'retreat' : 'hold');
export const CUE_LABEL = { approach: '近づいた', hold: '動かず見ている', retreat: '離れた' };

export function newGame(routeId = 'standard') {
  const route = routeById(routeId);
  return {
    route: route.id,
    index: 0,
    dist: 0,
    focus: 0,
    used: 0,
    hull: MAX_HULL,
    photos: [], // 撮影済み（1深度1枚）
    shotTaken: false, // 撮影を選んだ瞬間にロック
    over: null, // null | 'returned' | 'lost'
    log: [],
    lastCue: null,
  };
}

export const encounterOf = (s) => ENCOUNTERS[s.index];
export const alertOf = (s) => routeById(s.route).alert[s.index];

// 刺激 kind を行った結果（状態は変えない）。予告表示にも実処理にも同じ関数を使う。
export function preview(s, kind) {
  const enc = encounterOf(s);
  const sp = SPECIES[enc.species];
  const delta = sp.react[kind];
  const dist = clampDist(s.dist + delta);
  const damage = dist === 2 ? sp.damage + alertOf(s) : 0;
  const hullAfter = s.hull - damage;
  const focus = dist !== s.dist ? 0 : delta === 0 ? 1 : s.focus;
  return { kind, delta, dist, damage, hullAfter, focus, lethal: hullAfter <= 0, cue: cueOf(delta) };
}

export function canStimulate(s) {
  return !s.over && !s.shotTaken && s.used < MAX_STIMULI;
}

// 致死の操作は confirmLethal=true でないと通らない。
export function stimulate(s, kind, confirmLethal = false) {
  if (!STIMULI.includes(kind)) return { ok: false, reason: 'unknown' };
  if (s.over) return { ok: false, reason: 'over' };
  if (s.shotTaken) return { ok: false, reason: 'locked' };
  if (s.used >= MAX_STIMULI) return { ok: false, reason: 'no-stimuli' };
  const p = preview(s, kind);
  if (p.lethal && !confirmLethal) return { ok: false, reason: 'needs-confirm' };
  const enc = encounterOf(s);
  const hull = Math.max(0, p.hullAfter);
  const next = {
    ...s,
    dist: p.dist,
    focus: p.focus,
    used: s.used + 1,
    hull,
    lastCue: p.cue,
    over: p.lethal ? 'lost' : null,
    log: [...s.log, { depth: enc.depth, kind, cue: p.cue, damage: p.damage, dist: p.dist }],
  };
  return { ok: true, state: next, damage: p.damage, cue: p.cue };
}

export function quality(enc, dist, focus) {
  return enc.base[dist] + (focus ? 1 : 0);
}

export function isLastEncounter(s) {
  return s.index === ENCOUNTERS.length - 1;
}

export function snapshot(s) {
  const enc = encounterOf(s);
  return {
    index: s.index,
    depth: enc.depth,
    species: enc.species,
    target: enc.target,
    dist: s.dist,
    focus: s.focus,
    quality: quality(enc, s.dist, s.focus),
    hullAtShot: s.hull,
  };
}

// 撮影。mode: 'next' | 'return'。最終深度は 'return' のみ。撮影で損傷はない。
export function shoot(s, mode) {
  if (s.over) return { ok: false, reason: 'over' };
  if (s.shotTaken) return { ok: false, reason: 'locked' };
  if (mode !== 'next' && mode !== 'return') return { ok: false, reason: 'unknown' };
  if (mode === 'next' && isLastEncounter(s)) return { ok: false, reason: 'last' };
  const photos = [...s.photos, snapshot(s)];
  if (mode === 'return') {
    return { ok: true, state: { ...s, photos, shotTaken: true, over: 'returned' } };
  }
  return {
    ok: true,
    state: { ...s, photos, shotTaken: true, log: [...s.log] },
  };
}

// 撮影ロックを解いて次の遭遇へ。撮影していなければ進めない。
export function advance(s) {
  if (s.over || !s.shotTaken || isLastEncounter(s)) return { ok: false, reason: 'cannot' };
  return {
    ok: true,
    state: { ...s, index: s.index + 1, dist: 0, focus: 0, used: 0, shotTaken: false, lastCue: null },
  };
}

// 結果。ロスト時の写真は「未回収」で、合計・枚数には入れない。
export function summarize(s) {
  const returned = s.over === 'returned';
  const kept = returned ? s.photos : [];
  return {
    returned,
    lost: s.over === 'lost',
    route: s.route,
    total: kept.reduce((a, p) => a + p.quality, 0),
    count: kept.length,
    depth: encounterOf(s).depth,
    hull: s.hull,
    photos: s.photos,
    lastPhoto: s.photos[s.photos.length - 1] ?? null,
  };
}

export function shareText(s, photo) {
  const sum = summarize(s);
  const name = SPECIES[photo?.species]?.name;
  if (sum.lost) return `${sum.depth}mで探査艇ロスト。写真は未回収。深海、未確認反応`;
  if (!photo) return '深海、未確認反応';
  return `${photo.depth}mで${name}を撮影。耐久${sum.hull}で帰還。深海、未確認反応`;
}

// 航路別ベスト（帰還時のみ更新）
export function updateBest(best, summary) {
  if (!summary.returned) return { best, isNew: false };
  if (best == null || summary.total > best) return { best: summary.total, isNew: true };
  return { best, isNew: false };
}

// 全刺激列と撮影時点を列挙する（テスト・表示文の根拠用）。
// 各深度で: 刺激 0〜3 回 → 撮影して次へ/帰還。状態を (深度, 距離, ピント, 使用数, 耐久) で
// メモ化し、そこから先に得られる最高の観測品質合計を求める。allowDamage=false なら無傷の列だけ。
export function explore(routeId) {
  const solve = (allowDamage) => {
    const memo = new Map();
    const best = (s) => {
      const key = `${s.index}|${s.dist}|${s.focus}|${s.used}|${s.hull}`;
      if (memo.has(key)) return memo.get(key);
      const q = quality(encounterOf(s), s.dist, s.focus);
      let top = q; // 撮影して帰還
      if (!isLastEncounter(s)) {
        top = Math.max(top, q + best(advance(shoot(s, 'next').state).state));
      }
      if (s.used < MAX_STIMULI) {
        for (const k of STIMULI) {
          const r = stimulate(s, k, true);
          if (!r.ok || r.state.over === 'lost') continue;
          if (!allowDamage && r.damage > 0) continue;
          top = Math.max(top, best(r.state));
        }
      }
      memo.set(key, top);
      return top;
    };
    return best(newGame(routeId));
  };
  const maxTotal = solve(true);
  const maxTotalNoDamage = solve(false);
  return {
    returnable: true, // 先頭で撮影して帰還すれば必ず帰還できる
    maxTotal,
    maxTotalNoDamage,
    perfectReachable: maxTotal === MAX_QUALITY,
    perfectNoDamage: maxTotalNoDamage === MAX_QUALITY,
  };
}
