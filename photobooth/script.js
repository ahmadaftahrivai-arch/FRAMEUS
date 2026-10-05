const $ = (id) => document.getElementById(id);
const PREFIX = "ldrbooth-";
const CW = 480, CH = 360, PAD = 28, GAP = 18; // ukuran sel foto 4:3

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
];
const CATS = ["Polos", "Pola", "Pesta", "Vintage"];

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
  el.querySelector("span").textContent = text;
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
  setPresence("ok", "Pasangan sudah terhubung");
  if (S.screen === "shoot") attachVideos(); else updateBadge();
}
function setupConn(c) {
  S.conn = c;
  c.on("open", () => {
    setPresence("ok", "Pasangan sudah terhubung");
    $("homeStatus").textContent = "Tersambung!";
    if (!S.isHost && S.screen === "home") go("layout");
    if (S.isHost) send({ t: "cfg", layout: S.layout, frame: S.frame });
  });
  c.on("data", onMsg);
  c.on("close", () => { S.remoteStream = null; setPresence("off", "Pasangan terputus"); if (S.screen === "shoot") attachVideos(); else updateBadge(); });
}
function onMsg(m) {
  if (m.t === "cfg") { S.layout = m.layout; S.frame = m.frame; refreshSel(); }
  if (m.t === "next" && S.screen === "layout") go("frame");
  if (m.t === "next" && S.screen === "frame") go("shoot");
  if (m.t === "shoot") { go("shoot"); runShoot(); }
}
const pushCfg = () => send({ t: "cfg", layout: S.layout, frame: S.frame });
const peerError = (e) => ({
  "peer-unavailable": "Kode room tidak ditemukan. Cek lagi kodenya.",
  "network": "Tidak bisa tersambung ke server. Cek koneksi internetmu.",
  "server-error": "Server sedang bermasalah. Coba lagi sebentar lagi.",
  "browser-incompatible": "Browser ini belum mendukung koneksi langsung.",
}[e.type] || `Ada kendala koneksi (${e.type}).`);

function showCode(code) {
  S.code = code;
  $("roomCode").innerHTML = code.split("").map((c) => `<span>${c}</span>`).join("");
}
function openRoom(attempt = 0) {
  const code = newCode();
  showCode(code);
  setPresence("wait", "Menyiapkan room…");
  S.peer = new Peer(PREFIX + code);
  S.peer.on("open", () => setPresence("wait", "Menunggu pasangan…"));
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
  go("room");
  openRoom();
};
$("btnRoomNext").onclick = () => go("layout");

$("btnCopy").onclick = async () => {
  const b = $("btnCopy"), old = "Salin kode";
  try { await navigator.clipboard.writeText(S.code); b.textContent = "Tersalin ✓"; } catch (e) { b.textContent = "Salin manual ya"; }
  setTimeout(() => (b.textContent = old), 1600);
};
$("btnShare").onclick = async () => {
  const text = `Ayo foto bareng di frameus! Buka ${location.href.split("?")[0]} lalu gabung dengan kode ${S.code}`;
  if (navigator.share) { try { await navigator.share({ title: "frameus", text }); } catch (e) {} }
  else { try { await navigator.clipboard.writeText(text); $("btnShare").textContent = "Pesan tersalin ✓"; setTimeout(() => ($("btnShare").textContent = "Bagikan"), 1600); } catch (e) {} }
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
$("btnSolo").onclick = async () => { if (await ensureCam()) go("layout"); };

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
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", id === S.layout);
    b.append(layoutIcon(L));
    b.insertAdjacentHTML("beforeend", `<b>${L.name}</b><small>${L.desc}</small><span class="check" aria-hidden="true">✓</span>`);
    b.onclick = () => { S.layout = id; pushCfg(); refreshSel(); };
    box.append(b);
  }
}
function renderFrames() {
  const cats = $("cats");
  cats.innerHTML = "";
  CATS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tab" + (c === S.cat ? " sel" : ""); b.textContent = c;
    b.setAttribute("role", "tab"); b.setAttribute("aria-selected", c === S.cat);
    b.onclick = () => { S.cat = c; renderFrames(); };
    cats.append(b);
  });
  const box = $("frames");
  box.innerHTML = "";
  FRAMES.filter((f) => f.cat === S.cat).forEach((f) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "fcard"; b.dataset.id = f.id;
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", f.id === S.frame);
    const cv = document.createElement("canvas");
    render(cv, { frame: f, shots: null, scale: 0.5 });
    b.append(cv);
    b.insertAdjacentHTML("beforeend", `<b>${f.name}</b><span class="check" aria-hidden="true">✓</span>`);
    b.onclick = () => { S.frame = f.id; pushCfg(); refreshSel(); };
    box.append(b);
  });
}
function refreshSel() {
  document.querySelectorAll("#layouts .opt").forEach((b) => b.setAttribute("aria-checked", b.dataset.id === S.layout));
  document.querySelectorAll("#frames .fcard").forEach((b) => b.setAttribute("aria-checked", b.dataset.id === S.frame));
  if (S.screen === "frame") renderFrames();
}
$("btnLayoutNext").onclick = () => { send({ t: "next" }); go("frame"); };
$("btnFrameNext").onclick = () => { send({ t: "next" }); go("shoot"); };

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
    x.fillStyle = frame.dark ? "#f5f5f5" : "#3a2a30";
    x.textAlign = "center";
    x.font = "800 30px Fraunces, Georgia, serif";
    x.fillText(caption, W / 2, H - footer / 2 - (date ? 0 : -10));
    if (date) { x.font = "500 16px 'DM Sans', system-ui, sans-serif"; x.fillText(new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }), W / 2, H - footer / 2 + 26); }
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
