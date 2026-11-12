// 夢の家の中：壁紙・窓・額縁、そして窓の外から覗きこむ巨大な「窓の顔」。
// 世界の座標はドット（1マス=16ドット）。窓の外には各章の景色（drawBackground）が見える。
import { TS } from './logic.js';
import { pxEllipse, pxLine, pxDither } from './pixel.js';

const OUT = '#120c1c';
const K = 16 / TS;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// 章ごとの部屋の色：0=色あせた子ども部屋の廊下 1=森に呑まれた家 2=深紅の奥の部屋
export const ROOM = [
  { paper: '#26323e', stripe: '#2c3a48', motif: '#3a4c5c', ceil: '#141c26', beam: '#0c1218', mould: '#4a5a66', frame: '#5a3a28', frameD: '#3a2418', frameL: '#8a5a3a', base: '#3a2418', curtain: '#a8a090', curtainD: '#6a6658', glint: '#ffe27a', void: '#0a0e16' },
  { paper: '#122a20', stripe: '#163226', motif: '#1f4a34', ceil: '#08140f', beam: '#040a08', mould: '#2f6a4a', frame: '#3a2a2a', frameD: '#1e1414', frameL: '#6a4630', base: '#1e1414', curtain: '#3a6a50', curtainD: '#1f4a34', glint: '#c8ff9a', void: '#040a08' },
  { paper: '#3e0c18', stripe: '#4a1020', motif: '#5e1626', ceil: '#14040a', beam: '#0a0206', mould: '#a8641c', frame: '#1e0610', frameD: '#0a0408', frameL: '#6a1424', base: '#0a0408', curtain: '#6a1424', curtainD: '#3a0a18', glint: '#ff4a5a', void: '#0a0408' },
];
export const CEIL = 18; // 天井の線（ドット）

const patCache = new Map();
function paper(ctx, ch) {
  const key = ch;
  let c = patCache.get(key);
  if (!c) {
    const P = ROOM[ch];
    c = document.createElement('canvas'); c.width = 16; c.height = 24;
    const g = c.getContext('2d');
    g.fillStyle = P.paper; g.fillRect(0, 0, 16, 24);
    g.fillStyle = P.stripe; g.fillRect(0, 0, 2, 24); g.fillRect(8, 0, 1, 24);
    g.fillStyle = P.motif;
    if (ch === 0) { g.fillRect(4, 5, 1, 1); g.fillRect(3, 6, 3, 1); g.fillRect(4, 7, 1, 1); g.fillRect(12, 17, 1, 1); g.fillRect(11, 18, 3, 1); g.fillRect(12, 19, 1, 1); }
    else if (ch === 1) { g.fillRect(4, 3, 1, 4); g.fillRect(3, 4, 1, 1); g.fillRect(5, 6, 1, 1); g.fillRect(12, 15, 1, 4); g.fillRect(13, 16, 1, 1); g.fillRect(11, 18, 1, 1); }
    else { g.fillRect(3, 6, 4, 1); g.fillRect(4, 5, 2, 1); g.fillRect(4, 7, 2, 1); g.fillStyle = '#0a0408'; g.fillRect(5, 6, 1, 1); g.fillStyle = P.motif; g.fillRect(11, 18, 4, 1); g.fillRect(12, 17, 2, 1); g.fillRect(12, 19, 2, 1); }
    patCache.set(key, c);
  }
  const pat = ctx.createPattern(c, 'repeat');
  return pat;
}

// 窓の配置（面ごとに一度だけ作る）
function roomOf(st) {
  if (st._room) return st._room;
  const mon = st.enemies.filter((e) => e.kind === 'window').map((e) => monsterWindow(e));
  const W = st.w * 16;
  const wins = [];
  const props = [];
  const near = (cx, d) => mon.some((m) => Math.abs((m.x0 + m.x1) / 2 - cx) < d);
  for (let c = 3; c * 16 < W - 24; c += 9) {
    const cx = c * 16 + 8;
    if (!near(cx, 72)) wins.push({ x0: cx - 26, x1: cx + 26, y0: 34, y1: 98, id: c });
    const px = cx + 74;
    if (px < W - 16 && !near(px, 56)) props.push({ x: px, y: 54, id: c });
  }
  st._room = { wins, mon, props };
  return st._room;
}
export function monsterWindow(e) {
  const x = Math.round(e.x * K); const y = Math.round(e.y * K);
  return { x0: x - 30, x1: x + 30, y0: y + 26 - 70, y1: y + 26, e };
}

function floorTop(st, c) {
  for (let r = 2; r < st.h; r++) if (st.tiles[r]?.[c] === '#') return r;
  return -1;
}

// 壁（窓の穴を残して塗る）。世界座標の変換がかかった状態で、タイルより先に呼ぶ。
export function drawRoom(ctx, st, ch, c0, c1, yTop, yBot, t) {
  const P = ROOM[ch]; const R = roomOf(st);
  for (const m of R.mon) m.e.ch = ch;
  if (st.def.scene === 'out') { drawFacades(ctx, st, ch, c0, c1, t); return; }
  const x0 = c0 * 16; const x1 = (c1 + 1) * 16;
  const holes = [...R.wins, ...R.mon].filter((w) => w.x1 > x0 && w.x0 < x1);
  const lowY = 176;
  // 壁紙
  ctx.beginPath(); ctx.rect(x0, CEIL, x1 - x0, Math.max(lowY, yBot) - CEIL);
  for (const w of holes) ctx.rect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
  ctx.fillStyle = paper(ctx, ch); ctx.fill('evenodd');
  // 床の穴から下は真っ暗
  for (let c = c0; c <= c1; c++) {
    if (floorTop(st, c) >= 0) continue;
    ctx.fillStyle = P.void; ctx.fillRect(c * 16, lowY, 16, Math.max(0, yBot - lowY));
    pxDither(ctx, c * 16, lowY - 8, 16, 8, P.void, 0);
  }
  // しみ・はがれ・つた（後半ほど多い）
  const dread = st.dread || 0;
  for (let c = c0; c <= c1; c++) {
    const h1 = hash(c * 3.7 + ch * 11);
    const x = c * 16;
    if (holes.some((w) => x + 16 > w.x0 - 4 && x < w.x1 + 4)) continue;
    if (h1 < 0.1 + dread * 0.3) { // 雨じみ（上から下へ広がる、輪郭のにじんだしみ）
      const sy = 24 + Math.floor(hash(c + 5) * 50); const ln = 20 + Math.floor(hash(c + 8) * 40);
      ctx.fillStyle = 'rgba(10,4,8,.22)';
      for (let y = 0; y < ln; y++) { const wd = Math.round(4 + Math.sin(y * 0.3 + c) * 2 + (y / ln) * 5); ctx.fillRect(x + 8 - wd, sy + y, wd * 2, 1); }
      pxDither(ctx, x + 2, sy + ln, 12, 3, 'rgba(10,4,8,.22)', 0);
    }
    if (ch === 2 && hash(c * 1.9) < 0.12) { // はがれた壁紙
      const sy = 30 + Math.floor(hash(c + 2) * 70); ctx.fillStyle = '#b8a890'; ctx.fillRect(x + 3, sy, 9, 6); ctx.fillRect(x + 5, sy + 6, 5, 3);
      ctx.fillStyle = '#7a6a5a'; ctx.fillRect(x + 3, sy + 5, 2, 1); ctx.fillStyle = P.motif; ctx.fillRect(x + 11, sy - 1, 3, 2);
    }
    if (ch === 1 && hash(c * 2.3) < 0.4) { // 天井から垂れるつた
      const len = 16 + Math.floor(hash(c + 9) * 50); const vx = x + Math.floor(hash(c + 1) * 14);
      ctx.fillStyle = '#1b6a4a'; for (let y = CEIL; y < CEIL + len; y++) ctx.fillRect(vx + Math.round(Math.sin(y * 0.18 + c) * 1.2), y, 1, 1);
      ctx.fillStyle = '#2fa06a'; for (let y = CEIL + 6; y < CEIL + len; y += 7) ctx.fillRect(vx + Math.round(Math.sin(y * 0.18 + c) * 1.2) + 1, y, 2, 1);
      if (Math.floor(t * 2 + c) % 5) { ctx.fillStyle = '#c8ff9a'; ctx.fillRect(vx - 1, CEIL + len, 3, 2); }
    }
    if (ch === 2 && hash(c * 4.1) < 0.25) { // 天井から垂れる赤
      const len = 6 + Math.floor(hash(c + 3) * 20); ctx.fillStyle = '#6a1424'; ctx.fillRect(x + 7, CEIL, 2, len); ctx.fillRect(x + 6, CEIL + len, 4, 2);
      const d = ((t * 12 + c * 7) % 60); if (d < 40) { ctx.fillStyle = '#a82038'; ctx.fillRect(x + 7, CEIL + len + 2 + Math.floor(d), 1, 2); }
    }
  }
  // 天井
  ctx.fillStyle = P.ceil; ctx.fillRect(x0, yTop, x1 - x0, CEIL - yTop);
  ctx.fillStyle = P.beam; for (let x = Math.floor(x0 / 48) * 48; x < x1; x += 48) { ctx.fillRect(x, yTop, 8, CEIL - yTop + 3); ctx.fillRect(x - 2, CEIL, 12, 2); }
  ctx.fillStyle = P.mould; ctx.fillRect(x0, CEIL - 2, x1 - x0, 1);
  ctx.fillStyle = OUT; ctx.fillRect(x0, CEIL, x1 - x0, 1);
  // 幅木（床のすぐ上）
  for (let c = c0; c <= c1; c++) {
    const r = floorTop(st, c); if (r < 0) continue;
    const y = r * 16; if (y > lowY) continue;
    ctx.fillStyle = P.base; ctx.fillRect(c * 16, y - 4, 16, 4); ctx.fillStyle = P.frameL; ctx.fillRect(c * 16, y - 4, 16, 1);
  }
  // 額縁
  for (const pr of R.props) if (pr.x + 12 > x0 && pr.x - 12 < x1) drawPortrait(ctx, pr, ch, dread, t);
  // 普通の窓
  for (const w of R.wins) if (w.x1 + 10 > x0 && w.x0 - 10 < x1) drawWindowFrame(ctx, w, ch, dread, t, false);
  for (const w of R.mon) if (w.x1 + 10 > x0 && w.x0 - 10 < x1) drawWindowFrame(ctx, w, ch, dread, t, true);
  // フックは天井から吊るされている
  ctx.fillStyle = '#4a4060';
  for (const h of st.hooks) {
    if (h.gone) continue; const hx = Math.round(h.x * K); const hy = Math.round(h.y * K) - 8;
    if (hx < x0 || hx > x1 || hy <= CEIL + 2) continue;
    ctx.fillRect(hx, CEIL, 1, hy - CEIL);
  }
}

// 屋外の面：窓の顔は、建物の窓の奥から外へ身を乗りだす
const FACADE = [
  { wall: '#2a1c18', board: '#3a2418', roof: '#16303a', roofL: '#24484a' },
  { wall: '#14201a', board: '#1e1414', roof: '#0c2a20', roofL: '#1b6a4a' },
  { wall: '#2a0610', board: '#3a0a18', roof: '#1e0610', roofL: '#6a1424' },
];
function drawFacades(ctx, st, ch, c0, c1, t) {
  const R = roomOf(st); const F = FACADE[ch]; const x0 = c0 * 16; const x1 = (c1 + 1) * 16;
  for (const w of R.mon) {
    if (w.x1 + 40 < x0 || w.x0 - 40 > x1) continue;
    const L = w.x0 - 16; const Rr = w.x1 + 16; const top = w.y0 - 14; const bot = w.y1 + 60;
    // 傾いた家の壁と三角屋根
    ctx.fillStyle = OUT; ctx.fillRect(L - 1, top - 1, Rr - L + 2, bot - top + 1);
    ctx.fillStyle = F.wall; ctx.fillRect(L, top, Rr - L, bot - top);
    ctx.fillStyle = F.board; for (let y = top + 4; y < bot; y += 6) ctx.fillRect(L, y, Rr - L, 1);
    const cx = (L + Rr) / 2; const rh = 30;
    for (let i = 0; i <= rh; i++) {
      const hw = Math.round((Rr - L) / 2 + 8 - i * ((Rr - L) / 2 + 8) / rh);
      ctx.fillStyle = OUT; ctx.fillRect(Math.round(cx) - hw - 1, top - i, hw * 2 + 2, 1);
      ctx.fillStyle = i < 3 ? F.roofL : F.roof; ctx.fillRect(Math.round(cx) - hw, top - i, hw * 2, 1);
    }
    ctx.fillStyle = F.roof; ctx.fillRect(Rr - 14, top - 26, 6, 14); ctx.fillStyle = OUT; ctx.fillRect(Rr - 15, top - 27, 8, 2);
    // 窓の奥は真っ暗な部屋（かすかなランプ）
    ctx.fillStyle = '#0a0408'; ctx.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
    ctx.fillStyle = 'rgba(255,211,106,.08)'; ctx.fillRect(w.x0 + 4, w.y0 + 8, 12, 20);
    drawWindowFrame(ctx, w, ch, st.dread || 0, t, true);
  }
}

function drawPortrait(ctx, pr, ch, dread, t) {
  const x = pr.x - 9; const y = pr.y; const k = hash(pr.id * 5 + ch);
  ctx.fillStyle = OUT; ctx.fillRect(x + 8, y - 6, 2, 6); ctx.fillRect(x - 1, y - 1, 20, 26);
  ctx.fillStyle = ch === 2 ? '#a8641c' : '#8a6a3a'; ctx.fillRect(x, y, 18, 24);
  ctx.fillStyle = ch === 2 ? '#f0b030' : '#c9963a'; ctx.fillRect(x, y, 18, 1); ctx.fillRect(x, y, 1, 24);
  ctx.fillStyle = '#2a2238'; ctx.fillRect(x + 2, y + 2, 14, 20);
  if (ch === 0 && k < 0.5) { // 少女の肖像
    ctx.fillStyle = '#ffd2b0'; pxEllipse(ctx, x + 9, y + 10, 3, 4);
    ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x + 5, y + 6, 8, 2); ctx.fillRect(x + 5, y + 7, 2, 8); ctx.fillRect(x + 11, y + 7, 2, 8);
    ctx.fillStyle = '#e8eef6'; ctx.fillRect(x + 6, y + 15, 6, 7);
    ctx.fillStyle = OUT; ctx.fillRect(x + 8, y + 10, 1, 1); ctx.fillRect(x + 10, y + 10, 1, 1);
  } else if (ch < 2 && k < 0.85) { // 家族の写真：大きな人の顔だけ黒く塗りつぶされている
    ctx.fillStyle = '#4a4060'; ctx.fillRect(x + 4, y + 9, 5, 13); ctx.fillStyle = '#2a2238'; ctx.fillRect(x + 4, y + 4, 5, 5);
    ctx.fillStyle = OUT; for (let i = 0; i < 6; i++) ctx.fillRect(x + 3 + (i % 3) * 2, y + 3 + Math.floor(i / 3) * 3, 3, 2);
    ctx.fillStyle = '#e8eef6'; ctx.fillRect(x + 11, y + 15, 4, 7); ctx.fillStyle = '#ffd2b0'; ctx.fillRect(x + 11, y + 12, 4, 3); ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x + 10, y + 11, 6, 2);
  } else { // 目をくり抜かれた肖像
    ctx.fillStyle = '#b8a890'; pxEllipse(ctx, x + 9, y + 11, 5, 7);
    ctx.fillStyle = '#0a0408'; ctx.fillRect(x + 6, y + 9, 2, 2); ctx.fillRect(x + 10, y + 9, 2, 2); ctx.fillRect(x + 7, y + 15, 4, 1);
    if (dread > 0.3 && Math.floor(t * 0.8 + pr.id) % 4) { ctx.fillStyle = '#ff4a5a'; ctx.fillRect(x + 7, y + 10, 1, 1); ctx.fillRect(x + 10, y + 10, 1, 1); }
  }
}

function drawWindowFrame(ctx, w, ch, dread, t, big) {
  const P = ROOM[ch];
  const { x0, x1, y0, y1 } = w; const ww = x1 - x0; const hh = y1 - y0;
  // ガラスの映り込み
  ctx.fillStyle = 'rgba(191,228,255,.07)'; ctx.fillRect(x0, y0, ww, hh);
  ctx.fillStyle = 'rgba(191,228,255,.16)';
  for (let i = 0; i < 2; i++) { const sx = x0 + 6 + i * 9; pxLine(ctx, sx, y1 - 4, sx + Math.round(hh * 0.4), y0 + Math.round(hh * 0.3), 1); }
  const f = big ? 4 : 3;
  // 枠
  ctx.fillStyle = OUT; ctx.fillRect(x0 - f - 1, y0 - f - 1, ww + f * 2 + 2, f + 1); ctx.fillRect(x0 - f - 1, y0 - f - 1, f + 1, hh + f + 1); ctx.fillRect(x1, y0 - f - 1, f + 1, hh + f + 1);
  ctx.fillStyle = P.frame; ctx.fillRect(x0 - f, y0 - f, ww + f * 2, f); ctx.fillRect(x0 - f, y0, f, hh); ctx.fillRect(x1, y0, f, hh);
  ctx.fillStyle = P.frameL; ctx.fillRect(x0 - f, y0 - f, ww + f * 2, 1); ctx.fillRect(x0 - f, y0, 1, hh);
  if (!big) {
    ctx.fillStyle = OUT; ctx.fillRect(x0 + Math.floor(ww / 2) - 1, y0, 3, hh); ctx.fillRect(x0, y0 + Math.floor(hh * 0.45) - 1, ww, 3);
    ctx.fillStyle = P.frame; ctx.fillRect(x0 + Math.floor(ww / 2), y0, 1, hh); ctx.fillRect(x0, y0 + Math.floor(hh * 0.45), ww, 1);
    // ときどき、窓の暗がりに目
    if (hash(w.id * 7 + ch) < 0.25 + dread * 0.6 && Math.floor(t * 0.6 + w.id) % 5 === 0 && Math.floor(t * 9) % 11) {
      ctx.fillStyle = P.glint; const ex = x0 + 4 + Math.floor(hash(w.id) * (ww - 12)); const ey = y1 - 8 - Math.floor(hash(w.id + 1) * 10);
      ctx.fillRect(ex, ey, 1, 1); ctx.fillRect(ex + 4, ey, 1, 1);
    }
  } else {
    // 割れたガラスの破片が角に残る
    ctx.fillStyle = 'rgba(232,238,246,.55)';
    for (let i = 0; i < 6; i++) { ctx.fillRect(x0, y0 + i, 6 - i, 1); ctx.fillRect(x1 - 7 + i, y0 + i, 7 - i, 1); ctx.fillRect(x0, y1 - 1 - i, 4 - Math.floor(i * 0.7), 1); }
    ctx.fillStyle = OUT; ctx.fillRect(x0 + Math.floor(ww / 2) - 1, y0, 3, 6); ctx.fillRect(x0 + Math.floor(ww / 2) - 1, y1 - 5, 3, 5);
    // 枠のひっかき傷
    ctx.fillStyle = P.frameD; for (let i = 0; i < 3; i++) { ctx.fillRect(x0 - 3, y0 + 18 + i * 3, 2, 1); ctx.fillRect(x1 + 1, y0 + 30 + i * 3, 2, 1); }
  }
  // 窓台
  ctx.fillStyle = OUT; ctx.fillRect(x0 - f - 3, y1, ww + f * 2 + 6, 5);
  ctx.fillStyle = P.frame; ctx.fillRect(x0 - f - 2, y1, ww + f * 2 + 4, 3);
  ctx.fillStyle = P.frameL; ctx.fillRect(x0 - f - 2, y1, ww + f * 2 + 4, 1);
  // カーテン（ぼろぼろ）
  const rodY = y0 - f - 4;
  ctx.fillStyle = OUT; ctx.fillRect(x0 - f - 6, rodY, ww + f * 2 + 12, 2);
  const sides = big ? [-1, 1] : [hash(w.id + 3) < 0.5 ? -1 : 1];
  for (const s of sides) {
    const cw = big ? 9 : 8; const cx = s < 0 ? x0 - f - 4 : x1 + f + 4 - cw;
    const sway = Math.round(Math.sin(t * 1.3 + w.x0 * 0.1) * 1);
    for (let i = 0; i < cw; i++) {
      const len = hh + f + (big ? 8 : 4) - (((i * 5 + w.x0) % 7) * 2) + (i % 2 ? 0 : 2);
      ctx.fillStyle = i % 3 === 1 ? ROOM[ch].curtainD : ROOM[ch].curtain;
      ctx.fillRect(cx + i + (i > cw / 2 ? sway : 0), rodY + 2, 1, len);
    }
    ctx.fillStyle = OUT; ctx.fillRect(cx - 1, rodY + 2, 1, hh * 0.6); ctx.fillRect(cx + cw, rodY + 2, 1, hh * 0.6);
  }
}

// ───────── 窓の顔（巨大な頭と手）─────────
// g: 窓のガラス面 {x0,x1,y0,y1}（ドット）。m: {out, arm, state, hx, hy, look, id}
export function drawMonster(ctx, g, m, t, ch = 0) {
  const ww = g.x1 - g.x0; const u = ww / 60; const cx = Math.round((g.x0 + g.x1) / 2); const sill = g.y1;
  const S = (n) => Math.max(1, Math.round(n * u));
  const out = m.out; const parts = m.parts || 'all';
  const glint = ch === 2 ? '#ff4a5a' : '#ffe27a';
  if (parts === 'hands') { drawMonsterHands(ctx, g, m, t, u, cx, sill, S); return; }
  if (out <= 0.02) {
    // 窓の下の暗がりに、離れた二つの目
    if (Math.floor(t * 0.7 + m.id) % 4 === 0 && Math.floor(t * 8) % 9) { ctx.fillStyle = glint; ctx.fillRect(cx - S(13), sill - S(5), S(2), 1); ctx.fillRect(cx + S(12), sill - S(5), S(2), 1); }
    return;
  }
  const rx = S(36); const ry = S(34);
  const cy = Math.round(sill + ry + S(4) - out * (ry * 2 - S(8)));
  const flinch = m.state === 'flinch';
  ctx.save(); ctx.beginPath(); ctx.rect(g.x0, g.y0, ww, g.y1 - g.y0); ctx.clip();
  // 長い黒髪（頭の後ろと両脇）
  ctx.fillStyle = '#0a0408'; pxEllipse(ctx, cx, cy - S(4), rx + S(4), ry + S(2));
  ctx.fillRect(cx - rx - S(4), cy - S(4), S(10), ry * 2); ctx.fillRect(cx + rx - S(6), cy - S(4), S(10), ry * 2);
  // 顔
  ctx.fillStyle = '#8a8070'; pxEllipse(ctx, cx, cy + S(2), rx - S(3), ry - S(2));
  ctx.fillStyle = '#c8c0b0'; pxEllipse(ctx, cx - S(2), cy + S(1), rx - S(6), ry - S(4));
  ctx.fillStyle = '#e8dcc8'; pxEllipse(ctx, cx - S(9), cy - S(10), S(12), S(9));
  // 前髪（顔にかかる細い束）
  ctx.fillStyle = '#0a0408';
  for (let i = 0; i < 9; i++) { const hx = cx - S(26) + Math.round(i * S(52) / 8); const len = S(6) + Math.round(hash(i + 3) * S(14)); ctx.fillRect(hx, cy - ry + S(2), S(2), len); }
  // ひび
  ctx.fillStyle = '#8a8070'; pxLine(ctx, cx + S(18), cy - S(14), cx + S(22), cy - S(2), 1); pxLine(ctx, cx + S(22), cy - S(2), cx + S(19), cy + S(6), 1); pxLine(ctx, cx - S(24), cy + S(4), cx - S(20), cy + S(12), 1);
  // 目
  const ey = cy - S(6); const ex = S(13);
  const look = Math.max(-1, Math.min(1, m.look || 0));
  if (flinch) {
    ctx.fillStyle = '#0a0408';
    for (const s of [-1, 1]) { pxLine(ctx, cx + s * ex - S(5), ey - S(3), cx + s * ex + S(5), ey, S(2)); pxLine(ctx, cx + s * ex - S(5), ey + S(3), cx + s * ex + S(5), ey, S(2)); }
  } else {
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#5a5048'; pxEllipse(ctx, cx + s * ex, ey + S(3), S(8), S(9));
      ctx.fillStyle = '#0a0408'; pxEllipse(ctx, cx + s * ex, ey, S(6), S(8));
      if (Math.floor(t * 1.7 + m.id) % 9 !== 0) { ctx.fillStyle = glint; ctx.fillRect(cx + s * ex + Math.round(look * S(3)), ey - S(1), S(2), S(2)); }
    }
  }
  // 口：耳まで裂けた笑い（ひるむと丸く開く）
  ctx.fillStyle = '#0a0408';
  if (flinch) pxEllipse(ctx, cx, cy + S(16), S(6), S(7));
  else {
    const mw = S(22);
    for (let x = -mw; x <= mw; x++) {
      const q = x / mw; const top = cy + S(12) - Math.round(S(6) * q * q); const th = Math.max(1, Math.round(S(5) * (1 - q * q)) + 1);
      ctx.fillStyle = '#0a0408'; ctx.fillRect(cx + x, top, 1, th);
      if ((x & 1) === 0 && Math.abs(q) < 0.85) { ctx.fillStyle = '#e8dcc8'; ctx.fillRect(cx + x, top, 1, Math.min(th, S(2))); }
    }
  }
  ctx.restore();
  if (parts === 'face') return;
  drawMonsterHands(ctx, g, m, t, u, cx, sill, S);
}
function drawMonsterHands(ctx, g, m, t, u, cx, sill, S) {
  const out = m.out; const ww = g.x1 - g.x0; const flinch = m.state === 'flinch';
  if (out <= 0.02) return;
  // 窓台をつかむ両手（窓の外から指がかかる）
  const k = Math.max(0, Math.min(1, (out - 0.2) / 0.5));
  if (k > 0) {
    for (const s of [-1, 1]) {
      const hx = cx + s * S(21);
      ctx.save(); ctx.beginPath(); ctx.rect(g.x0, g.y0, ww, g.y1 - g.y0); ctx.clip();
      ctx.fillStyle = OUT; pxEllipse(ctx, hx, sill, S(10), Math.max(1, Math.round(S(6) * k)));
      ctx.fillStyle = '#c8c0b0'; pxEllipse(ctx, hx, sill, S(9), Math.max(1, Math.round(S(5) * k)));
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        const fx = hx + Math.round((i - 1.5) * S(4.5)) + (s < 0 ? 0 : 0);
        const len = Math.round(S(3) + k * S(8) - (i === 0 || i === 3 ? S(2) : 0));
        ctx.fillStyle = OUT; ctx.fillRect(fx - 1, sill - 2, S(2) + 2, len + 3);
        ctx.fillStyle = '#c8c0b0'; ctx.fillRect(fx, sill - 2, S(2), len + 1);
        ctx.fillStyle = '#8a8070'; ctx.fillRect(fx, sill + Math.floor(len / 2), S(2), 1);
        ctx.fillStyle = '#3a2418'; ctx.fillRect(fx, sill + len - 1, S(2), 2);
      }
    }
  }
  // 片手が窓枠の横をつかむ
  const k2 = Math.max(0, Math.min(1, (out - 0.55) / 0.35));
  if (k2 > 0 && !flinch) {
    const s = (m.id % 2) ? 1 : -1; const fx = s < 0 ? g.x0 - 1 : g.x1 + 1;
    for (let i = 0; i < 4; i++) {
      const fy = g.y0 + S(20) + i * S(5); const len = Math.round(S(4) + k2 * S(6));
      const xa = s < 0 ? fx - len : fx;
      ctx.fillStyle = OUT; ctx.fillRect(xa - 1, fy - 1, len + 2, S(2) + 2);
      ctx.fillStyle = '#c8c0b0'; ctx.fillRect(xa, fy, len, S(2));
      ctx.fillStyle = '#3a2418'; ctx.fillRect(s < 0 ? xa : xa + len - 2, fy, 2, S(2));
    }
  }
  // つかみかかる腕（ガラスの割れ目から部屋の中へ）
  if (m.arm > 0) {
    const side = m.hx < cx ? -1 : 1;
    const bx = cx + side * S(8); const by = sill - S(12);
    const ex2 = m.hx; const ey2 = m.hy;
    const dx = ex2 - bx; const dy = ey2 - by; const d = Math.hypot(dx, dy) || 1;
    const mx = (bx + ex2) / 2 - dy / d * S(9) * side; const my = (by + ey2) / 2 + dx / d * S(9) * side - S(4);
    for (const [wd, col] of [[S(9), OUT], [S(7), '#c8c0b0']]) { ctx.fillStyle = col; pxLine(ctx, bx, by, mx, my, wd); pxLine(ctx, mx, my, ex2, ey2, wd); }
    ctx.fillStyle = '#8a8070'; pxLine(ctx, bx, by + S(2), mx, my + S(2), 1); pxLine(ctx, mx, my + S(2), ex2, ey2 + S(2), 1);
    ctx.fillStyle = '#e8dcc8'; ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 2, 3, 2);
    // 大きな手のひらと長い指
    const a = Math.atan2(ey2 - my, ex2 - mx);
    ctx.fillStyle = OUT; pxEllipse(ctx, ex2, ey2, S(7), S(7));
    ctx.fillStyle = '#c8c0b0'; pxEllipse(ctx, ex2, ey2, S(6), S(6));
    for (let f = -2; f <= 2; f++) {
      const b = a + f * 0.42; const L = S(f === 0 ? 13 : Math.abs(f) === 1 ? 12 : 9);
      const fx2 = ex2 + Math.cos(b) * L; const fy2 = ey2 + Math.sin(b) * L;
      ctx.fillStyle = OUT; pxLine(ctx, ex2, ey2, fx2, fy2, S(3) + 1);
      ctx.fillStyle = '#e8dcc8'; pxLine(ctx, ex2, ey2, fx2, fy2, S(2));
      ctx.fillStyle = '#3a2418'; ctx.fillRect(Math.round(fx2) - 1, Math.round(fy2) - 1, 2, 2);
    }
  }
}

// タイトルなど、世界の外で部屋を描く（スクリーン座標）。win: ガラス面
export function drawRoomScreen(ctx, w, h, ch, win, floorY, t) {
  const P = ROOM[ch];
  ctx.beginPath(); ctx.rect(0, 0, w, floorY); ctx.rect(win.x0, win.y0, win.x1 - win.x0, win.y1 - win.y0);
  ctx.fillStyle = paper(ctx, ch); ctx.fill('evenodd');
  const ceil = Math.min(CEIL, win.y0 - 10);
  ctx.fillStyle = P.ceil; ctx.fillRect(0, 0, w, ceil);
  ctx.fillStyle = P.beam; for (let x = 6; x < w; x += 48) { ctx.fillRect(x, 0, 8, ceil + 3); ctx.fillRect(x - 2, ceil, 12, 2); }
  ctx.fillStyle = P.mould; ctx.fillRect(0, ceil - 2, w, 1); ctx.fillStyle = OUT; ctx.fillRect(0, ceil, w, 1);
  drawWindowFrame(ctx, { ...win, id: 1 }, ch, 0.2, t, true);
}

// 床（板張り）
export function drawFloorScreen(ctx, w, y, h, ch) {
  const P = ROOM[ch];
  ctx.fillStyle = P.base; ctx.fillRect(0, y - 4, w, 4); ctx.fillStyle = P.frameL; ctx.fillRect(0, y - 4, w, 1);
  ctx.fillStyle = OUT; ctx.fillRect(0, y, w, h - y);
  ctx.fillStyle = '#5a3a28'; ctx.fillRect(0, y + 1, w, 5);
  ctx.fillStyle = '#7a4a30'; ctx.fillRect(0, y + 1, w, 1);
  ctx.fillStyle = '#3a2418'; for (let x = 7; x < w; x += 19) ctx.fillRect(x, y + 1, 1, 5);
  ctx.fillStyle = '#1a1018'; ctx.fillRect(0, y + 7, w, h - y - 7);
  pxDither(ctx, 0, y + 6, w, 3, '#3a2418', 0);
}

// ───────── タイトル：月明かりの子ども部屋 ─────────
// 壁（窓の穴あき）と、十字の桟の窓・カーテン
export function drawTitleWall(ctx, w, h, win, floorY, t) {
  const P = ROOM[0];
  ctx.beginPath(); ctx.rect(0, 0, w, floorY); ctx.rect(win.x0, win.y0, win.x1 - win.x0, win.y1 - win.y0);
  ctx.fillStyle = paper(ctx, 0); ctx.fill('evenodd');
  // 壁は暗く沈める（窓の光だけが明るい）
  ctx.beginPath(); ctx.rect(0, 0, w, floorY); ctx.rect(win.x0, win.y0, win.x1 - win.x0, win.y1 - win.y0);
  ctx.fillStyle = 'rgba(8,6,16,.45)'; ctx.fill('evenodd');
  const ceil = Math.max(6, Math.min(CEIL, win.y0 - 14));
  ctx.fillStyle = P.ceil; ctx.fillRect(0, 0, w, ceil);
  ctx.fillStyle = P.beam; for (let x = 6; x < w; x += 48) { ctx.fillRect(x, 0, 8, ceil + 3); ctx.fillRect(x - 2, ceil, 12, 2); }
  ctx.fillStyle = OUT; ctx.fillRect(0, ceil, w, 1);
  drawWindowFrame(ctx, { ...win, id: 2 }, 0, 0.6, t, false);
}
// 窓から斜めに差しこむ月の光。shadow: 窓の顔の影（0..1）
export function drawMoonBeam(ctx, win, floorY, w, t, dim = 0, shadow = 0) {
  const k = 0.55; const a = 0.11 * (1 - dim * 0.7);
  const xr = (y) => [Math.round(win.x0 - (y - win.y0) * k), Math.round(win.x1 - Math.max(0, y - win.y1) * k)];
  for (let y = win.y0; y < floorY; y++) {
    const [l, r] = xr(y); if (r <= l) continue;
    ctx.fillStyle = `rgba(216,224,176,${a})`; ctx.fillRect(Math.max(0, l), y, Math.min(w, r) - Math.max(0, l), 1);
    // 縁はディザでぼかす
    ctx.fillStyle = `rgba(216,224,176,${a})`; if ((y & 1) === 0) { ctx.fillRect(l - 2, y, 1, 1); ctx.fillRect(r + 1, y, 1, 1); }
  }
  // 床に落ちた窓の形（十字の桟の影つき）
  const [fl, fr] = xr(floorY); const mid = Math.round((fl + fr) / 2 + (win.y1 - win.y0) * k * 0.05);
  ctx.fillStyle = `rgba(232,238,200,${0.32 * (1 - dim * 0.7)})`; ctx.fillRect(fl, floorY + 1, fr - fl, 3);
  ctx.fillStyle = 'rgba(10,8,16,.55)'; ctx.fillRect(mid - 1, floorY + 1, 2, 3);
  // 漂うほこり
  for (let i = 0; i < 16; i++) {
    const yy = win.y0 + ((hash(i * 3) * (floorY - win.y0) + t * (3 + hash(i) * 4)) % (floorY - win.y0));
    const [l, r] = xr(yy); const xx = l + hash(i * 7 + 1) * (r - l) + Math.sin(t * 0.7 + i) * 3;
    if ((Math.floor(t * 2 + i) % 5) !== 0) { ctx.fillStyle = `rgba(244,241,232,${0.5 * (1 - dim * 0.5)})`; ctx.fillRect(Math.round(xx), Math.round(yy), 1, 1); }
  }
  // 窓の顔が光をさえぎって、床と壁に大きな頭の影が落ちる
  if (shadow > 0.05) {
    const ww = win.x1 - win.x0; const rx = Math.round(ww * 0.42 * Math.min(1, shadow * 1.2)); const ry = Math.round(rx * 0.9);
    const cx = Math.round((fl + fr) / 2 + ww * 0.1); const cy = floorY - Math.round(ry * 0.5);
    ctx.save(); ctx.beginPath();
    for (let y = win.y0; y < floorY + 4; y++) { const [l, r] = xr(Math.min(y, floorY)); ctx.rect(l - 2, y, r - l + 4, 1); }
    ctx.clip();
    ctx.fillStyle = `rgba(6,3,10,${0.45 * shadow})`; pxEllipse(ctx, cx, cy, rx, ry); ctx.fillStyle = `rgba(6,3,10,${0.25 * shadow})`; pxEllipse(ctx, cx, cy, rx + 3, ry + 3);
    for (let i = 0; i < 4; i++) { ctx.fillRect(cx - rx - 2 + i * 3, cy + Math.round(ry * 0.6), 2, Math.round(ry * 0.5)); ctx.fillRect(cx + rx - 10 + i * 3, cy + Math.round(ry * 0.6), 2, Math.round(ry * 0.5)); }
    ctx.restore();
  }
}
// 画面の四隅を暗く
export function vignette(ctx, w, h) {
  for (let i = 0; i < 6; i++) {
    const a = 0.1 + i * 0.02;
    ctx.fillStyle = `rgba(6,3,10,${a})`;
    ctx.fillRect(0, 0, w, 6 - i); ctx.fillRect(0, h - (6 - i) * 2, w, (6 - i) * 2);
    ctx.fillRect(0, 0, (6 - i) * 3, h); ctx.fillRect(w - (6 - i) * 3, 0, (6 - i) * 3, h);
  }
}
