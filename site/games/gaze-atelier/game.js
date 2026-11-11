import * as L from './logic.js';

const $ = (id) => document.getElementById(id);
const bg = $('bg'), bctx = bg.getContext('2d'), paper = $('paper'), pctx = paper.getContext('2d');
const screenEl = $('screen'), caption = $('caption'), actions = $('actions');
const params = new URLSearchParams(location.search);
const OG = params.get('og') === '1';
let save = L.loadSave(localStorage);
const persist = () => L.saveSave(localStorage, save);
const reduceMotion = () => save.opt.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
const hash = (a, b, s = 0) => { let x = (a * 374761393 + b * 668265263 + s * 1274126177) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967295; };

// ---------- 音 ----------
let ac = null, master = null;
function audio() { if (ac) { if (ac.state === 'suspended') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = save.opt.volume * 0.4; master.connect(ac.destination); } catch { ac = null; } }
function tone(f, d, type = 'sine', v = 0.25, delay = 0) { if (!ac || save.opt.volume <= 0) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02); }
const sfx = {
  link: (i = 0) => { const f = [523, 587, 659, 784, 880, 988, 1047, 1175, 1319, 1397][i % 10]; tone(f, 0.5, 'sine', 0.22); tone(f * 2, 0.3, 'sine', 0.06, 0.03); },
  done: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.7, 'triangle', 0.18, i * 0.09)),
  tick: () => tone(880, 0.06, 'square', 0.05),
  ok: () => [659, 880, 1175].forEach((f, i) => tone(f, 0.5, 'sine', 0.2, i * 0.08)),
  ng: () => tone(220, 0.3, 'triangle', 0.18),
  start: () => tone(660, 0.18, 'triangle', 0.15),
};

// ---------- 画面の大きさ ----------
let W = 0, H = 0, DPR = 1, PS = 300;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  bg.width = Math.round(W * DPR); bg.height = Math.round(H * DPR);
  PS = Math.floor(Math.max(220, Math.min(W - 48, H - (W < 700 ? 250 : 300), 600)));
  paper.style.width = paper.style.height = `${PS}px`; paper.width = paper.height = Math.round(PS * DPR);
  paperTex = null; bgTex = null;
}
addEventListener('resize', resize);

// ---------- 背景：昼の机（明るい木目・クレヨン・色えんぴつ・消しゴム） ----------
let bgTex = null;
const CRAYON = ['#ff5a5f', '#ffb400', '#2bb3ff', '#34c27a', '#9b6bff', '#ff8ad0'];
function makeBg() {
  const c = document.createElement('canvas'); c.width = bg.width; c.height = bg.height; const x = c.getContext('2d'); x.scale(DPR, DPR);
  // 木の机（上から見下ろし）
  x.fillStyle = '#f3dcb4'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { const y = hash(i, 1) * H; x.strokeStyle = `rgba(190,140,80,${0.08 + hash(i, 2) * 0.12})`; x.lineWidth = 1 + hash(i, 3) * 3; x.beginPath(); x.moveTo(0, y); for (let k = 0; k <= 10; k++) x.lineTo(k * W / 10, y + Math.sin(k * 0.9 + i) * (4 + hash(i, 4) * 8)); x.stroke(); }
  for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(160,110,60,0.12)'; x.beginPath(); x.ellipse(hash(i, 5) * W, hash(i, 6) * H, 10 + hash(i, 7) * 14, 4 + hash(i, 8) * 5, 0, 0, 7); x.fill(); }
  // 散らばったクレヨン
  const crayon = (cx, cy, ang, col) => { x.save(); x.translate(cx, cy); x.rotate(ang); x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(-36, -5, 76, 14); x.fillStyle = col; x.fillRect(-38, -8, 64, 14); x.beginPath(); x.moveTo(26, -8); x.lineTo(38, -1); x.lineTo(26, 6); x.fill(); x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(-26, -8, 34, 14); x.fillStyle = col; x.font = '700 8px sans-serif'; x.fillText('CRAYON', -24, 2); x.restore(); };
  CRAYON.forEach((col, i) => crayon(W * (i < 3 ? 0.06 + i * 0.05 : 0.8 + (i - 3) * 0.05), H * (i < 3 ? 0.82 + i * 0.04 : 0.12 + (i - 3) * 0.05), (hash(i, 9) - 0.5) * 1.2 + (i < 3 ? -0.3 : 0.4), col));
  // 消しゴムと色えんぴつ
  x.save(); x.translate(W * 0.9, H * 0.86); x.rotate(-0.3); x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(-26, -10, 56, 26); x.fillStyle = '#fff'; x.fillRect(-28, -14, 56, 26); x.fillStyle = '#2bb3ff'; x.fillRect(-28, -14, 30, 26); x.restore();
  x.save(); x.translate(W * 0.1, H * 0.16); x.rotate(0.5); x.fillStyle = '#ffd34d'; x.fillRect(-60, -5, 110, 10); x.fillStyle = '#f6d7b0'; x.beginPath(); x.moveTo(50, -5); x.lineTo(66, 0); x.lineTo(50, 5); x.fill(); x.fillStyle = '#333'; x.beginPath(); x.moveTo(61, -2); x.lineTo(66, 0); x.lineTo(61, 2); x.fill(); x.fillStyle = '#ff8ad0'; x.fillRect(-66, -5, 8, 10); x.restore();
  return c;
}
function drawBg() {
  if (!bgTex) bgTex = makeBg();
  bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.drawImage(bgTex, 0, 0); bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

// ---------- 画用紙：白いスケッチブック ----------
let paperTex = null, demoTex = null;
function makePaper() { return makePaperSized(paper.width); }
function makePaperSized(size) {
  const c = document.createElement('canvas'); c.width = size; c.height = size; const x = c.getContext('2d'), s = size;
  x.fillStyle = '#fffdf7'; x.fillRect(0, 0, s, s);
  const img = x.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (hash(i, 7, 1) - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n - 2; }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(200,190,170,${0.06 + hash(i, 3) * 0.06})`; x.lineWidth = 1; x.beginPath(); const px = hash(i, 4) * s, py = hash(i, 5) * s; x.moveTo(px, py); x.lineTo(px + (hash(i, 6) - 0.5) * s * 0.08, py + (hash(i, 8) - 0.5) * s * 0.08); x.stroke(); }
  return c;
}

// クレヨンの線：色の太い線に、ざらつき（細い線を少しずらして重ねる）
function paintStroke(ctx, pts, s, upto = Infinity, col = null, idx = 0) {
  const p = pts.filter((q) => (q.t ?? 0) <= upto);
  if (!p.length) return;
  const c = col || CRAYON[idx % CRAYON.length];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = (ox = 0, oy = 0) => { ctx.beginPath(); ctx.moveTo(p[0].x * s + ox, p[0].y * s + oy); for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i]; ctx.quadraticCurveTo(a.x * s + ox, a.y * s + oy, (a.x + b.x) / 2 * s + ox, (a.y + b.y) / 2 * s + oy); } ctx.lineTo(p[p.length - 1].x * s + ox, p[p.length - 1].y * s + oy); };
  if (p.length === 1) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p[0].x * s, p[0].y * s, s * 0.012, 0, 7); ctx.fill(); return; }
  ctx.save();
  ctx.globalAlpha = 0.85; ctx.strokeStyle = c; ctx.lineWidth = s * 0.018; path(); ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.lineWidth = s * 0.006;
  for (let k = 0; k < 3; k++) { const o = s * 0.006; path((hash(k, idx, 1) - 0.5) * o * 2, (hash(k, idx, 2) - 0.5) * o * 2); ctx.stroke(); }
  ctx.globalAlpha = 0.25; ctx.strokeStyle = '#fffdf7'; ctx.lineWidth = s * 0.003; ctx.setLineDash([s * 0.004, s * 0.009]); path(s * 0.002, s * 0.002); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

// ---------- 筆（目 か 指） ----------
const pen = { x: 0.5, y: 0.5, down: false, active: false, blink: false };
const ptr = { x: 0.5, y: 0.5, pressed: false, inside: false, touch: false };
function toPaper(cx, cy) { const r = paper.getBoundingClientRect(); return { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height }; }
paper.addEventListener('pointerdown', (e) => { audio(); paper.setPointerCapture(e.pointerId); Object.assign(ptr, toPaper(e.clientX, e.clientY)); ptr.pressed = true; ptr.touch = e.pointerType !== 'mouse'; e.preventDefault(); });
paper.addEventListener('pointermove', (e) => { Object.assign(ptr, toPaper(e.clientX, e.clientY)); ptr.inside = true; });
paper.addEventListener('pointerup', () => { ptr.pressed = false; });
paper.addEventListener('pointercancel', () => { ptr.pressed = false; });
paper.addEventListener('pointerleave', () => { ptr.inside = false; });
let gaze = null, predict = null, smooth = L.smoother(), gate = L.blinkGate();
const wob = { a: hash(1, 1) * 9, b: hash(2, 2) * 9 };
function updatePen(dt, t) {
  if (save.mode === 'gaze' && gaze && predict) {
    const st = gaze.state;
    pen.active = st.ok;
    if (st.ok && st.f) { const q = predict(st.f); pen.rawX = q.x; pen.rawY = q.y; const sm = smooth(clamp01(q.x), clamp01(q.y), Math.max(dt, 1 / 120)); pen.x = sm.x; pen.y = sm.y; }
    pen.blink = gate(st.blink || !st.ok, dt);
    pen.down = st.ok && !pen.blink;
  } else {
    // 指・マウス：目で描くのと同じくらいの「ゆらぎ」を足す（目かくしモード）
    const k = 0.008;
    const nx = Math.sin(t * 5.3 + wob.a) * k + Math.sin(t * 11.7) * k * 0.5, ny = Math.cos(t * 4.7 + wob.b) * k + Math.sin(t * 9.1 + 1) * k * 0.5;
    pen.x = clamp01(ptr.x + nx); pen.y = clamp01(ptr.y + ny);
    pen.active = ptr.pressed || (ptr.inside && !ptr.touch);
    pen.down = ptr.pressed;
  }
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------- 画面（カード） ----------
let scene = 'title';
let shownAt = 0;
function show(html, cls = '') { shownAt = ptr.pressed ? performance.now() : 0; screenEl.className = 'screen on ' + cls; screenEl.innerHTML = html; const b = screenEl.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
function hide() { screenEl.className = 'screen'; screenEl.innerHTML = ''; }
function hud(title, info = '') { $('hud').hidden = false; $('hTitle').textContent = title; $('hInfo').textContent = info; }
function setActions(list) { actions.classList.remove('stack'); actions.innerHTML = list.map(([label, a, cls = '']) => `<button class="btn ${cls}" data-a="${a}">${label}</button>`).join(''); actions.hidden = !list.length; }
function cap(t) { caption.textContent = t; }
$('bBack').onclick = () => { audio(); titleScreen(); };

function titleScreen() {
  scene = 'title'; timerOff(); setActions([]); cap(''); $('hud').hidden = true;
  const inp = save.mode === 'gaze' ? '👁 目で描く' : '☝ 指・マウスで描く';
  show(`<div class="card">
    <div class="tdemo"><canvas id="tdemo" width="360" height="360" aria-label="目で描いた絵の見本"></canvas></div>
    <p class="title-sub">目でかく スケッチブック</p>
    <h2 class="title-logo"><span class="c0">ま</span><span class="c1">な</span><span class="c2">ざ</span><span class="c3">し</span><span class="c4">の</span><br>アトリエ</h2>
    <p>目で絵を描く。ぶれた線で描いたお題を、友だちが当てる。</p>
    <p class="eye-badge">👁 カメラで目線を読んで描く（指・マウスでも遊べる）</p>
    <div class="col">
      <button class="pri" data-a="relay">ともだちと：お絵描き伝言</button>
      <button data-a="trace">ひとりで：点つなぎ</button>
      <button data-a="party">みんなで：交代モード（2〜4人）</button>
      <button data-a="atelier">アトリエ　${save.drawn.length}/100</button>
      <button data-a="input">描きかた：${inp}</button>
    </div>
    <p class="note">目で描くときはカメラを使います。映像はこの端末の中だけで使い、どこにも送らず保存もしません。</p>
    <p class="arcade"><a href="/">Game Arcade</a></p></div>`, 'title');
}

// ---------- 描きかたの選択と、目線の調整 ----------
let afterInput = null;
function inputScreen(next) {
  afterInput = next;
  show(`<div class="card"><h2>描きかた</h2>
    <p>どちらで描く？（あとで変えられます）</p>
    <div class="col">
      <button class="pri" data-a="useGaze">👁 目で描く（カメラを使う）</button>
      <button data-a="usePointer">☝ 指・マウスで描く</button>
    </div>
    <p class="note">目で描く：9つの的を順に見つめ、動く的を目で追って調整（約20秒）。目を動かすと筆が動き、目をぎゅっと閉じると筆が上がります。<br>映像はどこにも送らず、保存もしません。<br>指・マウス：押している間だけ描けます。目で描くのと同じくらい、線が少しゆれます。</p></div>`);
}
async function startGaze() {
  show('<div class="card"><h2>カメラを準備中…</h2><p class="sub">はじめてのときは、カメラの使用を「許可」してください。</p></div>');
  try {
    if (!gaze) { const { createGaze } = await import('./gaze.js'); gaze = await createGaze($('cam')); }
    $('cam').classList.add('on');
    save.mode = 'gaze'; persist();
    calibrate();
  } catch (e) {
    console.warn(e);
    save.mode = 'pointer'; persist();
    show(`<div class="card"><h2>カメラが使えませんでした</h2><p>カメラの許可がないか、この端末では目の読み取りが動きませんでした。</p><p>指・マウスで遊べます。</p><button class="pri" data-a="afterInput">指・マウスで続ける</button></div>`);
  }
}
// 調整：9つの点を順に見つめる → 動く点を目で追う（いろいろな位置のデータを集める）
const CAL = [[0.5, 0.5], [0.1, 0.1], [0.5, 0.1], [0.9, 0.1], [0.9, 0.5], [0.9, 0.9], [0.5, 0.9], [0.1, 0.9], [0.1, 0.5]];
const FIX = 1.5, PURSUIT = 7;
const pursuitAt = (u) => ({ x: 0.5 + Math.sin(u * Math.PI * 2 * 1.5) * 0.4, y: 0.5 + Math.sin(u * Math.PI * 2) * 0.38 });
let cal = null;
function calibrate(next) {
  if (next) afterInput = next;
  hide(); scene = 'calib'; hud('目線の調整', '1/2 点を見つめる'); timerOff(); setActions([]);
  cal = { i: 0, t: 0, phase: 'fix', samples: [] };
  cap('的の真ん中を、顔を動かさずに目で見つめてね');
}
function calTarget() {
  if (cal.phase === 'fix') { const [x, y] = CAL[Math.min(cal.i, CAL.length - 1)]; return { x, y }; }
  return pursuitAt(Math.min(1, cal.t / PURSUIT));
}
function stepCalib(dt) {
  const c = cal; c.t += dt;
  const st = gaze?.state, good = st?.ok && !st.blink && st.f;
  if (c.phase === 'fix') {
    if (c.t > 0.6 && good) c.samples.push({ f: st.f.slice(), x: CAL[c.i][0], y: CAL[c.i][1] });
    if (c.t > FIX) { c.i++; c.t = 0; sfx.link(c.i); if (c.i >= CAL.length) { c.phase = 'pursuit'; c.t = 0; hud('目線の調整', '2/2 動く的を目で追う'); cap('こんどは、動く的を目で追いかけてね'); } }
  } else {
    // 目は的より少し遅れて動くので、0.15秒前の位置を答えにする
    if (c.t > 0.8 && good) { const q = pursuitAt(Math.max(0, (c.t - 0.15) / PURSUIT)); c.samples.push({ f: st.f.slice(), x: q.x, y: q.y }); }
    if (c.t > PURSUIT) finishCalib();
  }
}
function finishCalib() {
  predict = L.fitGaze(cal.samples, 0.01); smooth = L.smoother(); gate = L.blinkGate();
  if (!predict || cal.samples.length < 40) {
    show(`<div class="card"><h2>うまく読み取れませんでした</h2><p>顔が画面の正面に入るようにして、明るい場所でもう一度。</p><div class="row"><button class="pri" data-a="recal">もう一度</button><button data-a="usePointer">指・マウスにする</button></div></div>`);
    return;
  }
  sfx.done(); scene = 'calibcheck';
  const e = predict.error, q = e < 0.07 ? 'とてもよい' : e < 0.12 ? 'まあまあ' : 'ずれ大きめ';
  hud('目線の調整', `たしかめ：精度「${q}」`);
  cap(e < 0.12 ? '筆先が、見ているところについてくる？' : 'ずれが大きめ。顔をもう少し近づけて、明るい場所でもう一度がおすすめ');
  setActions([['ついてくる！', 'afterInput', 'pri'], ['もう一度調整', 'recal']]);
}
function needInput(next) {
  if (save.mode === 'gaze' && gaze && predict) return next();
  if (save.mode === 'gaze' && !gaze) { afterInput = next; return startGaze(); }
  if (save.mode === 'pointer' && save.chosen) return next();
  inputScreen(next);
}

// ---------- 星座なぞり ----------
let trace = null, traceSky = 0, traceLv = 0, linkFx = [];
function levelsScreen() {
  scene = 'levels'; setActions([]); cap(''); $('hud').hidden = true;
  let h = '<div class="card"><h2>点つなぎ</h2><p class="sub">番号の点を順に見つめて、絵を完成させよう。</p>';
  L.SKIES.forEach((sky, si) => {
    h += `<div class="sky">${sky.name}${L.skyUnlocked(save, si) ? '' : '　🔒 前のページをぜんぶクリア'}</div><div class="levels">`;
    sky.levels.forEach((lv, li) => { const st = save.stars[`${si}-${li}`] || 0, ok = L.levelUnlocked(save, si, li) || params.has('unlock'); h += `<button data-a="lv" data-s="${si}" data-l="${li}" ${ok ? '' : 'disabled'}>${li + 1}<small>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</small></button>`; });
    h += '</div>';
  });
  show(h + '<button data-a="title">もどる</button></div>');
}
function startTrace(si, li) {
  hide(); traceSky = si; traceLv = li; const lv = L.SKIES[si].levels[li];
  trace = L.createTrace(lv); linkFx = []; scene = 'trace';
  hud(`${L.SKIES[si].name} ${li + 1}`, lv.name); timerOff(); setActions([]);
  const first = si === 0 && li === 0;
  cap(first ? (save.mode === 'gaze' ? '黄色い輪の点を見つめると、線がつながる' : '黄色い輪の点まで指でなぞると、線がつながる') : 'つぎの点へ');
}
function stepTrace(dt) {
  if (!pen.active) return;
  const gazeMode = save.mode === 'gaze' && predict;
  const radius = L.STAR_RADIUS * (gazeMode ? 1.6 : 1);
  const r = L.stepTrace(trace, pen, dt, radius);
  // 目で描くとき：次の点を見つめているあいだに、ずれを少しずつ直す
  if (gazeMode && !trace.done && trace.dwell > 0.08 && pen.rawX !== undefined) { const b = trace.level.stars[trace.next]; L.nudgeBias(predict, { x: pen.rawX, y: pen.rawY }, { x: b[0], y: b[1] }, Math.min(0.05, dt * 1.5)); }
  if (r === 'link' || r === 'done') { const s = trace.level.stars[trace.next - (r === 'done' ? 1 : 1)]; linkFx.push({ x: s[0], y: s[1], t: 0 }); sfx.link(trace.next); }
  if (r === 'done') {
    const stars = L.rateTrace(trace); save = L.recordStars(save, traceSky, traceLv, stars); persist(); sfx.done();
    scene = 'tracedone';
    setTimeout(() => {
      const last = traceLv === 4, nextOk = !last || traceSky < 2;
      show(`<div class="card"><p class="sub">${L.SKIES[traceSky].name} ${traceLv + 1}</p><h2>「${trace.level.name}」</h2>
        <div class="big-stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>
        <p class="sub">時間 ${trace.t.toFixed(1)}秒（目安 ${trace.level.par}秒）・線のきれいさ ${Math.max(0, Math.round(100 - (trace.dev / Math.max(1, trace.devN)) * 900))}点</p>
        <div class="row">${nextOk ? '<button class="pri" data-a="nextLv">つぎの絵へ</button>' : ''}<button data-a="retryLv">もう一度</button><button data-a="trace">ページえらび</button></div></div>`, 'clear');
    }, 700);
  }
}
function drawTrace(s, t) {
  const S = trace.level.stars;
  pctx.save(); pctx.lineCap = 'round';
  for (let i = 1; i < trace.next; i++) { const a = S[i - 1], b = S[i]; paintStroke(pctx, [{ x: a[0], y: a[1], t: 0 }, { x: b[0], y: b[1], t: 0 }], s, Infinity, null, i); }
  if (!trace.done) { const a = S[trace.next - 1], b = S[trace.next]; pctx.setLineDash([s * 0.01, s * 0.016]); pctx.strokeStyle = 'rgba(80,80,110,0.35)'; pctx.lineWidth = s * 0.004; pctx.beginPath(); pctx.moveTo(a[0] * s, a[1] * s); pctx.lineTo(b[0] * s, b[1] * s); pctx.stroke(); pctx.setLineDash([]); }
  pctx.restore();
  // 番号つきの点
  const first = new Map();
  S.forEach(([x, y], i) => { const k = `${x},${y}`; if (!first.has(k)) first.set(k, i); });
  first.forEach((i, k) => {
    const [x, y] = k.split(',').map(Number);
    const reached = S.slice(0, trace.next).some((q) => q[0] === x && q[1] === y), isNext = !trace.done && S[trace.next][0] === x && S[trace.next][1] === y;
    const pulse = isNext && !reduceMotion() ? 1 + Math.sin(t * 6) * 0.15 : 1;
    if (isNext) { pctx.fillStyle = 'rgba(255,180,0,0.25)'; pctx.beginPath(); pctx.arc(x * s, y * s, s * L.STAR_RADIUS * (save.mode === 'gaze' && predict ? 1.6 : 1) * pulse, 0, 7); pctx.fill(); pctx.strokeStyle = '#ffb400'; pctx.lineWidth = 3; pctx.beginPath(); pctx.arc(x * s, y * s, s * L.STAR_RADIUS * (save.mode === 'gaze' && predict ? 1.6 : 1) * (1 - trace.dwell / L.DWELL) * pulse, 0, 7); pctx.stroke(); }
    pctx.fillStyle = reached ? '#ff5a5f' : '#3a3a55'; pctx.beginPath(); pctx.arc(x * s, y * s, s * (isNext ? 0.016 : 0.012), 0, 7); pctx.fill();
    pctx.fillStyle = '#3a3a55'; pctx.font = `800 ${Math.round(s * 0.032)}px "Hiragino Maru Gothic ProN",sans-serif`; pctx.textAlign = 'center';
    pctx.fillText(i === 0 ? 'スタート' : String(i + 1), x * s, y * s - s * 0.03);
  });
  linkFx = linkFx.filter((f) => (f.t += 1 / 60) < 0.5);
  linkFx.forEach((f) => { for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, r = s * (0.02 + f.t * 0.12); pctx.fillStyle = CRAYON[k]; pctx.globalAlpha = 1 - f.t / 0.5; pctx.beginPath(); pctx.arc(f.x * s + Math.cos(a) * r, f.y * s + Math.sin(a) * r, s * 0.008, 0, 7); pctx.fill(); } pctx.globalAlpha = 1; });
}
function star4(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.38 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

// ---------- 描く（伝言・交代モード共通） ----------
const DRAW_SEC = 20;
let draw = null; // { promptId, seed, strokes, t, count, onDone }
function chooseScreen(title, seed, onPick) {
  const ids = L.pickPromptChoices(seed, 3);
  show(`<div class="card"><h2>${title}</h2><p>描くお題をえらんでね（20秒）</p><div class="col">${ids.map((id) => `<button class="pri" data-a="pick" data-i="${id}">${L.PROMPTS[id].name}</button>`).join('')}</div><button data-a="title" style="margin-top:12px">やめる</button></div>`);
  pickHandler = (id) => onPick(id, seed);
}
let pickHandler = null;
function startDraw(promptId, seed, onDone, who = '') {
  hide(); scene = 'draw'; draw = { promptId, seed, strokes: [], t: -3, cur: null, onDone, lastCount: 4 };
  hud(who ? `${who}さんの番` : 'お絵描き伝言', `お題：${L.PROMPTS[promptId].name}`);
  cap('3…'); setActions([['描きおわる', 'drawEnd']]); timerOn(1);
}
function stepDraw(dt) {
  draw.t += dt;
  if (draw.t < 0) { const c = Math.ceil(-draw.t); if (c !== draw.lastCount) { draw.lastCount = c; cap(`${c}…`); sfx.tick(); } return; }
  if (draw.lastCount > 0) { draw.lastCount = 0; sfx.start(); cap(save.mode === 'gaze' ? '描いて！ 目をぎゅっと閉じると筆が上がる' : '描いて！ 押している間だけ線が引ける'); }
  timerSet(1 - draw.t / DRAW_SEC);
  const left = Math.ceil(DRAW_SEC - draw.t); if (left !== draw.left) { draw.left = left; $('hInfo').textContent = `お題：${L.PROMPTS[draw.promptId].name}　残り ${left}秒`; if (left <= 5) sfx.tick(); }
  if (pen.down) { if (!draw.cur) { draw.cur = []; draw.strokes.push(draw.cur); } const l = draw.cur[draw.cur.length - 1]; if (!l || Math.hypot(pen.x - l.x, pen.y - l.y) > 0.003) draw.cur.push({ x: pen.x, y: pen.y, t: draw.t }); }
  else draw.cur = null;
  if (draw.t >= DRAW_SEC) endDraw();
}
function endDraw() {
  if (scene !== 'draw') return;
  scene = 'drawn'; timerOff(); sfx.done();
  const d = { promptId: draw.promptId, seed: draw.seed, strokes: draw.strokes.filter((s) => s.length) };
  save = L.addToGallery(save, { promptId: d.promptId, code: L.encodeDrawing(d), at: Date.now() }); persist();
  draw.onDone(d);
}

// ---------- お絵描き伝言 ----------
let replay = null; // { strokes, t, dur }
function relayStart() { needInput(() => chooseScreen('お絵描き伝言', (Math.random() * 65535) | 0, (id, seed) => startDraw(id, seed, relayDone))); }
function relayDone(d) {
  replay = { strokes: d.strokes, t: 0, dur: Math.max(1, L.drawingDuration(d.strokes)) };
  hud('お絵描き伝言', `お題：${L.PROMPTS[d.promptId].name}`);
  const url = location.href.split('#')[0] + '#d=' + L.encodeDrawing(d);
  lastShare = url;
  cap(`できた！ 目で描いた「${L.PROMPTS[d.promptId].name}」`);
  setActions([['友だちに送る', 'share', 'pri'], ['もう一枚', 'relay'], ['タイトル', 'title']]);
}
let lastShare = '';
async function share() {
  const text = 'まなざしのアトリエ：目で描いた絵、なにに見える？';
  try { if (navigator.share) { await navigator.share({ title: 'まなざしのアトリエ', text, url: lastShare }); return; } } catch { /* キャンセル */ }
  try { await navigator.clipboard.writeText(lastShare); cap('リンクをコピーした！ 友だちに送ってね'); } catch { show(`<div class="card"><h2>このリンクを送ってね</h2><p class="share">${lastShare}</p><button class="pri" data-a="closeCard">とじる</button></div>`); }
}

// ---------- 受け取って当てる ----------
let guess = null;
function guessStart(code) {
  let d; try { d = L.decodeDrawing(code); } catch { show('<div class="card"><h2>絵が読めませんでした</h2><p>リンクが途中で切れているかもしれません。</p><button class="pri" data-a="title">タイトルへ</button></div>'); return; }
  hide(); scene = 'guess';
  guess = { d, t: 0, tries: 0, done: false, choices: L.guessChoices(d.promptId, d.seed), wrong: [] };
  replay = { strokes: d.strokes, t: 0, dur: Math.max(1, L.drawingDuration(d.strokes)) };
  hud('友だちの絵が届いた', '目で描かれた絵。なにに見える？');
  cap('線が描かれていく…分かったらすぐ答えて！');
  renderGuessActions();
}
function renderGuessActions() {
  actions.hidden = false;
  actions.classList.add('stack');
  actions.innerHTML = `<div class="choice" style="width:min(94vw,520px)">${guess.choices.map((id) => `<button class="btn ${guess.wrong.includes(id) ? 'ng' : ''}" data-a="guessPick" data-i="${id}" ${guess.wrong.includes(id) ? 'disabled' : ''}>${L.PROMPTS[id].name}</button>`).join('')}</div>
    <form class="answer" style="width:min(94vw,520px)" data-f="free"><input id="freeAns" placeholder="自分の言葉で答える" autocomplete="off"><button class="btn" type="submit">答える</button></form>`;
}
function answer(ok) {
  if (guess.done) return;
  guess.tries++;
  if (ok) { guess.done = true; sfx.ok(); guessResult(true); }
  else { sfx.ng(); cap('ちがうみたい…もう一回！'); if (guess.tries >= 3) { guess.done = true; guessResult(false); } }
}
function guessResult(ok) {
  const name = L.PROMPTS[guess.d.promptId].name, txt = L.shareText({ correct: ok, seconds: guess.t, tries: guess.tries });
  lastShareText = txt;
  show(`<div class="card"><h2>${ok ? '伝わった！' : '答えは…'}</h2><p style="font-size:26px;margin:4px 0">「${name}」</p>
    <p class="sub">${ok ? `${guess.t.toFixed(1)}秒・${guess.tries}回目で正解` : '目で描くと、こんなにぶれる。'}</p>
    <p class="share">${txt}</p>
    <div class="row"><button class="pri" data-a="relay">自分も描いて送り返す</button><button data-a="copyText">結果をコピー</button></div>
    <button data-a="title" style="margin-top:8px">タイトルへ</button></div>`, 'clear');
}
let lastShareText = '';

// ---------- 交代モード ----------
let party = null;
function partySetup() {
  show(`<div class="card names"><h2>交代モード</h2><p class="sub">ひとりが描いて、ほかの人が声で当てる。3周で結果発表。</p>
    ${[0, 1, 2, 3].map((i) => `<input id="pn${i}" placeholder="${i < 2 ? `プレイヤー${i + 1}` : `プレイヤー${i + 1}（いなければ空欄）`}" maxlength="8">`).join('')}
    <div class="row"><button class="pri" data-a="partyGo">はじめる</button><button data-a="title">もどる</button></div>
    <p class="note">目で描く場合は、描く人が変わるたびに目線を調整します（約20秒）。</p></div>`);
}
function partyNext() {
  const p = party, d = L.partyDrawer(p);
  show(`<div class="card"><p class="sub">${p.round + 1}周目／3周　${p.players.map((pl) => `${pl.name} ${pl.score}点`).join('　')}</p><h2>${d.name}さんの番</h2><p>${d.name}さん以外は、お題を見ないでね。</p><button class="pri" data-a="partyReady">お題を見る</button></div>`);
}
function partyDraw() {
  const d = L.partyDrawer(party);
  const go = () => chooseScreen(`${d.name}さんのお題`, (Math.random() * 65535) | 0, (id, seed) => startDraw(id, seed, partyJudge, d.name));
  if (save.mode === 'gaze' && gaze) calibrate(go); else needInput(go);
}
function partyJudge(dd) {
  party.lastPrompt = dd.promptId;
  replay = { strokes: dd.strokes, t: 0, dur: Math.max(1, L.drawingDuration(dd.strokes)) };
  const di = party.turn % party.players.length;
  show(`<div class="card"><h2>だれが当てた？</h2><p>お題は「${L.PROMPTS[dd.promptId].name}」</p><p class="sub">${party.players.map((pl) => `${pl.name} ${pl.score}点`).join('　')}</p><div class="col">${party.players.map((pl, i) => (i === di ? '' : `<button class="pri" data-a="partyHit" data-i="${i}">${pl.name}</button>`)).join('')}<button data-a="partyHit" data-i="-1">だれも当てられなかった</button></div></div>`, 'clear sheet');
}
function partyRank() {
  const r = L.partyRanking(party);
  show(`<div class="card"><h2>結果発表</h2><ol class="rank">${r.map((x, i) => `<li><span>${i + 1}位　${x.name}</span><b>${x.score}点</b></li>`).join('')}</ol><p class="sub">描いた絵はアトリエに飾られています。</p><div class="row"><button class="pri" data-a="party">もう一回</button><button data-a="atelier">アトリエを見る</button></div><button data-a="title" style="margin-top:8px">タイトルへ</button></div>`);
}

// ---------- アトリエ（図鑑） ----------
function atelierScreen() {
  scene = 'atelier'; setActions([]); cap(''); $('hud').hidden = true;
  const items = save.gallery.slice(0, 60);
  show(`<div class="card"><h2>アトリエ</h2><p class="sub">描いたお題 ${save.drawn.length}/100　（飾った絵 ${save.gallery.length}枚）</p>
    ${items.length ? `<div class="gallery">${items.map((g, i) => `<button data-a="viewArt" data-i="${i}"><canvas data-g="${i}" width="160" height="160"></canvas><span>${L.PROMPTS[g.promptId]?.name ?? '？'}</span></button>`).join('')}</div>` : '<p>まだ絵がありません。お絵描き伝言か交代モードで描くと、ここに飾られます。</p>'}
    <div class="sky">お題の図鑑</div>
    ${L.CATEGORIES.map((c) => { const all = L.PROMPTS.filter((p) => p.cat === c); return `<div class="dex"><b>${c} ${all.filter((p) => save.drawn.includes(p.id)).length}/${all.length}</b><div>${all.map((p) => (save.drawn.includes(p.id) ? `<span class="got">${p.name}</span>` : '<span>？</span>')).join('')}</div></div>`; }).join('')}
    <button data-a="title">もどる</button></div>`);
  screenEl.querySelectorAll('canvas[data-g]').forEach((c) => { try { const d = L.decodeDrawing(items[+c.dataset.g].code); const x = c.getContext('2d'); x.fillStyle = '#fffdf7'; x.fillRect(0, 0, 160, 160); d.strokes.forEach((s, i) => paintStroke(x, s, 160, Infinity, null, i)); } catch { /* 壊れた絵は飛ばす */ } });
}
function viewArt(i) {
  const g = save.gallery[i]; let d; try { d = L.decodeDrawing(g.code); } catch { return; }
  hide(); scene = 'view'; replay = { strokes: d.strokes, t: 0, dur: Math.max(1, L.drawingDuration(d.strokes)) };
  lastShare = location.href.split('#')[0] + '#d=' + g.code;
  hud('アトリエ', `「${L.PROMPTS[g.promptId].name}」`); cap(new Date(g.at).toLocaleDateString('ja-JP'));
  setActions([['友だちに送る', 'share', 'pri'], ['もう一度見る', 'replayAgain'], ['もどる', 'atelier']]);
}

// ---------- タイマー ----------
function timerOn(v) { $('timer').hidden = false; timerSet(v); }
function timerSet(v) { $('timerFill').style.width = `${Math.max(0, v) * 100}%`; }
function timerOff() { $('timer').hidden = true; }

// ---------- クリック ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  // 描いている指を離した瞬間に、出たばかりのカードのボタンを押してしまわないように
  if (screenEl.contains(b) && shownAt && performance.now() - shownAt < 600) return;
  audio();
  const a = b.dataset.a;
  if (a === 'title') { hide(); titleScreen(); }
  else if (a === 'relay') { hide(); relayStart(); }
  else if (a === 'trace') { needInput(levelsScreen); }
  else if (a === 'party') { needInput(partySetup); }
  else if (a === 'atelier') atelierScreen();
  else if (a === 'input') inputScreen(titleScreen);
  else if (a === 'useGaze') startGaze();
  else if (a === 'usePointer') { save.mode = 'pointer'; save.chosen = true; persist(); $('cam').classList.remove('on'); (afterInput || titleScreen)(); }
  else if (a === 'afterInput') { const f = afterInput || titleScreen; afterInput = null; setActions([]); f(); }
  else if (a === 'recal') calibrate();
  else if (a === 'lv') startTrace(+b.dataset.s, +b.dataset.l);
  else if (a === 'nextLv') { let s = traceSky, l = traceLv + 1; if (l > 4) { s++; l = 0; } startTrace(s, l); }
  else if (a === 'retryLv') startTrace(traceSky, traceLv);
  else if (a === 'pick') pickHandler && pickHandler(+b.dataset.i);
  else if (a === 'drawEnd') endDraw();
  else if (a === 'share') share();
  else if (a === 'closeCard') hide();
  else if (a === 'guessPick') { const id = +b.dataset.i; if (id === guess.d.promptId) answer(true); else { guess.wrong.push(id); answer(false); if (!guess.done) renderGuessActions(); } }
  else if (a === 'copyText') { navigator.clipboard?.writeText(lastShareText).then(() => { b.textContent = 'コピーした！'; }, () => {}); }
  else if (a === 'partyGo') { const names = [0, 1, 2, 3].map((i) => $(`pn${i}`).value.trim()).map((n, i) => n || (i < 2 ? `プレイヤー${i + 1}` : '')).filter(Boolean); party = L.createParty(names); partyNext(); }
  else if (a === 'partyReady') partyDraw();
  else if (a === 'partyHit') { const end = L.partyResolve(party, +b.dataset.i, party.lastPrompt); if (end) partyRank(); else partyNext(); }
  else if (a === 'viewArt') viewArt(+b.dataset.i);
  else if (a === 'replayAgain') { if (replay) replay.t = 0; }
});
document.addEventListener('submit', (e) => {
  if (e.target.dataset.f !== 'free') return; e.preventDefault();
  const v = $('freeAns').value; if (!v.trim()) return;
  answer(L.isCorrect(guess.d.promptId, v));
  if (!guess.done) { $('freeAns').value = ''; }
});

// ---------- ループ ----------
let lastT = 0;
function frame(ts) {
  const t = ts / 1000, dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t;
  updatePen(dt, t);
  if (scene === 'calib') stepCalib(dt);
  else if (scene === 'trace') stepTrace(dt);
  else if (scene === 'draw') stepDraw(dt);
  if (guess && scene === 'guess' && !guess.done) guess.t += dt;
  if (replay && (scene === 'drawn' || scene === 'guess' || scene === 'view')) replay.t = Math.min(replay.dur + 0.5, replay.t + dt * (scene === 'guess' ? 1 : 1.6));
  render(t);
  const td = $('tdemo');
  if (td) { const x = td.getContext('2d'); if (!demoTex) demoTex = makePaperSized(360); x.drawImage(demoTex, 0, 0); demoStrokes.forEach((st, i) => paintStroke(x, st, 360, reduceMotion() ? 99 : (t * 1.2 + 7) % 10, null, i)); }
  requestAnimationFrame(frame);
}
function render(t) {
  drawBg(t);
  const s = paper.width;
  if (!paperTex) paperTex = makePaper();
  pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.drawImage(paperTex, 0, 0);
  if (scene === 'calib') {
    const { x, y } = calTarget(), k = cal.phase === 'fix' ? Math.min(1, cal.t / FIX) : Math.min(1, cal.t / PURSUIT);
    [['#ff5a5f', 0.05], ['#fffdf7', 0.036], ['#2bb3ff', 0.024], ['#3a3a55', 0.01]].forEach(([c, r]) => { pctx.fillStyle = c; pctx.beginPath(); pctx.arc(x * s, y * s, s * r, 0, 7); pctx.fill(); });
    pctx.strokeStyle = '#ffb400'; pctx.lineWidth = 4; pctx.beginPath(); pctx.arc(x * s, y * s, s * 0.05, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); pctx.stroke();
  } else if (scene === 'trace' || scene === 'tracedone') drawTrace(s, t);
  else if (scene === 'draw' || scene === 'drawn' || scene === 'guess' || scene === 'view') {
    if (scene === 'draw') draw.strokes.forEach((st, i) => paintStroke(pctx, st, s, Infinity, null, i));
    else if (replay) replay.strokes.forEach((st, i) => paintStroke(pctx, st, s, replay.t, null, i));
    if (scene === 'draw' && draw.t < 0) { pctx.fillStyle = CRAYON[Math.ceil(-draw.t) % CRAYON.length]; pctx.font = `800 ${Math.round(s * 0.25)}px "Hiragino Maru Gothic ProN",sans-serif`; pctx.textAlign = 'center'; pctx.textBaseline = 'middle'; pctx.fillText(String(Math.ceil(-draw.t)), s / 2, s / 2); pctx.textBaseline = 'alphabetic'; }
  } else if (scene === 'title' || scene === 'levels' || scene === 'atelier') {
    demoStrokes.forEach((st, i) => paintStroke(pctx, st, s, ((t * 1.2) % 9), null, i));
  }
  // 筆先
  if (['calibcheck', 'trace', 'draw'].includes(scene) && pen.active) {
    const x = pen.x * s, y = pen.y * s, r = s * 0.022;
    const col = scene === 'draw' ? CRAYON[draw.strokes.length % CRAYON.length] : '#ffb400';
    pctx.fillStyle = pen.down ? col : 'rgba(255,255,255,0.6)'; pctx.globalAlpha = pen.down ? 0.9 : 1; pctx.beginPath(); pctx.arc(x, y, r * 0.7, 0, 7); pctx.fill(); pctx.globalAlpha = 1;
    pctx.strokeStyle = pen.down ? '#3a3a55' : col; pctx.lineWidth = 2.5; pctx.setLineDash(pen.down ? [] : [4, 4]); pctx.beginPath(); pctx.arc(x, y, r, 0, 7); pctx.stroke(); pctx.setLineDash([]);
  }
}

// タイトル画面の飾り：目で描いた風の「ねこ」
function wobbleShape(fn, n, t0, dur, seed) {
  const pts = []; for (let i = 0; i <= n; i++) { const u = i / n, [x, y] = fn(u); pts.push({ x: x + (hash(i, seed, 3) - 0.5) * 0.03 + Math.sin(u * 17 + seed) * 0.01, y: y + (hash(i, seed, 4) - 0.5) * 0.03 + Math.cos(u * 13 + seed) * 0.01, t: t0 + u * dur }); } return pts;
}
const demoStrokes = [
  wobbleShape((u) => [0.5 + Math.cos(u * Math.PI * 2) * 0.24, 0.56 + Math.sin(u * Math.PI * 2) * 0.2], 40, 0, 2.4, 1),
  wobbleShape((u) => [0.3 + u * 0.08, 0.4 - Math.sin(u * Math.PI) * 0.2], 10, 2.6, 0.7, 2),
  wobbleShape((u) => [0.62 + u * 0.08, 0.4 - Math.sin(u * Math.PI) * 0.2], 10, 3.4, 0.7, 3),
  wobbleShape((u) => [0.42, 0.52 + u * 0.02], 3, 4.3, 0.2, 4),
  wobbleShape((u) => [0.58, 0.52 + u * 0.02], 3, 4.6, 0.2, 5),
  wobbleShape((u) => [0.44 + u * 0.12, 0.64 + Math.sin(u * Math.PI) * 0.04], 8, 5, 0.6, 6),
  wobbleShape((u) => [0.28 - u * 0.16, 0.6 + u * 0.02], 6, 5.8, 0.4, 7),
  wobbleShape((u) => [0.72 + u * 0.16, 0.6 + u * 0.02], 6, 6.3, 0.4, 8),
];

// ---------- 起動 ----------
resize();
if (OG) {
  scene = 'drawn'; replay = { strokes: demoStrokes, t: 99, dur: 7 };
  hud('お絵描き伝言', '目で描いた「ねこ」'); cap('友だちは当てられる？'); setActions([['友だちに送る', 'x', 'pri']]);
} else if (location.hash.startsWith('#d=')) {
  guessStart(location.hash.slice(3));
} else titleScreen();
if (save.mode === 'gaze') save.mode = 'gaze'; // 目で描く設定でも、カメラは遊び始めるときに起動する
window.__atelier = { L, pen, scene: () => scene, setPointer: (x, y, down) => { ptr.x = x; ptr.y = y; ptr.pressed = down; ptr.inside = true; ptr.touch = false; } };
requestAnimationFrame(frame);
