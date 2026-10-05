import { FilesetResolver, ImageSegmenter, FaceLandmarker } from "./vendor/vision_bundle.mjs";

const W = 640, H = 480;

/* ---------- Background ---------- */
const grad = (x, stops, vertical = true) => {
  const g = vertical ? x.createLinearGradient(0, 0, 0, H) : x.createLinearGradient(0, 0, W, 0);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  x.fillStyle = g; x.fillRect(0, 0, W, H);
};
const scatter = (x, chars, n, size, seed) => {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.textAlign = "center"; x.textBaseline = "middle";
  for (let i = 0; i < n; i++) { x.font = `${size * (.7 + r() * .6)}px serif`; x.fillText(chars[i % chars.length], r() * W, r() * H); }
};

export const BGS = [
  { id: "sunset", name: "Sunset", draw: (x) => {
      grad(x, [[0, "#2b1055"], [.45, "#d4508b"], [.8, "#ffb347"], [1, "#ffd78a"]]);
      x.fillStyle = "#fff3c4"; x.beginPath(); x.arc(W * .7, H * .68, 60, 0, 7); x.fill();
      x.fillStyle = "#3a1c4a"; x.fillRect(0, H * .82, W, H); } },
  { id: "beach", name: "Beach", draw: (x) => {
      grad(x, [[0, "#8fd3ff"], [.5, "#d8f1ff"], [.5, "#3ab0d6"], [.72, "#7fdbe8"], [.72, "#f6e3b0"], [1, "#efd08a"]]); } },
  { id: "night", name: "Night sky", draw: (x) => {
      grad(x, [[0, "#050a24"], [1, "#2a2f6b"]]);
      x.fillStyle = "#fff"; let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) { x.globalAlpha = .4 + r() * .6; x.beginPath(); x.arc(r() * W, r() * H, r() * 2 + .5, 0, 7); x.fill(); }
      x.globalAlpha = 1; x.fillStyle = "#fff6c9"; x.beginPath(); x.arc(W * .8, H * .2, 36, 0, 7); x.fill(); } },
  { id: "meadow", name: "Meadow", draw: (x) => {
      grad(x, [[0, "#9fd8ff"], [.55, "#e9f8ff"], [.55, "#8fd27a"], [1, "#4fa84a"]]);
      scatter(x, ["🌼", "🌸", "🌷"], 26, 22, 3); } },
  { id: "gingham", name: "Gingham", draw: (x) => gingham("#ffe3ec", "#f4a6bf", 32)(x, W, H) },
  { id: "cherry", name: "Cherry", draw: (x) => { gingham("#ffd6e2", "#f4a6bf", 32)(x, W, H); scatter(x, ["🍒", "🌸"], 22, 36, 9); } },
  { id: "hearts", name: "Hearts", draw: (x) => { grad(x, [[0, "#ffd1e0"], [1, "#ffb3cc"]]); scatter(x, ["💗", "💖", "💕"], 34, 34, 21); } },
  { id: "confetti", name: "Confetti", draw: (x) => confetti("#fffaf0", ["#ff6b8b", "#ffd166", "#4cc9f0", "#9b8cff"])(x, W, H) },
  { id: "curtain", name: "Curtain", draw: (x) => {
      grad(x, [[0, "#5a0710"], [.5, "#9b1020"], [1, "#5a0710"]], false);
      x.fillStyle = "#0004"; for (let i = 0; i < W; i += 40) x.fillRect(i, 0, 14, H); } },
];

/* ---------- Face filter ---------- */
export const FILTERS = [
  { id: "crown", icon: "👑" }, { id: "tophat", icon: "🎩" }, { id: "sunglasses", icon: "🕶️" },
  { id: "glasses", icon: "👓" }, { id: "bow", icon: "🎀" }, { id: "flowers", icon: "🌸" },
  { id: "bunny", icon: "🐰" }, { id: "blush", icon: "☺️" }, { id: "mustache", icon: "🥸" }, { id: "love", icon: "💞" },
];

const emoji = (x, ch, cx, cy, size, rot = 0) => {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(-1, 1); // tegak walau canvas dibalik (mirror)
  x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`;
  x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(ch, 0, 0); x.restore();
};

// Efek "love" ala Photo Booth Mac: awan hati besar-pucat-transparan (tepi lembut) di atas & sekitar kepala,
// ditambah beberapa hati kecil pekat tepat di garis rambut. Tiap wajah punya partikel sendiri.
function heart(x, cx, cy, w, rot, alpha, color, blur) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(w / 1.8, w / 1.8); x.globalAlpha = alpha;
  x.beginPath(); x.moveTo(0, .55);
  x.bezierCurveTo(-.2, .38, -.92, .08, -.9, -.3);
  x.bezierCurveTo(-.88, -.78, -.26, -.86, 0, -.4);
  x.bezierCurveTo(.26, -.86, .88, -.78, .9, -.3);
  x.bezierCurveTo(.92, .08, .2, .38, 0, .55);
  x.fillStyle = color;
  if (blur) { x.shadowColor = color; x.shadowBlur = blur; }
  x.fill();
  x.restore();
}
const loveState = [];
const CROWN_SLOTS = 11, CROWN_COLORS = ["#ff47a6", "#f23c9a", "#ff4fae", "#e8369a"];
const backOut = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;      // membesar sedikit melewati ukuran akhir
function crownHeart(i, now) {
  const R = Math.random;
  const forehead = i >= CROWN_SLOTS;                       // 1 hati kecil di tengah dahi
  const k = R();
  const th = Math.PI * (.05 + .9 * ((i + .5) / CROWN_SLOTS) + (R() - .5) * .025);
  return {
    i, forehead, th,
    size: forehead ? .07 + R() * .03 : k < .2 ? .12 + R() * .04 : k < .8 ? .2 + R() * .06 : .27 + R() * .03,
    u: (R() - .5) * .3, v: -.12 + R() * .1,
    rad: (R() - .5) * .04, color: CROWN_COLORS[(R() * CROWN_COLORS.length) | 0],
    alpha: R() < .25 ? .6 : .92, rot: (R() - .5) * 1.1, ph: R() * 6,
    birth: now + R() * 300, life: (forehead ? 1.2 : 1.7) + R() * 1.0,
  };
}
function loveParticles(x, idx, top, at, a, fw, t) {
  const st = loveState[idx] || (loveState[idx] = { crown: null, float: [], last: 0, af: 0 });
  const dt = st.last ? Math.min(.1, (t - st.last) / 1000) : 0;
  st.last = t;
  const R = Math.random;
  if (!st.crown) st.crown = Array.from({ length: CROWN_SLOTS + 1 }, (_, i) => { const h = crownHeart(i, t); h.birth = t + R() * 900; return h; });
  st.af += dt * .55;
  while (st.af >= 1) {                                   // hati lepas di samping atas kepala
    st.af -= 1;
    const side = R() < .5 ? -1 : 1;
    st.float.push({
      u: side * (.7 + R() * .25), v: .0 + R() * .4, size: .2 + R() * .1,
      vx: side * .02, vy: .03 + R() * .04, rot: (R() - .5) * .6, age: 0, life: 2.6 + R() * 1.2,
    });
  }
  st.float = st.float.filter((p) => (p.age += dt) < p.life).slice(-1);
  // mahkota di garis rambut
  const rx = .56, ry = .42;
  for (let n = 0; n < st.crown.length; n++) {
    let h = st.crown[n];
    let age = (t - h.birth) / 1000;
    if (age > h.life) { h = st.crown[n] = crownHeart(h.i, t); age = (t - h.birth) / 1000; }
    if (age < 0) continue;
    const pop = Math.min(1, age / .45), out = Math.max(0, (age - (h.life - .35)) / .35);
    const sc = backOut(pop) * (1 - out) * (1 + .05 * Math.sin(t / 160 + h.ph));
    let c;
    if (h.forehead) c = at(top, h.u, h.v);
    else {
      const dx = Math.cos(h.th), dy = Math.sin(h.th);
      c = at(top, dx * (rx + h.rad), -.16 + dy * (ry + h.rad * 1.2));
    }
    heart(x, c.x, c.y, h.size * fw * sc, a + h.rot * .6, h.alpha * (1 - out * .5), h.color, 0);
  }
  for (const p of st.float) {
    const u = p.age / p.life, env = Math.min(1, u / .15) * (u > .6 ? 1 - (u - .6) / .4 : 1);
    const c = at(top, p.u + p.vx * p.age, p.v + p.vy * p.age);
    heart(x, c.x, c.y, p.size * fw * (.6 + .4 * Math.min(1, u / .15)), a + p.rot, .85 * env, "#ff6bb3", 0);
  }
}

function drawFilter(x, id, P, t, idx = 0) {
  const A = P(33), B = P(263), top = P(10), chin = P(152), L = P(234), R = P(454);
  const fw = Math.hypot(R.x - L.x, R.y - L.y);
  const fh = Math.hypot(top.x - chin.x, top.y - chin.y) || fw * 1.35;
  const up = { x: (top.x - chin.x) / fh, y: (top.y - chin.y) / fh };      // arah atas kepala
  const d = { x: -up.y, y: up.x };                                       // arah kanan wajah
  const a = Math.atan2(d.y, d.x), vs = Math.min(fw * 1.2, Math.max(fw * .7, fh / 1.35));
  const at = (o, u, v) => ({ x: o.x + d.x * u * fw + up.x * v * vs, y: o.y + d.y * u * fw + up.y * v * vs });
  const eyes = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  switch (id) {
    case "crown": { const c = at(top, 0, .1); emoji(x, "👑", c.x, c.y, fw * .85, a); break; }
    case "tophat": { const c = at(top, 0, .28); emoji(x, "🎩", c.x, c.y, fw * 1.05, a); break; }
    case "sunglasses": emoji(x, "🕶️", eyes.x, eyes.y, fw * 1.0, a); break;
    case "glasses": emoji(x, "👓", eyes.x, eyes.y, fw * 1.0, a); break;
    case "bow": { const c = at(top, .32, .02); emoji(x, "🎀", c.x, c.y, fw * .55, a); break; }
    case "flowers":
      for (let i = -3; i <= 3; i++) { const c = at(top, i * .15, .02 - Math.abs(i) * .012); emoji(x, i % 2 ? "🌸" : "🌼", c.x, c.y, fw * .26, a); }
      break;
    case "bunny":
      for (const s of [-1, 1]) {
        const c = at(top, s * .22, .5);
        x.save(); x.translate(c.x, c.y); x.rotate(a + s * .18);
        x.fillStyle = "#fff"; x.strokeStyle = "#e8d5db"; x.lineWidth = 3;
        x.beginPath(); x.ellipse(0, 0, fw * .14, fw * .42, 0, 0, 7); x.fill(); x.stroke();
        x.fillStyle = "#ffb3cb"; x.beginPath(); x.ellipse(0, fw * .03, fw * .07, fw * .3, 0, 0, 7); x.fill();
        x.restore();
      }
      break;
    case "blush":
      for (const i of [50, 280]) {
        const c = P(i), g = x.createRadialGradient(c.x, c.y, 0, c.x, c.y, fw * .17);
        g.addColorStop(0, "rgba(255,90,130,.55)"); g.addColorStop(1, "rgba(255,90,130,0)");
        x.fillStyle = g; x.beginPath(); x.arc(c.x, c.y, fw * .17, 0, 7); x.fill();
      }
      break;
    case "mustache": {
      const c = P(164);
      x.save(); x.translate(c.x, c.y + fw * .01); x.rotate(a); x.fillStyle = "#3b2a20";
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * fw * .1, 0, fw * .12, fw * .045, s * -.25, 0, 7); x.fill(); }
      x.restore(); break;
    }
    case "love": loveParticles(x, idx, top, at, a, fw, t); break;
  }
}

/* ---------- Pipeline ---------- */
const bgCache = {};
export function bgCanvas(id) {
  if (!bgCache[id]) {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    BGS.find((b) => b.id === id).draw(c.getContext("2d"));
    bgCache[id] = c;
  }
  return bgCache[id];
}

let seg = null, face = null, loading = null, lastTs = 0;
const temp = document.createElement("canvas"); temp.width = W; temp.height = H;
const maskCv = document.createElement("canvas");

export function ensure(onState) {
  if (loading) return loading;
  loading = (async () => {
    onState && onState("loading");
    const fs = await FilesetResolver.forVisionTasks("vendor/wasm");
    const mk = async (delegate) => Promise.all([
      ImageSegmenter.createFromOptions(fs, {
        baseOptions: { modelAssetPath: "vendor/models/selfie_segmenter.tflite", delegate },
        runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false,
      }),
      FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: "vendor/models/face_landmarker.task", delegate },
        runningMode: "VIDEO", numFaces: 2,
      }),
    ]);
    try { [seg, face] = await mk("GPU"); } catch (e) { [seg, face] = await mk("CPU"); }
    onState && onState("ready");
  })().catch((e) => { loading = null; onState && onState("error", e); throw e; });
  return loading;
}

const tsNext = () => (lastTs = Math.max(lastTs + 1, Math.round(performance.now())));

/** Gambar satu frame ke `canvas` (sudah di-mirror seperti selfie). */
export function render(video, canvas, bgId, filterId) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return;
  const x = canvas.getContext("2d");
  const s = Math.max(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
  x.save();
  x.setTransform(-1, 0, 0, 1, W, 0);
  let drawn = false;
  if (bgId !== "none" && seg) {
    const ts = tsNext();
    const res = seg.segmentForVideo(video, ts);
    const m = res.confidenceMasks && res.confidenceMasks[0];
    if (m) {
      const data = m.getAsFloat32Array();
      if (maskCv.width !== m.width || maskCv.height !== m.height) { maskCv.width = m.width; maskCv.height = m.height; }
      const mc = maskCv.getContext("2d"), img = mc.createImageData(m.width, m.height);
      for (let i = 0; i < data.length; i++) { img.data[i * 4 + 3] = Math.min(255, Math.max(0, (data[i] - .25) * 1.8 * 255)); }
      mc.putImageData(img, 0, 0);
      const t = temp.getContext("2d");
      t.globalCompositeOperation = "source-over"; t.clearRect(0, 0, W, H);
      t.drawImage(video, ox, oy, vw * s, vh * s);
      t.globalCompositeOperation = "destination-in";
      t.drawImage(maskCv, ox, oy, vw * s, vh * s);
      x.drawImage(bgCanvas(bgId), 0, 0);
      x.drawImage(temp, 0, 0);
      drawn = true;
    }
    res.close();
  }
  if (!drawn) x.drawImage(video, ox, oy, vw * s, vh * s);
  if (filterId !== "none" && face) {
    const r = face.detectForVideo(video, tsNext());
    (r.faceLandmarks || []).forEach((lm, idx) => {
      drawFilter(x, filterId, (i) => ({ x: lm[i].x * vw * s + ox, y: lm[i].y * vh * s + oy }), performance.now(), idx);
    });
  }
  x.restore();
}

window.FX = { BGS, FILTERS, ensure, render, bgCanvas };
window.dispatchEvent(new Event("fx-ready"));
