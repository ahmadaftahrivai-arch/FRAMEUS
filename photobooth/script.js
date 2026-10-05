const $ = (id) => document.getElementById(id);
const PREFIX = "ldrbooth-";
const CW = 480, CH = 360, PAD = 44, GAP = 22; // ukuran sel foto 4:3

/* ---------- Data: layout, frame, prompt ---------- */
const LAYOUTS = {
  "4cut":     { name: "4 foto",   desc: "strip klasik",       n: 4, cols: 1, rows: 4 },
  "2x2":      { name: "2 × 2",    desc: "kartu empat foto",   n: 4, cols: 2, rows: 2 },
  "2cut":     { name: "2 foto",   desc: "dua foto besar",     n: 2, cols: 1, rows: 2 },
  "polaroid": { name: "Polaroid", desc: "satu foto",          n: 1, cols: 1, rows: 1 },
};
const EXTRA_SHOTS = 2; // foto lebih banyak dari slot, tinggal dipilih

const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const solid = (c) => (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); };
const tile = (a, b, size, shape) => (x, w, h) => {
  x.fillStyle = a; x.fillRect(0, 0, w, h);
  for (let j = 0; j * size < h; j++) for (let i = 0; i * size < w; i++) shape(x, i, j, size, b);
};
const check = (a, b, s) => tile(a, b, s, (x, i, j, z, c) => { if ((i + j) % 2) { x.fillStyle = c; x.fillRect(i * z, j * z, z, z); } });
const gingham = (a, b, s) => (x, w, h) => {
  x.fillStyle = a; x.fillRect(0, 0, w, h); x.fillStyle = b; x.globalAlpha = .45;
  for (let i = 0; i * s < w; i += 2) x.fillRect(i * s, 0, s, h);
  for (let j = 0; j * s < h; j += 2) x.fillRect(0, j * s, w, s);
  x.globalAlpha = 1;
};
const dots = (a, b, s) => tile(a, b, s, (x, i, j, z, c) => { x.fillStyle = c; x.beginPath(); x.arc(i * z + z / 2, j * z + z / 2, z / 5, 0, 7); x.fill(); });
const stripes = (a, b, s) => (x, w, h) => {
  x.fillStyle = a; x.fillRect(0, 0, w, h); x.fillStyle = b;
  for (let i = 0; i * s < w; i += 2) x.fillRect(i * s, 0, s, h);
};
const confetti = (bg, colors) => (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  const r = rnd(7);
  for (let i = 0; i < 90; i++) {
    x.fillStyle = colors[i % colors.length];
    x.save(); x.translate(r() * w, r() * h); x.rotate(r() * 6);
    x.fillRect(-5, -2, 10, 4); x.restore();
  }
};
const balloons = (bg, colors) => (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  const r = rnd(11);
  for (let i = 0; i < 28; i++) {
    const px = r() * w, py = r() * h, R = 14 + r() * 16;
    x.fillStyle = colors[i % colors.length]; x.globalAlpha = .8;
    x.beginPath(); x.ellipse(px, py, R * .85, R, 0, 0, 7); x.fill();
    x.strokeStyle = "#fff8"; x.beginPath(); x.moveTo(px, py + R); x.lineTo(px - 4, py + R + 22); x.stroke();
  }
  x.globalAlpha = 1;
};
const film = (x, w, h) => {
  x.fillStyle = "#1b1b1b"; x.fillRect(0, 0, w, h); x.fillStyle = "#f3f3f3";
  for (let y = 12; y < h; y += 26) { x.fillRect(6, y, 10, 14); x.fillRect(w - 16, y, 10, 14); }
};


/* ---------- frame tambahan: riso (dua tinta), pola, pesta, alam, vintage ---------- */
const paper = (c) => (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); };
// titik halftone: radius mengikuti fungsi kerapatan k(px,py) dalam 0..1
function halftone(x, w, h, color, angle, step, k, rMax) {
  x.save(); x.fillStyle = color;
  const a = angle * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), diag = Math.hypot(w, h);
  for (let u = -diag; u < diag; u += step) for (let v = -diag; v < diag; v += step) {
    const px = w / 2 + u * cs - v * sn, py = h / 2 + u * sn + v * cs;
    if (px < -step || py < -step || px > w + step || py > h + step) continue;
    const r = rMax * Math.max(0, Math.min(1, k(px / w, py / h)));
    if (r > .35) { x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  }
  x.restore();
}
const RED = "#ee3b2f", BLUE = "#2536d6";
const riso2 = (x, w, h) => {
  x.fillStyle = "#f3ede0"; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = "multiply";
  halftone(x, w, h, RED, 15, 10, (u, v) => 1.05 - u * 1.25 + (v - .5) * .15, 4.4);
  halftone(x, w, h, BLUE, 75, 10, (u, v) => u * 1.25 - .1 - (v - .5) * .15, 4.4);
  x.globalCompositeOperation = "source-over";
};
const risoOne = (bg, ink, angle) => (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = "multiply";
  halftone(x, w, h, ink, angle, 9, (u, v) => .55 + .45 * Math.sin(v * 5.5 + u * 2), 3.6);
  x.globalCompositeOperation = "source-over";
};
const misreg = (x, w, h) => {
  x.fillStyle = "#f3ede0"; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = "multiply";
  x.lineWidth = 9;
  x.strokeStyle = RED; x.strokeRect(10, 10, w - 20, h - 20);
  x.strokeStyle = BLUE; x.strokeRect(16, 15, w - 20, h - 20);
  x.fillStyle = RED; x.globalAlpha = .25; x.fillRect(0, h - 78, w, 78);
  x.fillStyle = BLUE; x.fillRect(5, h - 73, w, 73); x.globalAlpha = 1;
  x.globalCompositeOperation = "source-over";
};
const zigzag = (a, b, s) => (x, w, h) => {
  x.fillStyle = a; x.fillRect(0, 0, w, h); x.strokeStyle = b; x.lineWidth = 5; x.lineJoin = "miter";
  for (let y = 0; y < h + s; y += s * 1.6) { x.beginPath(); for (let i = 0; i * s / 2 <= w + s; i++) { const px = i * s / 2, py = y + (i % 2 ? s / 2 : 0); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
};
const tartan = (a, b, c) => (x, w, h) => {
  x.fillStyle = a; x.fillRect(0, 0, w, h); x.globalCompositeOperation = "multiply";
  x.fillStyle = b; for (let i = 20; i < w; i += 70) x.fillRect(i, 0, 22, h); for (let j = 16; j < h; j += 70) x.fillRect(0, j, w, 22);
  x.fillStyle = c; for (let i = 44; i < w; i += 70) x.fillRect(i, 0, 5, h); for (let j = 40; j < h; j += 70) x.fillRect(0, j, w, 5);
  x.globalCompositeOperation = "source-over";
};
const diagonal = (a, b, s) => (x, w, h) => {
  x.fillStyle = a; x.fillRect(0, 0, w, h); x.fillStyle = b;
  for (let i = -h; i < w + h; i += s * 2) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s, 0); x.lineTo(i + s + h, h); x.lineTo(i + h, h); x.fill(); }
};
const heartPath = (x, cx, cy, r) => { x.beginPath(); x.moveTo(cx, cy + r * .9); x.bezierCurveTo(cx - r * 1.5, cy, cx - r * .8, cy - r * 1.1, cx, cy - r * .4); x.bezierCurveTo(cx + r * .8, cy - r * 1.1, cx + r * 1.5, cy, cx, cy + r * .9); x.fill(); };
const hearts = (bg, fg) => (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg;
  for (let j = 0, row = 0; j < h + 40; j += 46, row++) for (let i = row % 2 ? 23 : 0; i < w + 40; i += 46) heartPath(x, i, j, 9);
};
const starPath = (x, cx, cy, r) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
const stars = (bg, fg) => (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg;
  const r = rnd(21); for (let i = 0; i < 70; i++) { x.globalAlpha = .45 + r() * .55; starPath(x, r() * w, r() * h, 3 + r() * 8); } x.globalAlpha = 1;
};
const bunting = (bg, cols) => (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  for (const [y0, dir] of [[0, 1], [h, -1]]) {
    x.strokeStyle = "#8a6f5a"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, y0 + dir * 4); x.lineTo(w, y0 + dir * 4); x.stroke();
    for (let i = 0, k = 0; i < w; i += 42, k++) { x.fillStyle = cols[k % cols.length]; x.beginPath(); x.moveTo(i + 4, y0 + dir * 4); x.lineTo(i + 38, y0 + dir * 4); x.lineTo(i + 21, y0 + dir * 30); x.closePath(); x.fill(); }
  }
};
const sepia = (x, w, h) => {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#d9bf94"); g.addColorStop(1, "#b78f5e"); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75); v.addColorStop(0, "rgba(60,35,10,0)"); v.addColorStop(1, "rgba(60,35,10,.45)"); x.fillStyle = v; x.fillRect(0, 0, w, h);
};
const newsprint = (x, w, h) => {
  x.fillStyle = "#e9e3d3"; x.fillRect(0, 0, w, h); x.fillStyle = "rgba(60,55,48,.38)";
  const r = rnd(33); for (let y = 10; y < h; y += 11) { let px = 8; while (px < w - 8) { const len = 14 + r() * 40; x.fillRect(px, y, Math.min(len, w - 8 - px), 3); px += len + 6; } }
};
const clouds = (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#9fd0f4"); g.addColorStop(1, "#d9efff"); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = "rgba(255,255,255,.92)"; const r = rnd(5);
  for (let i = 0; i < 16; i++) { const cx = r() * w, cy = r() * h, s = 18 + r() * 26; for (const [dx, dy, k] of [[0, 0, 1], [s * .9, s * .1, .8], [-s * .9, s * .15, .75], [s * .3, -s * .35, .7]]) { x.beginPath(); x.arc(cx + dx, cy + dy, s * k, 0, 7); x.fill(); } }
};
const leaves = (x, w, h) => {
  x.fillStyle = "#cfe6c4"; x.fillRect(0, 0, w, h); const r = rnd(8), cols = ["#7fb069", "#5d9a54", "#a3c98e", "#468c4a"];
  for (let i = 0; i < 90; i++) { x.save(); x.translate(r() * w, r() * h); x.rotate(r() * 6.28); x.fillStyle = cols[i % 4]; x.beginPath(); x.ellipse(0, 0, 8 + r() * 10, 18 + r() * 20, 0, 0, 7); x.fill(); x.strokeStyle = "rgba(255,255,255,.4)"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, -14); x.lineTo(0, 14); x.stroke(); x.restore(); }
};
const rainbow = (x, w, h) => {
  const cols = ["#ffc9c9", "#ffe2b8", "#fff4b0", "#cdeccb", "#c3dcf6", "#dcc9f2"], bh = h / cols.length;
  cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * bh, w, bh + 1); });
};

const FRAMES = [
  { id: "blush",  cat: "Polos",   name: "Blush",    bg: solid("#ffd1dc") },
  { id: "cream",  cat: "Polos",   name: "Krem",    bg: solid("#fff4e0") },
  { id: "sky",    cat: "Polos",   name: "Langit",      bg: solid("#cfe8ff") },
  { id: "mint",   cat: "Polos",   name: "Mint",     bg: solid("#d4f5e2") },
  { id: "white",  cat: "Polos",   name: "Putih",    bg: solid("#ffffff") },
  { id: "black",  cat: "Polos",   name: "Hitam",    bg: solid("#151515"), dark: true },
  { id: "ging",   cat: "Pola", name: "Gingham",  bg: gingham("#ffe3ec", "#f4a6bf", 24) },
  { id: "polka",  cat: "Pola", name: "Polkadot",    bg: dots("#fff1c9", "#f0b33c", 34) },
  { id: "stripe", cat: "Pola", name: "Garis",  bg: stripes("#ffffff", "#bfe0ff", 22) },
  { id: "chk",    cat: "Pola", name: "Papan",  bg: check("#fdf2e4", "#e8c9a4", 30) },
  { id: "conf",   cat: "Pesta", name: "Konfeti", bg: confetti("#fffaf0", ["#ff6b8b", "#ffd166", "#4cc9f0", "#9b8cff"]) },
  { id: "ball",   cat: "Pesta", name: "Balon", bg: balloons("#d9f0ff", ["#ff7aa2", "#ffd166", "#9b8cff", "#6bd6a8"]) },
  { id: "film",   cat: "Vintage",  name: "Film",     bg: film, dark: true },
  { id: "noir",   cat: "Vintage",  name: "Noir",     bg: solid("#3a2c2c"), dark: true },
  { id: "zig",    cat: "Pola",     name: "Zigzag",   bg: zigzag("#fff3d6", "#f0a53a", 30) },
  { id: "tart",   cat: "Pola",     name: "Tartan",   bg: tartan("#f6e7e0", "#e9858a", "#5e86c9") },
  { id: "diag",   cat: "Pola",     name: "Diagonal", bg: diagonal("#e4f1e6", "#b4d8bb", 26) },
  { id: "riso2",  cat: "Riso",     name: "Dua tinta", bg: riso2 },
  { id: "risoR",  cat: "Riso",     name: "Tinta merah", bg: risoOne("#f4eadc", RED, 15) },
  { id: "risoB",  cat: "Riso",     name: "Tinta biru", bg: risoOne("#f4eadc", BLUE, 75) },
  { id: "mis",    cat: "Riso",     name: "Meleset",  bg: misreg },
  { id: "heart",  cat: "Pesta",    name: "Hati",     bg: hearts("#ffe0e8", "#f48aa5") },
  { id: "star",   cat: "Pesta",    name: "Bintang",  bg: stars("#1f2552", "#ffd45c"), dark: true },
  { id: "bunt",   cat: "Pesta",    name: "Bendera",  bg: bunting("#fff6e8", ["#ff8fa8", "#ffd45c", "#7fc4f0", "#8fd6a4"]) },
  { id: "cloud",  cat: "Alam",     name: "Awan",     bg: clouds },
  { id: "leaf",   cat: "Alam",     name: "Daun",     bg: leaves },
  { id: "rain",   cat: "Alam",     name: "Pelangi",  bg: rainbow },
  { id: "sepia",  cat: "Vintage",  name: "Sepia",    bg: sepia },
  { id: "news",   cat: "Vintage",  name: "Koran",    bg: newsprint },
];
const CATS = ["Polos", "Pola", "Riso", "Pesta", "Alam", "Vintage"];

const PROMPTS = [
  "setengah hati masing-masing, nyatu di tengah", "peace di dekat pipi", "cubit pipi sendiri",
  "pasang muka paling lucu", "gandengan tangan lewat layar", "kirim cium jauh",
  "kaget bareng", "pose paling serius", "saling membelakangi", "pose cover majalah",
];

/* ---------- State ---------- */
const S = {
  stream: null, remoteStream: null, peer: null, conn: null, isHost: false,
  layout: "4cut", frame: "blush", cat: "Polos", code: "", bg: "none", filter: "none", fxTab: "bg", raw: null,
  shots: [], picked: [], busy: false, screen: "home",
  touched: { layout: false, frame: false }, peerPick: { layout: null, frame: null },
};
const hasRemote = () => !!S.remoteStream;
const need = () => LAYOUTS[S.layout].n;
const frameDef = () => FRAMES.find((f) => f.id === S.frame);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (m) => { if (S.conn && S.conn.open) S.conn.send(m); };

/* ---------- Navigasi ---------- */
const STEP_OF = { layout: "frame", frame: "frame", shoot: "shoot", pick: "pick", style: "style", done: "done" };
const STEP_NAME = ["Bentuk & frame", "Foto", "Pilih", "Sentuhan akhir", "Selesai"];
const BACK_TO = { room: "home", layout: () => (S.peer ? "room" : "home"), frame: "layout", shoot: () => (S.busy ? null : "frame"), pick: "shoot", style: "pick" };

function go(name) {
  S.screen = name;
  document.querySelectorAll("[data-screen]").forEach((sec) => (sec.hidden = sec.dataset.screen !== name));
  const cur = STEP_OF[name];
  const idx = ["frame", "shoot", "pick", "style", "done"].indexOf(cur);
  $("stepper").hidden = idx < 0;
  if (idx >= 0) $("stepLabel").textContent = `Langkah ${idx + 1} dari 5 · ${STEP_NAME[idx]}`;
  document.querySelectorAll("#steps li").forEach((li, i) => { li.className = i === idx ? "on" : i < idx ? "past" : ""; });
  $("btnBack").hidden = !(name in BACK_TO);
  if (name === "shoot") attachVideos();
  if (name === "frame") renderFrames();
  if (name === "layout") renderLayouts();
  window.scrollTo(0, 0);
}
$("btnBack").onclick = () => {
  let back = BACK_TO[S.screen];
  if (typeof back === "function") back = back();
  if (back) go(back);
};

/* ---------- Status kehadiran pasangan ---------- */
function setPresence(state, text) {
  const el = $("roomStatus");
  el.dataset.state = state;
  el.querySelector(".pres-text").textContent = text;
}
function updateBadge() {
  const b = $("camBadge");
  b.dataset.on = hasRemote() ? "1" : "0";
  b.querySelector("span").textContent = hasRemote() ? "Berdua" : "Sendiri";
}

/* ---------- Kamera & koneksi ---------- */
async function ensureCam() {
  if (S.stream) return true;
  try {
    S.raw = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720 }, audio: false });
  } catch (e) {
    $("camError").hidden = false;
    $("camError").scrollIntoView({ block: "nearest", behavior: "smooth" });
    return false;
  }
  $("camError").hidden = true;
  const src = $("camSrc");
  src.srcObject = S.raw;
  await src.play().catch(() => {});
  // Kamera diproses ke canvas (mirror + background + filter); canvas inilah yang dikirim ke pasangan.
  S.stream = $("local").captureStream(30);
  const tick = () => { drawFrame(); requestAnimationFrame(tick); };
  tick();
  return true;
}
function drawFrame() {
  const v = $("camSrc"), cv = $("local");
  try {
    if (window.FX) return FX.render(v, cv, S.bg, S.filter);
  } catch (e) { console.warn(e); }
  if (!v.videoWidth) return;
  const x = cv.getContext("2d");
  x.save(); x.setTransform(-1, 0, 0, 1, cv.width, 0); cover(x, v, 0, 0, cv.width, cv.height, false); x.restore();
}
function attachVideos() {
  const r = $("remote");
  r.hidden = !hasRemote();
  if (hasRemote()) r.srcObject = S.remoteStream;
  updateBadge();
  renderFx();
}
const newCode = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

function onRemote(stream) {
  S.remoteStream = stream;
  setPresence("ok", "Dia sudah masuk");
  if (S.screen === "shoot") attachVideos(); else updateBadge();
}
function setupConn(c) {
  S.conn = c;
  c.on("open", () => {
    setPresence("ok", "Dia sudah masuk");
    $("homeStatus").textContent = "Tersambung!";
    setColors();
    if (!S.isHost && S.screen === "home") go("layout");
    if (S.isHost && S.screen === "room") go("layout");
    sendPick();
    send({ t: "cat", cat: S.cat });
  });
  c.on("data", onMsg);
  c.on("close", () => { S.remoteStream = null; setPresence("off", "Dia keluar dari room"); if (S.screen === "shoot") attachVideos(); else updateBadge(); });
}
function onMsg(m) {
  if (m.t === "pick") { S.peerPick = { layout: m.layout, frame: m.frame }; refreshSel(); }
  if (m.t === "cat") { S.cat = m.cat; if (S.screen === "frame") renderFrames(); }
  if (m.t === "next") {
    // Yang menekan Lanjut yang menentukan. Kalau kalian menekan bersamaan, pilihan host yang dipakai.
    if (m.step === "layout") {
      if (S.screen === "layout") { S.layout = m.layout; go("frame"); }
      else if (S.screen === "frame" && !S.isHost && m.host) { S.layout = m.layout; renderFrames(); }
    }
    if (m.step === "frame") {
      if (S.screen === "frame") { S.layout = m.layout; S.frame = m.frame; go("shoot"); }
      else if (S.screen === "shoot" && !S.isHost && m.host && !S.busy) { S.layout = m.layout; S.frame = m.frame; }
    }
  }
  if (m.t === "shoot") { go("shoot"); runShoot(); }
}
const sendPick = () => send({ t: "pick", layout: S.touched.layout ? S.layout : null, frame: S.touched.frame ? S.frame : null });
function setColors() {            // host = pink, tamu = biru; "me" selalu warnamu sendiri
  const root = document.documentElement.style;
  root.setProperty("--me", S.isHost ? "#ff4b3e" : "#2536d6");
  root.setProperty("--peer", S.isHost ? "#2536d6" : "#ff4b3e");
}
const peerError = (e) => ({
  "peer-unavailable": "Kode room tidak ditemukan. Cek lagi kodenya.",
  "network": "Tidak bisa tersambung ke server. Cek koneksi internetmu.",
  "server-error": "Server sedang bermasalah. Coba lagi sebentar lagi.",
  "browser-incompatible": "Browser ini belum mendukung koneksi langsung.",
}[e.type] || `Ada kendala koneksi (${e.type}).`);

function showCode(code) {
  S.code = code;
  $("roomCode").innerHTML = code.split("").map((c, i) => `<span class="${i % 2 ? "t-b" : "t-a"}">${c}</span>`).join("");
}
function openRoom(attempt = 0) {
  const code = newCode();
  showCode(code);
  setPresence("wait", "Menyiapkan room…");
  S.peer = new Peer(PREFIX + code);
  S.peer.on("open", () => setPresence("wait", "Menunggu dia masuk…"));
  S.peer.on("error", (e) => {
    if (e.type === "unavailable-id" && attempt < 3) { S.peer.destroy(); return openRoom(attempt + 1); }   // kode bentrok: buat kode baru
    setPresence("err", peerError(e));
  });
  S.peer.on("call", (call) => { call.answer(S.stream); call.on("stream", onRemote); });
  S.peer.on("connection", setupConn);
}
$("btnCreate").onclick = async () => {
  if (!(await ensureCam())) return;
  S.isHost = true;
  setColors();
  go("room");
  openRoom();
};
{
  const q = new URLSearchParams(location.search).get("room");
  if (q) {
    $("joinCode").value = q.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    $("homeStatus").textContent = "Kamu diundang ke sebuah room. Tekan Gabung.";
  }
}
$("btnRoomSolo").onclick = () => { setColors(); go("layout"); };
$("btnLeave").onclick = () => { if (S.peer) { try { S.peer.destroy(); } catch (e) {} S.peer = null; } S.conn = null; S.remoteStream = null; go("home"); };

const roomLink = () => `${location.origin}${location.pathname}?room=${S.code}`;
$("btnCopy").onclick = async () => {
  const b = $("btnCopy"), old = "Salin link";
  try { await navigator.clipboard.writeText(roomLink()); b.textContent = "Tersalin ✓"; } catch (e) { b.textContent = "Salin manual ya"; }
  setTimeout(() => (b.textContent = old), 1600);
};
$("btnShare").onclick = async () => {
  const text = `Ayo foto bareng di frameus! Buka ${roomLink()} (kode ${S.code})`;
  if (navigator.share) { try { await navigator.share({ title: "frameus", text, url: roomLink() }); } catch (e) {} }
  else { try { await navigator.clipboard.writeText(text); $("btnShare").textContent = "Pesan tersalin ✓"; setTimeout(() => ($("btnShare").textContent = "Bagikan ↗"), 1600); } catch (e) {} }
};

$("joinCode").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
$("joinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("joinCode").value.trim().toUpperCase();
  if (!code) { $("homeStatus").textContent = "Masukkan kode room dari pasanganmu dulu."; $("joinCode").focus(); return; }
  if (!(await ensureCam())) return;
  S.isHost = false;
  $("homeStatus").textContent = "Menyambung ke room…";
  S.peer = new Peer();
  S.peer.on("error", (er) => ($("homeStatus").textContent = peerError(er)));
  S.peer.on("open", () => {
    setupConn(S.peer.connect(PREFIX + code));
    const call = S.peer.call(PREFIX + code, S.stream);
    call.on("stream", onRemote);
  });
});
$("btnSolo").onclick = async () => { if (await ensureCam()) { S.isHost = true; setColors(); go("layout"); } };

/* ---------- Pilih layout & frame ---------- */
function layoutIcon(L) {
  const el = document.createElement("div");
  el.className = "ico";
  el.style.gridTemplateColumns = `repeat(${L.cols},1fr)`;
  el.style.width = L.cols > 1 ? "84px" : "56px";
  for (let i = 0; i < L.n; i++) { const b = document.createElement("i"); b.style.height = L.cols > 1 ? "30px" : L.n > 2 ? "28px" : "58px"; el.append(b); }
  if (L.n === 1) el.style.paddingBottom = "18px";
  return el;
}
function renderLayouts() {
  const box = $("layouts");
  box.innerHTML = "";
  for (const [id, L] of Object.entries(LAYOUTS)) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "opt"; b.dataset.id = id;
    b.setAttribute("role", "radio");
    b.append(layoutIcon(L));
    b.insertAdjacentHTML("beforeend", `<b>${L.name}</b><small>${L.desc}</small><span class="who-row"></span><span class="check" aria-hidden="true">✓</span>`);
    b.onclick = () => { S.layout = id; S.touched.layout = true; sendPick(); refreshSel(); };
    box.append(b);
  }
  refreshSel();
}
function renderFrames() {
  const cats = $("cats");
  cats.innerHTML = "";
  CATS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tab" + (c === S.cat ? " sel" : ""); b.dataset.cat = c;
    const n = FRAMES.filter((f) => f.cat === c).length;
    b.innerHTML = `${c}<span class="tab-count">${n}</span>`;
    b.setAttribute("role", "tab"); b.setAttribute("aria-selected", c === S.cat);
    b.onclick = () => { S.cat = c; send({ t: "cat", cat: c }); renderFrames(); };
    cats.append(b);
  });
  const box = $("frames");
  box.innerHTML = "";
  FRAMES.filter((f) => f.cat === S.cat).forEach((f) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "fcard"; b.dataset.id = f.id;
    b.setAttribute("role", "radio");
    const cv = document.createElement("canvas");
    render(cv, { frame: f, shots: null, scale: 0.5 });
    b.append(cv);
    b.insertAdjacentHTML("beforeend", `<b>${f.name}</b><span class="who-row"></span><span class="check" aria-hidden="true">✓</span>`);
    b.onclick = () => { S.frame = f.id; S.touched.frame = true; sendPick(); refreshSel(); };
    box.append(b);
  });
  refreshSel();
}
// Tandai siapa memilih apa: cincin warnamu, cincin warna pasangan, dan keduanya jika sama.
function mark(node, isMe, isPeer) {
  const tok = [isMe && "me", isPeer && "peer"].filter(Boolean).join(" ");
  if (tok) node.dataset.pick = tok; else delete node.dataset.pick;
  node.setAttribute("aria-checked", isMe);
  const row = node.querySelector(".who-row");
  if (row) row.innerHTML = (isMe ? '<span class="who me">Kamu</span>' : "") + (isPeer ? '<span class="who peer">Dia</span>' : "");
}
function refreshSel() {
  const pl = S.peerPick.layout, pf = S.peerPick.frame;
  document.querySelectorAll("#layouts .opt").forEach((b) => mark(b, b.dataset.id === S.layout, b.dataset.id === pl));
  document.querySelectorAll("#frames .fcard").forEach((b) => mark(b, b.dataset.id === S.frame, b.dataset.id === pf));
  document.querySelectorAll("#cats .tab").forEach((b) => {
    const ids = FRAMES.filter((f) => f.cat === b.dataset.cat).map((f) => f.id);
    const tok = [ids.includes(S.frame) && "me", pf && ids.includes(pf) && "peer"].filter(Boolean).join(" ");
    if (tok) b.dataset.pick = tok; else delete b.dataset.pick;
  });
  const diff = (a, b) => a && b && a !== b;
  $("layoutNote").textContent = diff(S.layout, pl) ? "Pilihan kalian beda. Siapa yang menekan Lanjut, dia yang menentukan." : "";
  $("frameNote").textContent = diff(S.frame, pf) ? "Pilihan kalian beda. Siapa yang menekan Lanjut, dia yang menentukan." : "";
}
$("btnLayoutNext").onclick = () => { send({ t: "next", step: "layout", layout: S.layout, host: S.isHost }); go("frame"); };
$("btnFrameNext").onclick = () => { send({ t: "next", step: "frame", layout: S.layout, frame: S.frame, host: S.isHost }); go("shoot"); };

/* ---------- Render photo strip ---------- */
function render(canvas, { frame, shots, scale = 1, caption = "", date = false }) {
  const L = LAYOUTS[S.layout];
  const footer = L.n === 1 ? 140 : 100;
  const W = L.cols * CW + (L.cols - 1) * GAP + PAD * 2;
  const H = PAD + L.rows * (CH + GAP) - GAP + footer;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const x = canvas.getContext("2d");
  x.scale(scale, scale);
  frame.bg(x, W, H);
  for (let i = 0; i < L.n; i++) {
    const px = PAD + (i % L.cols) * (CW + GAP);
    const py = PAD + Math.floor(i / L.cols) * (CH + GAP);
    x.fillStyle = "#fff"; x.fillRect(px, py, CW, CH);
    if (shots && shots[i]) x.drawImage(shots[i], px, py, CW, CH);
  }
  if (shots) {
    x.fillStyle = frame.dark ? "rgba(0,0,0,.4)" : "rgba(255,252,244,.78)";   // alas keterangan: terbaca di atas motif ramai
    x.fillRect(PAD, H - footer + 8, W - PAD * 2, footer - 8 - PAD * .45);
    x.fillStyle = frame.dark ? "#f5f5f5" : "#2a2420";
    x.textAlign = "center";
    x.font = "800 30px 'Bricolage Grotesque', system-ui, sans-serif";
    x.fillText(caption, W / 2, H - footer / 2 - (date ? 0 : -10));
    if (date) { x.font = "400 15px 'Space Mono', ui-monospace, monospace"; x.fillText(new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }), W / 2, H - footer / 2 + 26); }
  }
}

/* ---------- Pemotretan ---------- */
function cover(x, v, dx, dy, dw, dh, mirror) {
  const vw = v.videoWidth || v.width || dw, vh = v.videoHeight || v.height || dh;
  const s = Math.max(dw / vw, dh / vh);
  x.save();
  x.beginPath(); x.rect(dx, dy, dw, dh); x.clip();
  if (mirror) { x.translate(dx + dw, dy); x.scale(-1, 1); x.translate(-dx, -dy); }
  x.drawImage(v, dx + (dw - vw * s) / 2, dy + (dh - vh * s) / 2, vw * s, vh * s);
  x.restore();
}
function grab() {
  const c = document.createElement("canvas");
  c.width = CW; c.height = CH;
  const x = c.getContext("2d");
  if (!hasRemote()) { cover(x, $("local"), 0, 0, CW, CH, false); return c; }
  const half = CW / 2;
  // kiri = host, kanan = tamu (sama di kedua sisi)
  cover(x, $("local"), S.isHost ? 0 : half, 0, half, CH, false);
  cover(x, $("remote"), S.isHost ? half : 0, 0, half, CH, false);
  return c;
}
async function countdown() {
  const el = $("count");
  el.hidden = false;
  for (let i = 3; i > 0; i--) {
    el.textContent = i;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    await wait(1000);
  }
  el.hidden = true;
}
function flash() { const f = $("flash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); }
function drawThumbs(total, cur = -1) {
  const box = $("thumbs");
  box.innerHTML = "";
  for (let i = 0; i < total; i++) {
    const d = document.createElement("div");
    if (i === cur) d.className = "cur";
    if (S.shots[i]) { const im = new Image(); im.alt = `Foto ${i + 1}`; im.src = S.shots[i].toDataURL("image/jpeg", .7); d.append(im); } else d.textContent = i + 1;
    box.append(d);
  }
}
async function runShoot() {
  if (S.busy) return;
  S.busy = true;
  S.shots = [];
  $("btnBack").hidden = true;
  document.querySelector(".shutter-wrap").hidden = true;
  $("fx").hidden = true;
  $("shootSub").textContent = "Tatap kamera dan ikuti ide di bawah.";
  const total = need() + EXTRA_SHOTS;
  const prompts = [...PROMPTS].sort(() => Math.random() - .5);
  attachVideos();
  for (let i = 0; i < total; i++) {
    $("shootTitle").textContent = `Foto ${i + 1} dari ${total}`;
    $("tryBox").hidden = false;
    $("tryText").textContent = prompts[i % prompts.length];
    drawThumbs(total, i);
    await countdown();
    flash();
    S.shots.push(grab());
    drawThumbs(total, i + 1);
    await wait(650);
  }
  S.busy = false;
  document.querySelector(".shutter-wrap").hidden = false;
  $("fx").hidden = false;
  $("tryBox").hidden = true;
  $("shootTitle").textContent = "Siap-siap, ya";
  $("shootSub").textContent = "Pastikan wajah kelihatan, lalu tekan tombol merah.";
  $("thumbs").innerHTML = "";
  startPick();
}
$("btnShoot").onclick = () => { send({ t: "shoot" }); runShoot(); };

/* ---------- Latar & filter wajah ---------- */
document.querySelectorAll("[data-fx]").forEach((b) => (b.onclick = () => { S.fxTab = b.dataset.fx; renderFx(); }));
function fxButton(face, label, pressed, onclick) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "fxo"; b.setAttribute("aria-pressed", pressed); b.setAttribute("aria-label", label);
  const f = document.createElement("span"); f.className = "face";
  if (face instanceof Node) f.append(face); else f.textContent = face;
  b.append(f);
  b.insertAdjacentHTML("beforeend", `<small>${label}</small>`);
  b.onclick = onclick;
  return b;
}
function renderFx() {
  document.querySelectorAll("[data-fx]").forEach((b) => {
    const on = b.dataset.fx === "bg" ? S.bg !== "none" : S.filter !== "none";
    b.classList.toggle("sel", b.dataset.fx === S.fxTab);
    b.setAttribute("aria-selected", b.dataset.fx === S.fxTab);
    b.textContent = (b.dataset.fx === "bg" ? "Latar" : "Filter wajah") + (on ? " •" : "");
  });
  const box = $("fxOpts");
  box.innerHTML = "";
  if (!window.FX) { $("fxStatus").textContent = "Efek belum termuat. Muat ulang halaman jika tetap begini."; return; }
  const key = S.fxTab === "bg" ? "bg" : "filter";
  box.append(fxButton("✕", "Tanpa", S[key] === "none", () => { S[key] = "none"; renderFx(); }));
  if (key === "bg") {
    FX.BGS.forEach((b) => {
      const cv = document.createElement("canvas"); cv.width = 120; cv.height = 120;
      cv.getContext("2d").drawImage(FX.bgCanvas(b.id), 80, 0, 480, 480, 0, 0, 120, 120);
      box.append(fxButton(cv, b.name, S.bg === b.id, () => pickFx("bg", b.id)));
    });
  } else {
    FX.FILTERS.forEach((f) => box.append(fxButton(f.icon, f.name || f.id, S.filter === f.id, () => pickFx("filter", f.id))));
  }
}
async function pickFx(key, id) {
  S[key] = id; renderFx();
  const st = $("fxStatus");
  try {
    await FX.ensure((s) => { if (s === "loading") st.textContent = "Menyiapkan efek… pertama kali agak lama, ya."; });
    st.textContent = "";
  } catch (e) {
    S[key] = "none"; renderFx();
    st.textContent = "Efek gagal dimuat: " + (e && e.message || e);
  }
}
window.addEventListener("fx-ready", renderFx);

/* ---------- Pilih foto ---------- */
function startPick() {
  S.picked = [];
  $("pickSub").textContent = `Pilih ${need()} foto. Urutannya sesuai urutan kamu menekan.`;
  const grid = $("pickGrid");
  grid.innerHTML = "";
  const count = () => { $("pickCount").textContent = `${S.picked.length} dari ${need()}`; $("btnPickNext").disabled = S.picked.length !== need(); };
  S.shots.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pick"; b.setAttribute("aria-label", `Foto ${i + 1}`);
    b.innerHTML = `<img alt="" src="${c.toDataURL("image/jpeg", .8)}"><em></em>`;
    b.onclick = () => {
      const at = S.picked.indexOf(i);
      if (at >= 0) S.picked.splice(at, 1);
      else if (S.picked.length < need()) S.picked.push(i);
      grid.querySelectorAll(".pick").forEach((btn, k) => {
        const pos = S.picked.indexOf(k);
        btn.classList.toggle("sel", pos >= 0);
        btn.setAttribute("aria-pressed", pos >= 0);
        btn.querySelector("em").textContent = pos >= 0 ? pos + 1 : "";
      });
      count();
    };
    grid.append(b);
  });
  count();
  go("pick");
}
$("btnPickNext").onclick = () => { go("style"); drawStyle(); };

/* ---------- Style & selesai ---------- */
const opts = () => ({ frame: frameDef(), shots: S.picked.map((i) => S.shots[i]), caption: $("caption").value, date: $("showDate").checked });
function drawStyle() { render($("preview"), opts()); }
$("caption").oninput = drawStyle;
$("showDate").onchange = drawStyle;
$("btnStyleNext").onclick = () => {
  const cv = $("final");
  render(cv, opts());
  $("btnDownload").href = cv.toDataURL("image/png");
  $("btnDownload").download = `frameus-${new Date().toISOString().slice(0, 10)}.png`;
  $("btnShareImg").hidden = !(navigator.canShare && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] }));
  go("done");
};
$("btnShareImg").onclick = async () => {
  $("final").toBlob(async (blob) => {
    const file = new File([blob], "frameus.png", { type: "image/png" });
    try { await navigator.share({ files: [file], title: "Foto kita di frameus ♥" }); } catch (e) {}
  }, "image/png");
};
$("btnAgain").onclick = () => { S.shots = []; S.picked = []; go("layout"); };

go("home");
{
  const q = new URLSearchParams(location.search).get("room");   // tautan undangan: kolom kode langsung terisi
  if (q) {
    $("joinCode").value = q.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    $("homeStatus").textContent = "Kamu diundang ke sebuah room. Tekan Gabung.";
  }
}
