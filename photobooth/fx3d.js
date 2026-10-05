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

/* ---------- Peta lingkungan untuk pantulan lensa (langit lavender + deretan bangunan cokelat) ---------- */
function makeEnv() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, "#5f63c8"); sky.addColorStop(1, "#b7b3ee");
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  const r = rng(11);
  for (let x = 0; x < 1024; x += 8) {                               // bangunan
    const h = 70 + r() * 150, w = 40 + r() * 70, base = 300;
    g.fillStyle = `rgb(${120 + r() * 40 | 0},${92 + r() * 30 | 0},${72 + r() * 24 | 0})`;
    g.fillRect(x, base - h, w, h + 212);
    g.fillStyle = "rgba(235,215,185,.55)";
    for (let wy = base - h + 10; wy < base - 6; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 14) g.fillRect(wx, wy, 6, 9);
    x += w * .6;
  }
  g.fillStyle = "#3a2a22"; g.fillRect(0, 430, 1024, 82);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const env = makeEnv();

/* ---------- Kacamata ---------- */
// Bentuk lensa dalam satuan "u" (sama dengan versi 2D), sumbu y ke atas. m = +1 kanan, -1 kiri.
function lensShape(m, g = 0) {
  const xi = .08 - g, xo = .72 + g, yt = -.2 - g * 1.4, yto = -.23 - g * 1.4, yb = .4 + g * 1.2, Y = (y) => -y;
  const sh = new THREE.Shape();
  sh.moveTo(m * (xi + .09), Y(yt));
  sh.lineTo(m * (xo - .09), Y(yto));
  sh.quadraticCurveTo(m * xo, Y(yto), m * xo, Y(yto + .1));
  sh.lineTo(m * (xo - .02), Y(yb - .26));
  sh.bezierCurveTo(m * (xo - .02), Y(yb - .04), m * (xo - .12), Y(yb), m * (xo - .3), Y(yb));
  sh.lineTo(m * (xi + .26), Y(yb));
  sh.bezierCurveTo(m * (xi + .08), Y(yb), m * xi, Y(yb - .08), m * xi, Y(yb - .26));
  sh.lineTo(m * xi, Y(yt + .09));
  sh.quadraticCurveTo(m * xi, Y(yt), m * (xi + .09), Y(yt));
  return sh;
}

const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a201c, roughness: .55, metalness: .05 });
const lensMask = (m) => {                                            // alphaMap berbentuk lensa
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#fff"; g.beginPath();
  lensShape(m).getPoints(24).forEach((p, i) => {
    const x = (p.x - (m > 0 ? .02 : -.78)) / .76 * 256, y = (.28 - p.y) / .72 * 256;      // bbox lensa -> kanvas
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.fill();
  return new THREE.CanvasTexture(c);
};

function buildGlasses() {
  const grp = new THREE.Group();
  for (const m of [1, -1]) {
    const hole = lensShape(m), outer = lensShape(m, .045);
    outer.holes.push(hole);
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: .07, bevelEnabled: true, bevelThickness: .016, bevelSize: .014, bevelSegments: 3, curveSegments: 14 }), frameMat);
    frame.position.z = -.035;
    grp.add(frame);
    // lensa melengkung (bidang bersubdivisi + alphaMap bentuk lensa) dengan pantulan lingkungan
    const bx0 = m > 0 ? .02 : -.78, geo = new THREE.PlaneGeometry(.76, .72, 22, 22);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i) / .38, ny = pos.getY(i) / .36;
      pos.setZ(i, .2 * (1 - .6 * (nx * nx + ny * ny)));
    }
    geo.computeVertexNormals();
    const lens = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xa6a3f2, metalness: 1, roughness: .06, envMap: env, envMapIntensity: 1.6,
      transparent: true, opacity: .55, alphaMap: lensMask(m), side: THREE.DoubleSide, depthWrite: false,
    }));
    lens.position.set(bx0 + .38, .28 - .36, 0);
    lens.renderOrder = 2;
    grp.add(lens);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.07, .075, 1.0), frameMat);   // gagang ke arah telinga
    arm.position.set(m * .8, .2, -.5);
    arm.rotation.y = m * -.06;
    grp.add(arm);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(.24, .1, .08), frameMat);
  bridge.position.set(0, .195, 0);
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
  grad.addColorStop(0, "#5f4230"); grad.addColorStop(.55, "#42301f"); grad.addColorStop(1, "#271811");
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
  mesh.scale.y = 1.35;
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
glasses.scale.setScalar(.69);
glasses.position.set(0, 0, .09);
const stache = buildStache();
stache.scale.setScalar(.38);
face.add(glasses, stache);
const occluder = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), new THREE.MeshBasicMaterial({ colorWrite: false }));
occluder.scale.set(.46, .72, .6);                                     // kepala: menyembunyikan gagang/ujung kumis di balik wajah saat menoleh
occluder.position.set(0, -.05, -.46);
occluder.renderOrder = -1;
face.add(occluder);
scene.add(face);

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
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, "YXZ"));
  const w2d = P(454).sub(P(234)).length();
  const fw = w2d / Math.max(Math.cos(yaw), .8);                             // lebar kepala sebenarnya (kompensasi saat menoleh)
  const E = P(33).add(P(263)).multiplyScalar(.5);
  const mc = P(2).add(P(0)).multiplyScalar(.5);
  const st = smooth[idx] || (smooth[idx] = { q: q.clone(), E: E.clone(), fw, mc: mc.clone() });
  st.q.slerp(q, .6); st.E.lerp(E, .7); st.fw += (fw - st.fw) * .7; st.mc.lerp(mc, .7);
  face.quaternion.copy(st.q);
  face.position.copy(st.E);
  face.scale.setScalar(st.fw);
  // posisi kumis relatif terhadap mata, di sumbu 2D kepala (kemiringan saja)
  const d = st.mc.clone().sub(st.E), cr = Math.cos(roll), sr = Math.sin(roll);
  stache.position.set((d.x * cr + d.y * sr) / st.fw, (-d.x * sr + d.y * cr) / st.fw, .06);
  renderer.render(scene, cam);
  x.drawImage(canvas, 0, 0, W, H);
}
