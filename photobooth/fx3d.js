// Lens 3D "kacamata + kumis" ala Snapchat. Model 3D (three.js) dipasang mengikuti orientasi kepala
// yang dihitung dari landmark wajah, dirender ke canvas offscreen lalu ditempel ke canvas efek.
import * as THREE from "./vendor/three.module.min.js";

const W = 640, H = 480;
const canvas = document.createElement("canvas");
canvas.width = W; canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -3000, 3000);
scene.add(new THREE.AmbientLight(0xffffff, 1.1));
const sun = new THREE.DirectionalLight(0xfff4e6, 1.6);
sun.position.set(.3, .8, 1);
scene.add(sun);

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);


/* ---------- Kacamata ---------- */
// Bentuk lensa dalam satuan "u" (sama dengan versi 2D), sumbu y ke atas. m = +1 kanan, -1 kiri.
// Lensa wayfarer: trapesium membulat (atas lebar, sudut luar atas naik, bawah membulat besar). Satuan e = jarak antar sudut mata.
// pts: [kiri-atas(dalam), kanan-atas(luar), kanan-bawah(luar), kiri-bawah(dalam)] untuk lensa kanan (x+); m=-1 mencerminkan.
function roundQuad(m, pts, rad) {
  const P = pts.map(([x, y]) => new THREE.Vector2(m * x, -y)), sh = new THREE.Shape();
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const p = P[i], prev = P[(i + n - 1) % n], next = P[(i + 1) % n], r = rad[i];
    const a = p.clone().add(prev.clone().sub(p).setLength(Math.min(r, prev.distanceTo(p) / 2)));
    const b = p.clone().add(next.clone().sub(p).setLength(Math.min(r, next.distanceTo(p) / 2)));
    if (i === 0) sh.moveTo(a.x, a.y); else sh.lineTo(a.x, a.y);
    sh.quadraticCurveTo(p.x, p.y, b.x, b.y);
  }
  sh.closePath();
  return sh;
}
const LENS_PTS = [[.17, -.12], [.67, -.18], [.6, .325], [.21, .325]];
const OUT_PTS = [[.12, -.2], [.73, -.27], [.65, .39], [.16, .39]];
const LENS = { x0: .17, x1: .67, yTop: -.18, yBot: .325 };                         // bbox bukaan kaca
const lensShape = (m) => roundQuad(m, LENS_PTS, [.07, .06, .26, .2]);
const outerShape = (m) => roundQuad(m, OUT_PTS, [.1, .08, .31, .26]);              // bingkai: atas tebal, sisi/bawah tipis

function studioEnv() {                                  // lingkungan lembut untuk kilau bingkai
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "#d8d6e6"); gr.addColorStop(.5, "#8a8896"); gr.addColorStop(1, "#2a2624");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(40, 18, 60, 22);               // softbox
  const tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const frameMat = new THREE.MeshStandardMaterial({ color: 0x232124, roughness: .38, metalness: .12, envMap: studioEnv(), envMapIntensity: .75 });
const LW = LENS.x1 - LENS.x0 + .04, LH = LENS.yBot - LENS.yTop + .04;               // bbox bukaan kaca (+margin)
const LCX = (LENS.x0 + LENS.x1) / 2, LCY = -(LENS.yTop + LENS.yBot) / 2;
const lensMask = (m) => {                                                          // alphaMap berbentuk lensa
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#fff"; g.beginPath();
  lensShape(m).getPoints(24).forEach((p, i) => {
    const x = (p.x - m * LCX) / LW * 256 + 128, y = (LCY - p.y) / LH * 256 + 128;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.fill();
  return new THREE.CanvasTexture(c);
};

/* ---------- Tekstur pantulan lensa: langit ungu-kebiruan + bangunan tua cokelat-tan ---------- */
function makeReflection() {
  const S = 512, c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, S * .75);
  sky.addColorStop(0, "#4d51b8"); sky.addColorStop(.6, "#8d89d8"); sky.addColorStop(1, "#b2aad8");
  g.fillStyle = sky; g.fillRect(0, 0, S, S);
  const rr = rng(5);
  const fac = g.createLinearGradient(0, S * .3, 0, S);
  fac.addColorStop(0, "#a58a6c"); fac.addColorStop(.5, "#85705c"); fac.addColorStop(1, "#4f3f35");
  g.fillStyle = fac;
  g.beginPath(); g.moveTo(0, S * .4);                                        // garis atap bangunan tua yang tidak beraturan
  for (let x = 0; x <= S; x += 32) g.lineTo(x, S * (.42 + .08 * Math.sin(x / 60) + rr() * .06 + (x / S) * .12));
  g.lineTo(S, S); g.lineTo(0, S); g.closePath(); g.fill();
  g.fillStyle = "rgba(225,205,175,.22)";                                     // jendela samar
  for (let y = S * .6; y < S * .98; y += 56) for (let x = 20; x < S - 26; x += 50) { g.beginPath(); g.arc(x + 10, y, 10, Math.PI, 0); g.rect(x, y, 20, 28); g.fill(); }
  const haze = g.createLinearGradient(0, S * .3, 0, S * .6);                 // kabut atmosfer di batas langit & bangunan
  haze.addColorStop(0, "rgba(170,160,215,0)"); haze.addColorStop(.5, "rgba(170,160,215,.35)"); haze.addColorStop(1, "rgba(170,160,215,0)");
  g.fillStyle = haze; g.fillRect(0, S * .3, S, S * .3);
  const soft = document.createElement("canvas"); soft.width = S; soft.height = S;
  const sg = soft.getContext("2d"); sg.filter = "blur(4px)"; sg.drawImage(c, 0, 0);
  sg.filter = "none";
  const vg = sg.createRadialGradient(S / 2, S / 2, S * .25, S / 2, S / 2, S * .72);   // vinyet: tepi lensa lebih gelap
  vg.addColorStop(0, "rgba(20,18,30,0)"); vg.addColorStop(1, "rgba(20,18,30,.55)");
  sg.fillStyle = vg; sg.fillRect(0, 0, S, S);
  const img = sg.getImageData(0, 0, S, S), nr = rng(9);                       // grain halus
  for (let i = 0; i < img.data.length; i += 4) { const n = (nr() - .5) * 14; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  sg.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(soft);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  return tex;
}
const lensMats = [];

function buildGlasses() {
  const grp = new THREE.Group();
  for (const m of [1, -1]) {
    const outer = outerShape(m);
    outer.holes.push(lensShape(m));
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: .05, bevelEnabled: true, bevelThickness: .016, bevelSize: .012, bevelSegments: 4, curveSegments: 16 }), frameMat);
    frame.position.z = -.025;
    grp.add(frame);
    const geo = new THREE.PlaneGeometry(LW, LH, 20, 20);                         // kaca melengkung tipis + alphaMap bentuk lensa
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i) / (LW / 2), ny = pos.getY(i) / (LH / 2);
      pos.setZ(i, .06 * (1 - .6 * (nx * nx + ny * ny)));
    }
    geo.computeVertexNormals();
    const lmat = new THREE.MeshBasicMaterial({ map: makeReflection(), transparent: true, opacity: .5, alphaMap: lensMask(m), side: THREE.DoubleSide, depthWrite: false });
    lensMats.push(lmat);
    const lens = new THREE.Mesh(geo, lmat);
    lens.position.set(m * LCX, LCY, 0);
    lens.renderOrder = 2;
    grp.add(lens);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .05, .9), frameMat);        // gagang pendek dari sudut luar atas ke telinga
    arm.position.set(m * .74, .22, -.42);
    grp.add(arm);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(.18, .075, .05), frameMat);      // jembatan tebal di atas hidung
  bridge.position.set(0, .115, 0);
  grp.add(bridge);
  return grp;
}

/* ---------- Kumis ---------- */
const STACHE_R = [[0, -.1, .2, -.2, .5, -.2, .76, -.12], [.76, -.12, .95, -.07, 1.1, -.09, 1.28, -.06],
                  [1.28, -.06, 1.15, .02, 1.05, .1, .86, .14], [.86, .14, .62, .2, .3, .24, 0, .17]];
function stacheTexture() {
  const TW = 1024, TH = 256, sx = TW / 2.7, cx = TW / 2, cy = TH * .5 - 10, sy = sx;     // x: -1.35..1.35 satuan hw
  const c = document.createElement("canvas"); c.width = TW; c.height = TH;
  const g = c.getContext("2d");
  g.translate(cx, cy); g.scale(sx, sy);
  const body = () => {
    g.beginPath(); g.moveTo(0, STACHE_R[0][1]);
    for (const q of STACHE_R) g.bezierCurveTo(q[2], q[3], q[4], q[5], q[6], q[7]);
    for (let i = STACHE_R.length - 1; i >= 0; i--) { const q = STACHE_R[i]; g.bezierCurveTo(-q[4], q[5], -q[2], q[3], -q[0], q[1]); }
    g.closePath();
  };
  const grad = g.createLinearGradient(0, -.2, 0, .24);
  grad.addColorStop(0, "#4d392e"); grad.addColorStop(.55, "#35271d"); grad.addColorStop(1, "#1f1510");
  g.fillStyle = grad; body(); g.fill();
  g.save(); body(); g.clip(); g.lineCap = "round";
  const r = rng(77);
  for (let i = 0; i < 520; i++) {                                      // helai rambut mengikuti arah kumis (keluar & turun)
    const m = i % 2 ? 1 : -1, px = r() * 1.25, py = -.17 + r() * .36, len = .06 + r() * .12;
    const dx = len * (.8 + r() * .5), dy = len * (.05 + r() * .4) * (px > .7 ? -.25 : 1);
    g.strokeStyle = r() < .45 ? "rgba(185,140,100,.4)" : "rgba(14,8,4,.55)";
    g.lineWidth = .006 + r() * .008;
    g.beginPath(); g.moveTo(m * px, py); g.quadraticCurveTo(m * (px + dx * .5), py + dy * .3, m * (px + dx), py + dy); g.stroke();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildStache() {
  const grp = new THREE.Group();
  const geo = new THREE.PlaneGeometry(2.7, .675, 44, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, -.42 * x * x + .06 * (1 - y * y * 8));              // ujung melengkung ke belakang mengikuti bibir/pipi
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: stacheTexture(), transparent: true, alphaTest: .3, roughness: .92, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.y = 1.9;
  grp.add(mesh);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x120a07, roughness: .6 });
  for (const m of [1, -1]) {                                           // kawat tipis melengkung naik ke pipi
    const pts = [[1.22, .02], [1.38, 0], [1.5, .15], [1.42, .5], [1.2, .72], [1.0, .66]]
      .map(([x, y]) => new THREE.Vector3(m * x, y, -.42 * x * x + .02));
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .014, 6), wireMat));
  }
  return grp;
}

/* ---------- Adegan ---------- */
const face = new THREE.Group();
const glasses = buildGlasses();
glasses.scale.setScalar(.645);
glasses.position.set(0, 0, .09);
const stache = buildStache();
stache.scale.setScalar(.28);
face.add(glasses, stache);
const occluder = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), new THREE.MeshBasicMaterial({ colorWrite: false }));
occluder.scale.set(.46, .72, .6);                                     // kepala: menyembunyikan gagang/ujung kumis di balik wajah saat menoleh
occluder.position.set(0, -.05, -.64);
occluder.renderOrder = -1;
face.add(occluder);
scene.add(face);

const shadowCv = document.createElement("canvas"); shadowCv.width = W; shadowCv.height = H;
const shadowCtx = shadowCv.getContext("2d");
const smooth = [];
// Titik dalam piksel kanvas (z diabaikan: kedalaman landmark kurang akurat di kamera nyata; rotasi diambil dari matriks pose MediaPipe).
const _v = (lm, i, m) => new THREE.Vector3(lm[i].x * m.vw * m.s + m.ox - W / 2, -(lm[i].y * m.vh * m.s + m.oy - H / 2), 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _e = new THREE.Euler();

/** Gambar kacamata + kumis 3D untuk satu wajah ke `x` (konteks sudah dalam transformasi mirror). */
export function drawFace(x, lm, m, idx, poseMatrix) {
  const P = (i) => _v(lm, i, m);
  const eyeV = P(263).sub(P(33));
  const roll = Math.atan2(eyeV.y, eyeV.x);                                  // kemiringan kepala dari garis mata (stabil)
  let pitch = 0, yaw = 0;
  if (poseMatrix && poseMatrix.data) {                                      // menoleh/mendongak dari matriks pose MediaPipe
    const mat = new THREE.Matrix4().fromArray(poseMatrix.data), q0 = new THREE.Quaternion();
    mat.decompose(new THREE.Vector3(), q0, new THREE.Vector3());
    _e.setFromQuaternion(q0, "YXZ");
    pitch = clamp(_e.x, -.5, .5); yaw = clamp(_e.y, -.8, .8);
  }
  for (const lm2 of lensMats) lm2.map.offset.set(-yaw * .35, pitch * .35);   // pantulan bergeser saat kepala menoleh/mendongak
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, "YXZ"));
  const w2d = P(454).sub(P(234)).length();
  const fw = w2d / Math.max(Math.cos(yaw), .8);                             // lebar kepala sebenarnya (kompensasi saat menoleh)
  const E = P(33).add(P(263)).multiplyScalar(.5);
  const mc = P(2).add(P(0)).multiplyScalar(.5);
  const st = smooth[idx] || (smooth[idx] = { q: q.clone(), E: E.clone(), fw, mc: mc.clone() });
  st.q.slerp(q, .6); st.E.lerp(E, .7); st.fw += (fw - st.fw) * .7; st.mc.lerp(mc, .7);
  glasses.scale.setScalar(1 / 1.44); stache.scale.setScalar(.43 / 1.44);          // satuan lens = lebar kepala / 1.44 (diukur dari video asli)
  face.quaternion.copy(st.q);
  face.position.copy(st.E);
  face.scale.setScalar(st.fw);
  // posisi kumis relatif terhadap mata, di sumbu 2D kepala (kemiringan saja)
  const d = st.mc.clone().sub(st.E), cr = Math.cos(roll), sr = Math.sin(roll);
  stache.position.set((d.x * cr + d.y * sr) / st.fw, (-d.x * sr + d.y * cr) / st.fw, .06);
  renderer.render(scene, cam);
  // bayangan lembut kacamata/kumis di kulit, lalu tempel dengan blur tipis agar menyatu dengan kualitas webcam
  const sx = shadowCtx;
  sx.clearRect(0, 0, W, H);
  sx.globalCompositeOperation = "source-over"; sx.drawImage(canvas, 0, 0);
  sx.globalCompositeOperation = "source-in"; sx.fillStyle = "rgba(10,6,4,.5)"; sx.fillRect(0, 0, W, H);
  x.save();
  x.filter = "blur(5px)"; x.globalAlpha = .55; x.drawImage(shadowCv, 0, 7 * (st.fw / 330));
  x.filter = "blur(0.7px)"; x.globalAlpha = 1; x.drawImage(canvas, 0, 0, W, H);
  x.restore();
}
