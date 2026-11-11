// カメラで顔と目を読み取り、目線の特徴量とまばたきを返す（MediaPipe Face Landmarker）。
// 映像はこのブラウザの中だけで使い、どこにも送らず保存もしない。部品は vendor/ に同梱（Apache-2.0）。
const V = (p) => new URL(`vendor/${p}`, import.meta.url).href;

export async function createGaze(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocamera');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream; video.muted = true; video.playsInline = true;
  await video.play();
  const { FaceLandmarker } = await import('./vendor/vision_bundle.js');
  const fileset = { wasmLoaderPath: V('vision_wasm_internal.js'), wasmBinaryPath: V('vision_wasm_internal.wasm') };
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: V('face_landmarker.task'), delegate }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
  let lm;
  try { lm = await FaceLandmarker.createFromOptions(fileset, opts('GPU')); } catch { lm = await FaceLandmarker.createFromOptions(fileset, opts('CPU')); }

  const state = { ok: false, f: null, blink: false, pts: null, lastT: 0 };
  let running = true, lastVideoT = -1;
  const loop = () => {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoT) {
      lastVideoT = video.currentTime;
      try {
        const r = lm.detectForVideo(video, performance.now());
        const L = r.faceLandmarks?.[0];
        if (L && L.length >= 478) {
          state.f = features(L); state.ok = true; state.pts = [L[468], L[473], L[1]];
          const bs = r.faceBlendshapes?.[0]?.categories || [];
          const sc = (n) => bs.find((c) => c.categoryName === n)?.score ?? 0;
          state.blink = (sc('eyeBlinkLeft') + sc('eyeBlinkRight')) / 2 > 0.5;
        } else state.ok = false;
        state.lastT = performance.now();
      } catch { state.ok = false; }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return {
    state,
    stop() { running = false; try { lm.close(); } catch { /* */ } stream.getTracks().forEach((t) => t.stop()); video.srcObject = null; },
  };
}

// 目の中の黒目の位置（左右・上下）と、顔の向き（鼻の位置）を特徴量にする
function features(L) {
  const eye = (iris, c1, c2, top, bot) => {
    const w = L[c2].x - L[c1].x || 1e-6, h = L[bot].y - L[top].y || 1e-6;
    return [(L[iris].x - L[c1].x) / w, (L[iris].y - L[top].y) / h];
  };
  const a = eye(468, 33, 133, 159, 145), b = eye(473, 362, 263, 386, 374);
  const fw = L[454].x - L[234].x || 1e-6, fh = L[152].y - L[10].y || 1e-6;
  const hx = (L[1].x - (L[234].x + L[454].x) / 2) / fw, hy = (L[1].y - (L[10].y + L[152].y) / 2) / fh;
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, hx, hy];
}
