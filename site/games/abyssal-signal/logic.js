// 画面に依存しないゲームのルール。Node のテストからも import できるよう DOM を触らない。
// 距離は 0=遠 / 1=中 / 2=近。すべて決定的で、隠れた乱数は使わない。

export const MAX_HULL = 7;
export const MAX_STIMULI = 3;
export const DIST_LABEL = ['遠', '中', '近'];
export const STIMULI = ['light', 'sound', 'wait', 'hold'];
export const STIMULUS_LABEL = { light: '照らす', sound: '音を鳴らす', wait: '静かに待つ', hold: '艇を止める' };

// 刺激ごとの距離の変化（接近 +1 / 維持 0 / 後退 -1）。「艇を止める」は生物によらず必ず維持（0）。
export const SPECIES = {
  A: { name: 'リボンレイ', damage: 1, react: { light: 1, sound: -1, wait: 0, hold: 0 } },
  B: { name: '鎧クラゲ', damage: 2, react: { light: 0, sound: 1, wait: -1, hold: 0 } },
  C: { name: '海底の王', damage: 3, react: { light: -1, sound: 0, wait: 1, hold: 0 } },
};

// base: 遠・中・近の基礎点。ピントで +1（最大 5〜6）。alert: その深度の近距離の損傷に加算。
// 航路ごとに、出会う生物・使える操作・深度数が違う（損傷量だけで難しくしない）。
const enc = (depth, species, target, base, alert = 0) => ({ depth, species, target, base, alert });
export const ROUTES = [
  {
    id: 'standard', name: '標準', level: 1, levelText: 'はじめて', border: 8,
    stimuli: ['light', 'sound'],
    encounters: [
      enc(600, 'A', '全身', [1, 4, 2]),
      enc(1000, 'A', '発光器官', [1, 2, 4]),
      enc(1400, 'B', '殻の模様', [1, 2, 4]),
    ],
    learn: '光と音で生物を動かし、距離と見本を見て撮る。生物ごとに反応が違う。',
    adds: '3深度／生物2種（リボンレイ・鎧クラゲ）／操作は光と音だけ',
  },
  {
    id: 'shell', name: '殻の共鳴', level: 2, levelText: 'ふつう', border: 12,
    stimuli: ['light', 'sound', 'wait'],
    encounters: [
      enc(800, 'A', '捕食姿勢', [1, 4, 2]),
      enc(1400, 'B', '殻の模様', [1, 2, 4], 1),
      enc(2000, 'B', '捕食姿勢', [1, 4, 2]),
      enc(2600, 'A', '発光器官', [1, 2, 4]),
    ],
    learn: '「静かに待つ」で動きを止めてピントを合わせる。鎧クラゲは待つと離れる。',
    adds: '4深度／新操作「静かに待つ」／中距離が最高になる対象が出る',
  },
  {
    id: 'glow', name: '発光の潮', level: 3, levelText: 'むずかしい',
    stimuli: ['light', 'sound', 'wait', 'hold'],
    encounters: [
      enc(600, 'A', '全身', [1, 4, 2]),
      enc(1200, 'B', '殻の模様', [1, 2, 4]),
      enc(1800, 'A', '発光器官', [1, 2, 4], 1),
      enc(2400, 'B', '捕食姿勢', [1, 4, 2]),
      enc(3000, 'C', '頭部', [1, 2, 4]),
    ],
    learn: '生物を読んで、ピントを取るか損傷を避けるかを選ぶ。最後に巨大な「海底の王」。',
    adds: '5深度／新生物「海底の王」／新操作「艇を止める」（どの生物でも距離を保ってピント）',
  },
];

export const maxQualityOf = (routeId) =>
  routeById(routeId).encounters.reduce((a, e) => a + Math.max(...e.base) + 1, 0);

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

export const encountersOf = (s) => routeById(s.route).encounters;
export const encounterOf = (s) => encountersOf(s)[s.index];
export const alertOf = (s) => encounterOf(s).alert;
export const canUse = (s, kind) => routeById(s.route).stimuli.includes(kind);

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
  if (!canUse(s, kind)) return { ok: false, reason: 'unavailable' };
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
  return s.index === encountersOf(s).length - 1;
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
        for (const k of routeById(routeId).stimuli) {
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
    perfectReachable: maxTotal === maxQualityOf(routeId),
    perfectNoDamage: maxTotalNoDamage === maxQualityOf(routeId),
  };
}

// ---------- 航路のアンロック ----------
// 解放数 n は「先頭から n 本の航路が選べる」。初回は 1。
// クリア = 最終遭遇まで進んで撮影し、生還したこと（途中帰還・ロストは含まない）。
export const routeIndex = (id) => Math.max(0, ROUTES.findIndex((r) => r.id === id));
export const routeCleared = (s) => s.over === 'returned' && isLastEncounter(s);
export const sanitizeUnlocked = (n) => (Number.isInteger(n) && n >= 1 && n <= ROUTES.length ? n : 1);
export const isUnlocked = (unlocked, id) => routeIndex(id) < sanitizeUnlocked(unlocked);
export const unlockCondition = (id) => {
  const i = routeIndex(id);
  if (i === 0) return null;
  const prev = ROUTES[i - 1];
  return `${prev.name}を最終深度まで撮影して帰還し、写真の合計${prev.border}点以上`;
};
// 次の航路を解放できるか：クリア（最終深度を撮影して生還）かつ写真の合計がボーダー以上。
// ボーダーは各航路の到達可能な最高点（explore）の約6割。標準は無傷でも届く。
export const borderOf = (id) => routeById(id).border ?? 0;
export const meetsBorder = (s) => routeCleared(s) && summarize(s).total >= borderOf(s.route);

// クリア時の解放。未解放の航路は遊べないので、解放済みの範囲外のクリアは無視する。
// 次の航路が未解放のときだけ1つ進める（クリア済み航路の再クリアでは増えない）。
export function applyClear(unlocked, id) {
  const n = sanitizeUnlocked(unlocked);
  const i = routeIndex(id);
  if (i >= n || n >= ROUTES.length || i !== n - 1) return { unlocked: n, newRoute: null };
  return { unlocked: n + 1, newRoute: ROUTES[n].id };
}
