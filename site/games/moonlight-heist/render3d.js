// 立体の描画（three.js）。ルールは logic.js のまま、見せ方だけを3Dにする。
// 世界観：夜空に浮かぶ「月の館」。雲海の上の島に建ち、窓から月光が差し、夜守のランタンが床を照らす。
import * as THREE from './vendor/three.module.min.js';

const WALL_BACK = 2.6, WALL_LOW = 0.75;
const CH_THEME = [
  { floor: '#1c2550', floor2: '#28336a', marble: '#d9d4ea', trim: '#d4af5a', sky: ['#070618', '#1d1a4a'], fog: 0x0d0c2a, amb: 0x6a70c0, moon: 0xbfd0ff },
  { floor: '#16302c', floor2: '#1f4038', marble: '#d8e0d0', trim: '#d9914a', sky: ['#050e10', '#14302a'], fog: 0x08181a, amb: 0x5aa090, moon: 0xc8ffe8 },
  { floor: '#1a1030', floor2: '#2a1840', marble: '#d6cce0', trim: '#e8ecff', sky: ['#080410', '#2a0c24'], fog: 0x0c0614, amb: 0x8a5a9a, moon: 0xffc8d8 },
];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const glowTex = canvasTex(64, 64, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
function glowSprite(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}
const hsh = (a, b, s = 0) => { let x = (a * 374761393 + b * 668265263 + s * 1274126177) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967295; };

export function create3D(canvas, deps) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch { return null; }
  if (!renderer.getContext()) return null;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let world = null, built = null, motes = null, W = 1, H = 1;

  // ---- 空：夜空の球と星、遠くの月、雲海 ----
  const skyTex = canvasTex(8, 256, () => {});
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), skyMat); scene.add(sky);
  const starGeo = new THREE.BufferGeometry(); const sp = [];
  for (let i = 0; i < 900; i++) { const u = hsh(i, 1, 9) * Math.PI * 2, v = 0.05 + hsh(i, 2, 9) * 0.9; sp.push(Math.cos(u) * Math.cos(v) * 80, Math.sin(v) * 80, Math.sin(u) * Math.cos(v) * 80); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6dc, size: 0.35, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.9 }));
  scene.add(stars);
  const lowGeo = new THREE.BufferGeometry(); const lp = [];
  for (let i = 0; i < 700; i++) lp.push((hsh(i, 11, 5) - 0.5) * 120, -12 - hsh(i, 12, 5) * 6, (hsh(i, 13, 5) - 0.5) * 120);
  lowGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  const lowStars = new THREE.Points(lowGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xfff0d0, size: 0.6, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(lowStars);
  // 下に広がる夜空（雲海の下の深い紺）
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x07051a, fog: false })); abyss.rotation.x = -Math.PI / 2; abyss.position.y = -20; scene.add(abyss);
  const moonTex = canvasTex(256, 256, (c, w) => { c.fillStyle = '#fbf3da'; c.beginPath(); c.arc(w / 2, w / 2, w * 0.46, 0, 7); c.fill(); c.fillStyle = 'rgba(190,180,160,0.35)'; [[0.38, 0.4, 0.09], [0.6, 0.55, 0.12], [0.48, 0.7, 0.06]].forEach(([x, y, r]) => { c.beginPath(); c.arc(w * x, w * y, w * r, 0, 7); c.fill(); }); });
  const moonMesh = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false }));
  scene.add(moonMesh);
  const moonGlow = glowSprite(0xfff0d0, 40, 0.55); moonGlow.material.fog = false; scene.add(moonGlow);
  const cloudTex = canvasTex(256, 256, (c, w) => { for (let i = 0; i < 40; i++) { const x = hsh(i, 3) * w, y = hsh(i, 4) * w, r = 20 + hsh(i, 5) * 50; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); } });
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping; cloudTex.repeat.set(6, 6);
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: cloudTex, color: 0x6a58c0, transparent: true, opacity: 0.4, depthWrite: false, fog: false }));
  clouds.rotation.x = -Math.PI / 2; clouds.position.y = -7; scene.add(clouds);
  const clouds2 = clouds.clone(); clouds2.material = clouds.material.clone(); clouds2.material.opacity = 0.22; clouds2.position.y = -4.5; clouds2.material.color = new THREE.Color(0xb0a0ff); scene.add(clouds2);

  const hemi = new THREE.HemisphereLight(0x8090ff, 0x201030, 0.55); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xbfd0ff, 1.6); moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0008; moon.shadow.normalBias = 0.02; scene.add(moon); scene.add(moon.target);

  function setSky(th, dark) {
    const c = skyTex.image.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, '#3a2a6a'); c.fillStyle = g; c.fillRect(0, 0, 8, 256); skyTex.needsUpdate = true;
    scene.fog = new THREE.FogExp2(th.fog, 0.012);
    hemi.color.set(th.amb); hemi.intensity = dark ? 0.18 : 0.55;
    moon.color.set(th.moon); moon.intensity = dark ? 0.25 : 1.6;
    moonMesh.visible = moonGlow.visible = !dark;
  }

  // ---- 素材 ----
  const mats = {};
  function themeMats(th) {
    const floorTex = canvasTex(512, 512, (c, w) => {
      c.fillStyle = th.floor; c.fillRect(0, 0, w, w);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.globalAlpha = 0.25 + hsh(i, j, 3) * 0.35; c.fillStyle = th.floor2; c.fillRect(i * 64, j * 64, 64, 64); }
      c.globalAlpha = 1; c.strokeStyle = 'rgba(212,175,90,0.35)'; c.lineWidth = 2;
      for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, w); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); }
      c.strokeStyle = 'rgba(220,225,255,0.07)'; c.lineWidth = 1.5;
      for (let i = 0; i < 30; i++) { c.beginPath(); const x = hsh(i, 7) * w, y = hsh(i, 8) * w; c.moveTo(x, y); c.bezierCurveTo(x + 40, y + 20, x - 20, y + 60, x + 30, y + 110); c.stroke(); }
      c.fillStyle = 'rgba(240,210,130,0.75)'; for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(hsh(i, 9) * w, hsh(i, 10) * w, 1.6, 0, 7); c.fill(); }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    mats.floor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.22, metalness: 0.15 });
    mats.marble = new THREE.MeshStandardMaterial({ color: th.marble, roughness: 0.45, metalness: 0.05 });
    mats.wallDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.marble).multiplyScalar(0.55), roughness: 0.6 });
    mats.capStone = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.floor2).multiplyScalar(1.6), roughness: 0.5, metalness: 0.2 });
    mats.gold = new THREE.MeshStandardMaterial({ color: th.trim, roughness: 0.3, metalness: 0.85, emissive: new THREE.Color(th.trim).multiplyScalar(0.12) });
    mats.rock = new THREE.MeshStandardMaterial({ color: 0x2a2048, roughness: 0.95, flatShading: true });
    mats.glass = new THREE.MeshStandardMaterial({ color: 0xbfd8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false });
    mats.statue = new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.6, emissive: 0x3a3020, emissiveIntensity: 0.4 });
    mats.mirror = new THREE.MeshStandardMaterial({ color: 0x9ab0ff, roughness: 0.02, metalness: 1, emissive: 0x1a2050 });
    mats.leaf = new THREE.MeshStandardMaterial({ color: 0x1f6a52, roughness: 0.6 });
    mats.flower = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xd8d8ff, emissiveIntensity: 1.2 });
    mats.book = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c, w) => { c.fillStyle = '#3a2238'; c.fillRect(0, 0, w, w); for (let r = 0; r < 4; r++) { let x = 4; for (let i = 0; x < w - 6; i++) { const bw = 8 + hsh(i, r) * 10, bh = 18 + hsh(i, r, 2) * 10; c.fillStyle = ['#7a2a4a', '#2a3a7a', '#3a6a5a', '#6a4a2a', '#4a2a6a'][(i + r) % 5]; c.fillRect(x, r * 32 + 30 - bh, bw - 2, bh); c.fillStyle = '#d4af5a'; c.fillRect(x + 1, r * 32 + 30 - bh * 0.6, bw - 4, 2); x += bw; } c.fillStyle = '#d4af5a'; c.fillRect(0, r * 32 + 30, w, 2); } }), roughness: 0.8 });
  }

  // ---- 部品 ----
  function statue(x, z, tone = 0xf2ead6) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.3, 20), mats.marble); base.position.y = 0.15; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 8, 32), mats.gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    const m = mats.statue.clone(); m.color.set(tone);
    const body = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.32, 0), new THREE.Vector2(0.3, 0.3), new THREE.Vector2(0.2, 0.7), new THREE.Vector2(0.12, 0.9), new THREE.Vector2(0.0, 0.92)], 20), m); body.position.y = 0.3; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), m); head.position.y = 1.32; g.add(head);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 8, 32, Math.PI * 1.4), mats.gold); halo.position.set(0, 1.35, -0.12); halo.rotation.z = -Math.PI * 0.2; g.add(halo);
    g.position.set(x + 0.5, 0, z + 0.5);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  function displayCase(x, z, k) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.55, 0.82), mats.wallDark); base.position.y = 0.275; g.add(base);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.05, 0.88), mats.gold); cap.position.y = 0.57; g.add(cap);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass); dome.position.y = 0.6; dome.scale.y = 1.3; g.add(dome);
    const col = [0xffe0a0, 0x8ad0ff, 0xff8ad0, 0xa0ffc8][k % 4];
    const geo = [new THREE.IcosahedronGeometry(0.12, 0), new THREE.TorusKnotGeometry(0.08, 0.025, 48, 8), new THREE.OctahedronGeometry(0.13), new THREE.ConeGeometry(0.1, 0.25, 6)][k % 4];
    const obj = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 })); obj.position.y = 0.82; obj.userData.spin = true; g.add(obj);
    const gl = glowSprite(col, 1.1, 0.5); gl.position.y = 0.82; g.add(gl);
    g.position.set(x + 0.5, 0, z + 0.5);
    base.castShadow = true; base.receiveShadow = true;
    return g;
  }
  function plant(x, z) {
    const g = new THREE.Group();
    const urn = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.18, 0), new THREE.Vector2(0.3, 0.2), new THREE.Vector2(0.3, 0.38), new THREE.Vector2(0.34, 0.42)], 16), mats.marble); g.add(urn);
    for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 5), mats.leaf); const a = i / 9 * Math.PI * 2; l.position.set(Math.cos(a) * 0.12, 0.75, Math.sin(a) * 0.12); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); l.castShadow = true; g.add(l); }
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.flower); const a = i * 2.1; f.position.set(Math.cos(a) * 0.22, 1.0 + i * 0.05, Math.sin(a) * 0.22); g.add(f); const s = glowSprite(0xd8d8ff, 0.5, 0.6); s.position.copy(f.position); g.add(s); }
    g.position.set(x + 0.5, 0, z + 0.5); urn.castShadow = true;
    return g;
  }
  function mirror(x, z) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), mats.mirror); m.scale.y = 1.35; m.position.y = 0.85; g.add(m);
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), mats.wallDark); back.scale.y = 1.35; back.position.set(0, 0.85, -0.02); back.rotation.y = Math.PI; g.add(back);
    const fr = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.04, 8, 40), mats.gold); fr.scale.y = 1.35; fr.position.y = 0.85; g.add(fr);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 0.35, 8), mats.gold); st.position.y = 0.17; g.add(st);
    g.position.set(x + 0.5, 0, z + 0.5); fr.castShadow = true;
    return g;
  }
  function glassPane(x, z) {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.3, 0.96), mats.glass); p.position.y = 0.65; g.add(p);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 1.3, 0.96)), new THREE.LineBasicMaterial({ color: 0xd4af5a })); e.position.y = 0.65; g.add(e);
    g.position.set(x + 0.5, 0, z + 0.5); return g;
  }
  function bookDoor(x, z) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.6, 0.96), mats.book); b.position.set(x + 0.5, 0.8, z + 0.5); b.castShadow = true; b.receiveShadow = true; return b;
  }
  function pedestal(x, z) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 16), mats.marble); c.position.y = 0.35; c.castShadow = true; g.add(c);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), mats.gold); t.position.y = 0.72; g.add(t);
    g.position.set(x + 0.5, 0, z + 0.5); return g;
  }
  function picture(c1) {
    return canvasTex(128, 96, (c, w, h) => { c.fillStyle = c1; c.fillRect(0, 0, w, h); c.fillStyle = '#fbf3da'; c.beginPath(); c.arc(w * 0.7, h * 0.35, 14, 0, 7); c.fill(); c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.moveTo(0, h); c.lineTo(w * 0.3, h * 0.55); c.lineTo(w * 0.55, h * 0.75); c.lineTo(w * 0.8, h * 0.5); c.lineTo(w, h); c.fill(); });
  }
  const pics = ['#1c3a7a', '#2a5a5a', '#5a2a3a', '#3a2a6a'].map(picture);

  // ---- 登場人物 ----
  function makeKeeper() {
    const g = new THREE.Group();
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x8a70e0, roughness: 0.5, emissive: 0x4a30a0, emissiveIntensity: 0.8, transparent: true, opacity: 0.88 });
    const cloak = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.42, 0), new THREE.Vector2(0.36, 0.3), new THREE.Vector2(0.24, 0.8), new THREE.Vector2(0.18, 1.1), new THREE.Vector2(0.0, 1.25)], 20), cloakMat); cloak.position.y = 0.08; cloak.castShadow = true; g.add(cloak);
    [-1, 1].forEach((k) => { const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), cloakMat); h.position.set(k * 0.13, 1.42, 0); h.rotation.z = -k * 0.35; g.add(h); });
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), new THREE.MeshStandardMaterial({ color: 0xf2eedf, roughness: 0.35 })); mask.scale.set(1.25, 1.4, 0.7); mask.position.set(0, 1.12, 0.16); g.add(mask);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x8ad8ff });
    const eyes = [-1, 1].map((k) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat); e.position.set(k * 0.08, 1.14, 0.29); e.scale.setScalar(1.4); g.add(e); return e; });
    const lantern = new THREE.Group();
    const lb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd080, emissiveIntensity: 2 })); lantern.add(lb);
    const lf = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.17), mats.gold); lf.position.y = 0.1; lantern.add(lf);
    const light = new THREE.PointLight(0xffb070, 2.6, 4.5, 1.6); lantern.add(light);
    const lg = glowSprite(0xffc080, 1.4, 0.8); lantern.add(lg);
    lantern.position.set(0.3, 0.75, 0.28); g.add(lantern);
    const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, () => {}), transparent: true, depthTest: false })); mark.scale.set(0.6, 0.6, 1); mark.position.y = 1.9; mark.visible = false; g.add(mark);
    g.userData = { eyes, eyeMat, light, lg, mark, markState: '' };
    return g;
  }
  function makeLou() {
    const g = new THREE.Group();
    const capeMat = new THREE.MeshStandardMaterial({ color: 0x2e2878, roughness: 0.6, emissive: 0x0e0a30 });
    const cape = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.3, 0), new THREE.Vector2(0.26, 0.2), new THREE.Vector2(0.16, 0.55), new THREE.Vector2(0.0, 0.62)], 18), capeMat); cape.position.y = 0.05; cape.castShadow = true; g.add(cape);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.02, 6, 24), mats.gold); hem.rotation.x = Math.PI / 2; hem.position.y = 0.07; g.add(hem);
    const head = new THREE.Group(); head.position.y = 0.82; g.add(head);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 16), capeMat); hood.castShadow = true; head.add(hood);
    [-1, 1].forEach((k) => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), capeMat); e.position.set(k * 0.15, 0.24, -0.02); e.rotation.z = -k * 0.3; head.add(e); });
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), new THREE.MeshStandardMaterial({ color: 0xf8e2c8, roughness: 0.6 })); face.position.set(0, -0.02, 0.1); face.scale.set(1, 0.95, 0.8); head.add(face);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.22), new THREE.MeshStandardMaterial({ color: 0xe6e4ff, roughness: 0.4, emissive: 0x302850 })); hair.position.set(0, 0.06, 0.08); hair.rotation.x = 0.35; head.add(hair);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xf1c25a });
    [-1, 1].forEach((k) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeM); e.scale.y = 1.4; e.position.set(k * 0.07, -0.02, 0.26); head.add(e); });
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 20), new THREE.MeshStandardMaterial({ color: 0xe0364a, roughness: 0.6 })); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.62; g.add(scarf);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.45), new THREE.MeshStandardMaterial({ color: 0xe0364a, side: THREE.DoubleSide })); tail.position.set(-0.1, 0.55, -0.2); g.add(tail);
    const pend = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff3c8 })); pend.position.set(0, 0.5, 0.22); g.add(pend);
    const aura = new THREE.PointLight(0xdfe4ff, 1.4, 3.2, 1.5); aura.position.y = 1.2; g.add(aura);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 32), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.6, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    g.userData = { head, tail, ring, cape };
    return g;
  }
  function crescent(color) {
    const sh = new THREE.Shape(); sh.absarc(0, 0, 0.22, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0.09, 0.05, 0.18, 0, Math.PI * 2, true); sh.holes.push(hole);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.3 }));
    return m;
  }
  function makeItem(it) {
    const g = new THREE.Group();
    if (it.kind === 'key') {
      const c = crescent(0xfff3c8); c.position.y = 0.75; g.add(c); g.userData.spin = c;
      const gl = glowSprite(0xffe8a8, 1.5, 0.75); gl.position.y = 0.75; g.add(gl);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 3, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 1.5; g.add(beam);
    } else {
      const cush = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x7a2a5a, roughness: 0.8 })); cush.position.y = 0.06; g.add(cush);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), new THREE.MeshStandardMaterial({ color: 0xff8ad0, emissive: 0xff5ab0, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.3 })); gem.position.y = 0.45; g.add(gem); g.userData.spin = gem;
      const gl = glowSprite(0xff9ad8, 1.2, 0.7); gl.position.y = 0.45; g.add(gl);
    }
    g.position.set(it.x + 0.5, 0, it.y + 0.5);
    return g;
  }

  // ---- 部屋を組み立てる ----
  function build(room, chIdx, ri) {
    if (world) { scene.remove(world); world.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    world = new THREE.Group(); scene.add(world);
    const th = CH_THEME[chIdx] || CH_THEME[0];
    themeMats(th); setSky(th, !!room.dark);
    const rows = room.rows, w = rows[0].length, h = rows.length;
    // 浮かぶ島（岩）と床
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(w, h) * 0.62, Math.max(w, h) * 0.2, 5, 9, 2), mats.rock); isl.position.set(w / 2, -2.6, h / 2); isl.scale.set(1, 1, h / w + 0.3); world.add(isl);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.35, h + 0.6), mats.marble); rim.position.set(w / 2, -0.18, h / 2); rim.receiveShadow = true; world.add(rim);
    const rimGold = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.06, h + 0.7), mats.gold); rimGold.position.set(w / 2, -0.07, h / 2); world.add(rimGold);
    mats.floor.map.repeat.set(w / 8, h / 8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.floor); floor.rotation.x = -Math.PI / 2; floor.position.set(w / 2, 0.001, h / 2); floor.receiveShadow = true; world.add(floor);
    // 壁：奥の壁は高く（窓と額）、それ以外は低い欄干
    const info = deps.L.roomInfo(room);
    const keyIdx = new Set();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === '#') {
        const back = y === 0;
        const front = !back && (y === h - 1 || !rows[y + 1] || rows[y + 1][x] !== '#' && y > h * 0.6);
        const hh = back ? WALL_BACK : front ? 0.3 : WALL_LOW;
        const b = new THREE.Mesh(new THREE.BoxGeometry(1, hh, 1), back ? mats.marble : mats.wallDark); b.position.set(x + 0.5, hh / 2, y + 0.5); b.castShadow = !back; b.receiveShadow = true; world.add(b);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 1.02), mats.capStone); cap.position.set(x + 0.5, hh + 0.01, y + 0.5); world.add(cap);
        if (rows[y + 1] && rows[y + 1][x] !== '#') { const gl = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.05, 0.05), mats.gold); gl.position.set(x + 0.5, hh * (back ? 0.3 : 0.85), y + 1.0); world.add(gl); }
        if (back && x > 0 && x < w - 1) {
          if (x % 3 === 1) { // アーチ窓
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.3), new THREE.MeshBasicMaterial({ color: room.dark ? 0x1a1030 : 0xb8c8ff, transparent: true, opacity: room.dark ? 0.5 : 0.9 })); win.position.set(x + 0.5, 1.45, y + 1.005); world.add(win);
            const arch = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16, 0, Math.PI), win.material); arch.position.set(x + 0.5, 2.1, y + 1.005); world.add(arch);
            if (!room.dark) { const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 6), new THREE.MeshBasicMaterial({ color: 0xc8d8ff, transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); shaft.position.set(x + 1.2, 1.2, y + 3); shaft.rotation.set(-1.1, 0, 0.35); world.add(shaft); }
          } else if (x % 3 === 2 && hsh(x, ri) > 0.3) { // 額
            const fr = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.04), mats.gold); fr.position.set(x + 0.5, 1.4, y + 1.01); world.add(fr);
            const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.44), new THREE.MeshStandardMaterial({ map: pics[Math.floor(hsh(x, y, ri) * 4)], roughness: 0.6 })); pic.position.set(x + 0.5, 1.4, y + 1.035); world.add(pic);
          }
        }
      } else if (c === 'P') world.add(statue(x, y));
      else if (c === 'C') world.add(displayCase(x, y, Math.floor(hsh(x, y, 20) * 4)));
      else if (c === 'p') world.add(plant(x, y));
      else if (c === 'M') world.add(mirror(x, y));
      else if (c === 'G') world.add(glassPane(x, y));
      else if (c === 'D') world.add(bookDoor(x, y));
      else if (c === 'F') world.add(pedestal(x, y));
      else if (c === 'm') { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshStandardMaterial({ color: 0x5a6070, roughness: 0.3, metalness: 0.9 })); pl.rotation.x = -Math.PI / 2; pl.position.set(x + 0.5, 0.004, y + 0.5); pl.receiveShadow = true; world.add(pl); }
      else if (c === 'S') { const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xd4af5a, transparent: true, opacity: 0.7 })); r.rotation.x = -Math.PI / 2; r.position.set(x + 0.5, 0.005, y + 0.5); world.add(r); }
      void keyIdx;
    }
    // 本物の台座（光る足跡の室）
    for (const [px, py] of room.pedestals || []) world.add(pedestal(px, py));
    // 出口：月の扉
    const exit = new THREE.Group();
    if (info.exit) {
      const fr = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 24, Math.PI), mats.gold); fr.position.y = 1.0; exit.add(fr);
      [-1, 1].forEach((k) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), mats.gold); p.position.set(k * 0.4, 0.5, 0); exit.add(p); });
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.0), new THREE.MeshStandardMaterial({ color: 0x1a1440, emissive: 0x0, side: THREE.DoubleSide })); door.position.y = 0.5; exit.add(door);
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.36, 20, 0, Math.PI), door.material); top.position.y = 1.0; exit.add(top);
      const glow = glowSprite(0xb8c8ff, 2.6, 0); glow.position.y = 0.7; exit.add(glow);
      const light = new THREE.PointLight(0xb8c8ff, 0, 4); light.position.y = 0.8; exit.add(light);
      exit.position.set(info.exit[0] + 0.5, 0, info.exit[1] + 0.5);
      exit.userData = { door, glow, light };
      world.add(exit);
    }
    // 光る足跡
    const trail = new THREE.Group();
    if (ri === 0 || room.pedestals) deps.L.hintTrail(room, deps.phase()).forEach(([x, y], k) => { if (k % 2) return; const s = glowSprite(0xffe6a0, 0.55, 0.7); s.position.set(x + 0.5, 0.06, y + 0.5); trail.add(s); });
    world.add(trail);
    // 動く物（彫像・惑星・額）
    const movers = (room.movers || []).map((m) => {
      let o;
      if (m.planet) { o = new THREE.Group(); const p = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 24), new THREE.MeshStandardMaterial({ color: 0x3fae8f, roughness: 0.5, emissive: 0x0a3028 })); p.castShadow = true; o.add(p); const r = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.05, 8, 48), mats.gold); r.rotation.x = 1.2; o.add(r); o.userData.planet = true; }
      else if (m.frame) { o = new THREE.Group(); const f = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.9), mats.gold); f.position.y = 0.7; f.castShadow = true; o.add(f); const pc = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), new THREE.MeshStandardMaterial({ map: pics[1], side: THREE.DoubleSide })); pc.position.set(0.11, 0.72, 0); pc.rotation.y = Math.PI / 2; o.add(pc); }
      else { o = new THREE.Group(); const cells = m.positions[0]; for (let i = 0; i < cells.length; i++) { const s = statue(0, i, 0xe6c79a); s.position.set(0, 0, i); o.add(s); } }
      world.add(o); return { m, o };
    });
    // 夜守
    const keepers = room.guards.map(() => { const k = makeKeeper(); k.scale.setScalar(1.2); world.add(k); return k; });
    const lou = makeLou(); lou.scale.setScalar(1.35); world.add(lou);
    // 視線の扇（毎フレーム作り直す）
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const cones = room.guards.map(() => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(40 * 9), 3)); const mesh = new THREE.Mesh(geo, coneMat.clone()); world.add(mesh); return mesh; });
    // 探照灯
    const lights = (room.lights || []).map((l) => { const d = new THREE.Mesh(new THREE.CircleGeometry(l.r, 32), new THREE.MeshBasicMaterial({ color: 0xfff8e8, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); d.rotation.x = -Math.PI / 2; d.position.y = 0.03; world.add(d); const sp = new THREE.PointLight(0xfff0d0, 3, l.r * 3); sp.position.y = 1.2; d.add(sp); return { l, d }; });
    // 音の輪・おとり
    const rings = Array.from({ length: 6 }, () => { const r = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: 0xc8e0ff, transparent: true, opacity: 0, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.04; world.add(r); return r; });
    const decoy = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd8d2c0 })); world.add(decoy);
    // 月の光（影の範囲を部屋に合わせる）
    moon.position.set(w * 0.8, 14, -6); moon.target.position.set(w / 2, 0, h / 2);
    const sc = moon.shadow.camera; sc.left = -w * 0.8; sc.right = w * 0.8; sc.top = h; sc.bottom = -h; sc.near = 1; sc.far = 40; sc.updateProjectionMatrix();
    moonMesh.position.set(w / 2 + 22, 18, -40); moonGlow.position.copy(moonMesh.position); moonMesh.lookAt(w / 2, 0, h / 2);
    // 記憶の光の粒
    const n = Math.round(w * h * 0.5), mp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { mp[i * 3] = hsh(i, 1, 7) * w; mp[i * 3 + 1] = hsh(i, 2, 7) * 3; mp[i * 3 + 2] = hsh(i, 3, 7) * h; }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: glowTex, color: 0xffe6b0, size: 0.18, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    world.add(motes);
    built = { room, w, h, exit, trail, movers, keepers, lou, cones, lights, rings, decoy, items: new Map(), ri };
    camPos.set(w / 2, 12, h + 8); camLook.set(w / 2, 0, h / 2);
  }

  function markTex(sprite, txt, color) {
    const c = sprite.material.map.image.getContext('2d'); c.clearRect(0, 0, 64, 64);
    if (txt) { c.font = 'bold 52px sans-serif'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = '#0b0820'; c.fillStyle = color; c.strokeText(txt, 32, 52); c.fillText(txt, 32, 52); }
    sprite.material.map.needsUpdate = true;
  }

  function update(run, t, dt, opts) {
    if (!built || built.room !== run.room || built.ri !== opts.ri) build(run.room, opts.ch, opts.ri);
    const B = built, rm = opts.reduceMotion;
    // 品物
    for (const it of run.items) {
      const key = `${it.kind}${it.idx}`;
      let o = B.items.get(key);
      if (!o && !it.got) { o = makeItem(it); world.add(o); B.items.set(key, o); }
      if (o) { o.visible = !it.got; if (o.userData.spin && !rm) { o.userData.spin.rotation.y = t * 1.6; o.userData.spin.position.y = (it.kind === 'key' ? 0.75 : 0.45) + Math.sin(t * 2 + it.x) * 0.06; } }
    }
    // 出口
    if (B.exit.userData.door) { const u = B.exit.userData; u.door.material.emissive.set(run.exitOpen ? 0x9ab0ff : 0x000000); u.door.material.emissiveIntensity = run.exitOpen ? 1.2 + Math.sin(t * 4) * 0.2 : 0; u.glow.material.opacity = run.exitOpen ? 0.8 : 0; u.light.intensity = run.exitOpen ? 3 : 0; }
    // 動く物
    for (const { m, o } of B.movers) {
      const idx = Math.floor(run.t / m.period) % m.positions.length, cells = m.positions[idx];
      if (m.planet) { o.visible = cells.length > 0; if (cells.length) { o.position.set(cells[0][0] + 0.5, 1.0, (cells[0][1] + cells[cells.length - 1][1]) / 2 + 0.5); if (!rm) o.rotation.y = t * 0.4; } }
      else if (cells.length) { const tx = cells[0][0] + 0.5, tz = cells[0][1] + (m.frame ? (cells.length) / 2 : 0.5) + (m.frame ? 0 : 0); o.position.x += (tx - o.position.x) * Math.min(1, dt * 8); o.position.z += ((m.frame ? cells[0][1] + cells.length / 2 : cells[0][1] + 0.5) - o.position.z) * Math.min(1, dt * 8); void tz; }
    }
    // 夜守
    run.guards.forEach((g, i) => {
      const k = B.keepers[i], u = k.userData, chase = g.mode === 'chase', sus = g.mode === 'investigate' || g.mode === 'search';
      k.position.set(g.x, rm ? 0.05 : 0.08 + Math.sin(t * 2.4 + i) * 0.05, g.y);
      k.rotation.y = Math.atan2(g.fx, g.fy);
      u.eyeMat.color.set(chase ? 0xff4a64 : 0x8ad8ff); u.light.color.set(chase ? 0xff6070 : 0xffb070); u.lg.material.color.set(chase ? 0xff8090 : 0xffc080);
      const st = chase ? '!' : sus ? '?' : '';
      if (st !== u.markState) { u.markState = st; markTex(u.mark, st, chase ? '#ff5468' : '#ffd25a'); u.mark.visible = !!st; }
      if (st) u.mark.position.y = 1.9 + (rm ? 0 : Math.abs(Math.sin(t * 6)) * 0.1);
      // 扇
      const cone = B.cones[i];
      cone.visible = opts.showView;
      if (opts.showView) {
        const pts = opts.coneRays(g, opts.ms, run.room), pos = cone.geometry.attributes.position.array; let n = 0;
        for (let j = 1; j < pts.length - 1 && n < pos.length - 9; j++) { pos[n++] = pts[0][0]; pos[n++] = 0.05; pos[n++] = pts[0][1]; pos[n++] = pts[j][0]; pos[n++] = 0.05; pos[n++] = pts[j][1]; pos[n++] = pts[j + 1][0]; pos[n++] = 0.05; pos[n++] = pts[j + 1][1]; }
        cone.geometry.setDrawRange(0, n / 3); cone.geometry.attributes.position.needsUpdate = true; cone.geometry.computeBoundingSphere();
        cone.material.color.set(chase ? 0xff3050 : 0xff8a40); cone.material.opacity = chase ? 0.38 : 0.26;
      }
    });
    // ルウ
    const p = run.p, L0 = B.lou, moving = Math.hypot(p.vx, p.vy) > 0.3;
    L0.position.set(p.x, moving && !rm ? Math.abs(Math.sin(t * 12)) * 0.05 : 0, p.y);
    if (moving) { const target = Math.atan2(p.vx, p.vy); let d = target - L0.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); L0.rotation.y += d * Math.min(1, dt * 12); }
    L0.scale.y = run.sneaking ? 1.15 : 1.35;
    L0.userData.tail.rotation.x = rm ? 0 : Math.sin(t * 9) * 0.3 + (moving ? 0.6 : 0);
    L0.userData.ring.material.opacity = 0.45 + (rm ? 0 : Math.sin(t * 3) * 0.2);
    L0.userData.ring.material.color.set(run.gauge > 0.5 ? 0xff5468 : 0xffe6a0);
    // 探照灯
    for (const { l, d } of B.lights) { const lp = opts.L.lightPos(l, run.t); d.position.x = lp.x; d.position.z = lp.y; }
    // 音の輪
    B.rings.forEach((r, i) => { const nz = run.noise[i]; if (!nz) { r.material.opacity = 0; return; } const rr = nz.r * Math.min(1, nz.t / 0.5); r.scale.set(rr, rr, 1); r.position.x = nz.x; r.position.z = nz.y; r.material.opacity = 0.5 * (1 - nz.t / 0.8); });
    B.decoy.visible = !!run.decoyObj; if (run.decoyObj) B.decoy.position.set(run.decoyObj.x, 0.08, run.decoyObj.y);
    // 光の粒
    if (!rm && motes) { const a = motes.geometry.attributes.position.array; for (let i = 1; i < a.length; i += 3) { a[i] += dt * (0.15 + (i % 7) * 0.03); if (a[i] > 3) a[i] = 0; } motes.geometry.attributes.position.needsUpdate = true; }
    if (!rm) { clouds.material.map.offset.x = t * 0.004; clouds2.material.map.offset.x = -t * 0.006; stars.rotation.y = t * 0.002; }
    // カメラ：斜め上から追う。縦長の画面では少し引く
    const aspect = W / H, phone = aspect < 0.8;
    const span = phone ? 12 : Math.max(B.w * 0.62, B.h * 0.95) + 2;
    const hgt = span * (phone ? 1.5 : 1.55), dist = hgt * 0.6;
    const fx = phone ? p.x * 0.75 + (B.w / 2) * 0.25 : p.x * 0.35 + (B.w / 2) * 0.65;
    const fz = phone ? p.y * 0.6 + (B.h / 2) * 0.4 : p.y * 0.3 + (B.h / 2) * 0.7;
    const tPos = new THREE.Vector3(fx, hgt, fz + dist), tLook = new THREE.Vector3(fx, 0, fz - 0.3);
    const k = opts.snap ? 1 : Math.min(1, dt * 4);
    camPos.lerp(tPos, k); camLook.lerp(tLook, k);
    if (opts.shake > 0 && !rm) camPos.x += (Math.random() - 0.5) * opts.shake * 0.4;
    camera.position.copy(camPos); camera.lookAt(camLook);
    renderer.render(scene, camera);
  }

  function resize(w, h, dpr) { W = w; H = h; renderer.setPixelRatio(Math.min(dpr, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 46 : 30; camera.updateProjectionMatrix(); }

  return { update, resize, invalidate: () => { built = null; } };
}
