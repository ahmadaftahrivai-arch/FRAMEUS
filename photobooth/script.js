const $ = (id) => document.getElementById(id);
const PREFIX = "ldrbooth-";
const CW = 480, CH = 360, PAD = 28, GAP = 18; // ukuran sel foto 4:3

/* ---------- Data: layout, frame, prompt ---------- */
const LAYOUTS = {
  "4cut":     { name: "4 cut",    desc: "the classic strip", n: 4, cols: 1, rows: 4 },
  "2x2":      { name: "2 × 2",    desc: "four, on a card",   n: 4, cols: 2, rows: 2 },
  "2cut":     { name: "2 cut",    desc: "two big photos",    n: 2, cols: 1, rows: 2 },
  "polaroid": { name: "Polaroid", desc: "one shot",          n: 1, cols: 1, rows: 1 },
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
  { id: "blush",  cat: "Simple",   name: "Blush",    bg: solid("#ffd1dc") },
  { id: "cream",  cat: "Simple",   name: "Cream",    bg: solid("#fff4e0") },
  { id: "sky",    cat: "Simple",   name: "Sky",      bg: solid("#cfe8ff") },
  { id: "mint",   cat: "Simple",   name: "Mint",     bg: solid("#d4f5e2") },
  { id: "white",  cat: "Simple",   name: "White",    bg: solid("#ffffff") },
  { id: "black",  cat: "Simple",   name: "Black",    bg: solid("#151515"), dark: true },
  { id: "ging",   cat: "Patterns", name: "Gingham",  bg: gingham("#ffe3ec", "#f4a6bf", 24) },
  { id: "polka",  cat: "Patterns", name: "Polka",    bg: dots("#fff1c9", "#f0b33c", 34) },
  { id: "stripe", cat: "Patterns", name: "Stripes",  bg: stripes("#ffffff", "#bfe0ff", 22) },
  { id: "chk",    cat: "Patterns", name: "Checker",  bg: check("#fdf2e4", "#e8c9a4", 30) },
  { id: "conf",   cat: "Birthday", name: "Confetti", bg: confetti("#fffaf0", ["#ff6b8b", "#ffd166", "#4cc9f0", "#9b8cff"]) },
  { id: "ball",   cat: "Birthday", name: "Balloons", bg: balloons("#d9f0ff", ["#ff7aa2", "#ffd166", "#9b8cff", "#6bd6a8"]) },
  { id: "film",   cat: "Vintage",  name: "Film",     bg: film, dark: true },
  { id: "noir",   cat: "Vintage",  name: "Noir",     bg: solid("#3a2c2c"), dark: true },
];
const CATS = ["Simple", "Patterns", "Birthday", "Vintage"];

const PROMPTS = [
  "half a heart each. They join in the middle", "peace sign by your cheek", "squish your own cheeks",
  "make the silliest face you can", "hold hands through the screen", "blow a kiss to each other",
  "look surprised together", "strike your most serious pose", "pretend you're back to back",
  "both pose like a magazine cover",
];

/* ---------- State ---------- */
const S = {
  stream: null, remoteStream: null, peer: null, conn: null, isHost: false,
  layout: "4cut", frame: "blush", cat: "Simple",
  shots: [], picked: [], busy: false, screen: "home",
};
const hasRemote = () => !!S.remoteStream;
const need = () => LAYOUTS[S.layout].n;
const frameDef = () => FRAMES.find((f) => f.id === S.frame);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (m) => { if (S.conn && S.conn.open) S.conn.send(m); };

/* ---------- Navigasi ---------- */
const ORDER = ["layout", "frame", "shoot", "pick", "style", "done"];
const STEP_OF = { layout: "frame", frame: "frame", shoot: "shoot", pick: "pick", style: "style", done: "done" };

function go(name) {
  S.screen = name;
  document.querySelectorAll("[data-screen]").forEach((s) => (s.hidden = s.dataset.screen !== name));
  $("steps").hidden = !STEP_OF[name];
  const cur = STEP_OF[name];
  const idx = ["frame", "shoot", "pick", "style", "done"].indexOf(cur);
  document.querySelectorAll("#steps li").forEach((li, i) => {
    li.className = i === idx ? "on" : i < idx ? "past" : "";
  });
  $("btnBack").hidden = !["layout", "frame", "pick", "style"].includes(name) && !(name === "room");
  if (name === "shoot") attachVideos();
  if (name === "frame") renderFrames();
  if (name === "layout") renderLayouts();
  window.scrollTo(0, 0);
}
$("btnBack").onclick = () => {
  const back = { room: "home", layout: S.peer ? "room" : "home", frame: "layout", pick: "shoot", style: "pick" }[S.screen];
  if (back) go(back);
};

/* ---------- Kamera & koneksi ---------- */
async function ensureCam() {
  if (S.stream) return true;
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720 }, audio: false });
    return true;
  } catch (e) {
    alert("Kamera tidak bisa diakses. Izinkan akses kamera dan buka lewat HTTPS atau localhost.");
    return false;
  }
}
function attachVideos() {
  $("local").srcObject = S.stream;
  const r = $("remote");
  r.hidden = !hasRemote();
  if (hasRemote()) r.srcObject = S.remoteStream;
}
const newCode = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

function onRemote(stream) {
  S.remoteStream = stream;
  $("roomStatus").textContent = "Pasangan terhubung ✅";
  if (S.screen === "shoot") attachVideos();
}
function setupConn(c) {
  S.conn = c;
  c.on("open", () => {
    $("roomStatus").textContent = "Pasangan terhubung ✅";
    $("homeStatus").textContent = "Terhubung ✅";
    if (!S.isHost && S.screen === "home") go("layout");
    if (S.isHost) send({ t: "cfg", layout: S.layout, frame: S.frame });
  });
  c.on("data", onMsg);
  c.on("close", () => { S.remoteStream = null; $("roomStatus").textContent = "Pasangan terputus."; if (S.screen === "shoot") attachVideos(); });
}
function onMsg(m) {
  if (m.t === "cfg") { S.layout = m.layout; S.frame = m.frame; refreshSel(); }
  if (m.t === "next" && S.screen === "layout") go("frame");
  if (m.t === "next" && S.screen === "frame") go("shoot");
  if (m.t === "shoot") { go("shoot"); runShoot(); }
}
const pushCfg = () => send({ t: "cfg", layout: S.layout, frame: S.frame });

$("btnCreate").onclick = async () => {
  if (!(await ensureCam())) return;
  S.isHost = true;
  const code = newCode();
  $("roomCode").textContent = code;
  $("roomStatus").textContent = "Membuat room…";
  go("room");
  S.peer = new Peer(PREFIX + code);
  S.peer.on("open", () => ($("roomStatus").textContent = "Menunggu pasangan…"));
  S.peer.on("error", (e) => ($("roomStatus").textContent = "Error: " + e.type));
  S.peer.on("call", (call) => { call.answer(S.stream); call.on("stream", onRemote); });
  S.peer.on("connection", setupConn);
};
$("btnRoomNext").onclick = () => go("layout");

$("btnJoin").onclick = async () => {
  const code = $("joinCode").value.trim().toUpperCase();
  if (!code) return ($("homeStatus").textContent = "Masukkan kode room dulu.");
  if (!(await ensureCam())) return;
  S.isHost = false;
  $("homeStatus").textContent = "Menyambung…";
  S.peer = new Peer();
  S.peer.on("error", (e) => ($("homeStatus").textContent = "Gagal join: " + e.type));
  S.peer.on("open", () => {
    setupConn(S.peer.connect(PREFIX + code));
    const call = S.peer.call(PREFIX + code, S.stream);
    call.on("stream", onRemote);
  });
};
$("btnSolo").onclick = async () => { if (await ensureCam()) go("layout"); };

/* ---------- Pilih layout & frame ---------- */
function layoutIcon(L) {
  const el = document.createElement("div");
  el.className = "ico";
  el.style.gridTemplateColumns = `repeat(${L.cols},1fr)`;
  el.style.width = L.cols > 1 ? "64px" : "40px";
  for (let i = 0; i < L.n; i++) { const b = document.createElement("i"); b.style.height = L.cols > 1 ? "22px" : L.n > 2 ? "22px" : "44px"; el.append(b); }
  if (L.n === 1) el.style.paddingBottom = "14px";
  return el;
}
function renderLayouts() {
  const box = $("layouts");
  box.innerHTML = "";
  for (const [id, L] of Object.entries(LAYOUTS)) {
    const b = document.createElement("button");
    b.className = "card" + (id === S.layout ? " sel" : "");
    b.dataset.id = id;
    b.append(layoutIcon(L));
    b.insertAdjacentHTML("beforeend", `<b>${L.name}</b><small>${L.desc}</small>`);
    b.onclick = () => { S.layout = id; pushCfg(); refreshSel(); };
    box.append(b);
  }
}
function renderFrames() {
  const cats = $("cats");
  cats.innerHTML = "";
  CATS.forEach((c) => {
    const b = document.createElement("button");
    b.className = "chip" + (c === S.cat ? " sel" : "");
    b.textContent = c;
    b.onclick = () => { S.cat = c; renderFrames(); };
    cats.append(b);
  });
  const box = $("frames");
  box.innerHTML = "";
  FRAMES.filter((f) => f.cat === S.cat).forEach((f) => {
    const b = document.createElement("button");
    b.className = "card" + (f.id === S.frame ? " sel" : "");
    b.dataset.id = f.id;
    const cv = document.createElement("canvas");
    render(cv, { frame: f, shots: null, scale: 0.5 });
    b.append(cv);
    b.insertAdjacentHTML("beforeend", `<b>${f.name}</b>`);
    b.onclick = () => { S.frame = f.id; pushCfg(); refreshSel(); };
    box.append(b);
  });
}
function refreshSel() {
  document.querySelectorAll("#layouts .card").forEach((b) => b.classList.toggle("sel", b.dataset.id === S.layout));
  document.querySelectorAll("#frames .card").forEach((b) => b.classList.toggle("sel", b.dataset.id === S.frame));
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
    x.font = "bold 28px system-ui, sans-serif";
    x.fillText(caption, W / 2, H - footer / 2 - (date ? 0 : -10));
    if (date) { x.font = "16px system-ui, sans-serif"; x.fillText(new Date().toLocaleDateString("id-ID"), W / 2, H - footer / 2 + 26); }
  }
}

/* ---------- Pemotretan ---------- */
function cover(x, v, dx, dy, dw, dh, mirror) {
  const vw = v.videoWidth || dw, vh = v.videoHeight || dh;
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
  if (!hasRemote()) { cover(x, $("local"), 0, 0, CW, CH, true); return c; }
  const half = CW / 2;
  // kiri = host, kanan = tamu (sama di kedua sisi)
  cover(x, $("local"), S.isHost ? 0 : half, 0, half, CH, true);
  cover(x, $("remote"), S.isHost ? half : 0, 0, half, CH, false);
  return c;
}
async function countdown() {
  const el = $("count");
  el.hidden = false;
  for (let i = 3; i > 0; i--) { el.textContent = i; await wait(1000); }
  el.hidden = true;
}
function drawThumbs(total) {
  const box = $("thumbs");
  box.innerHTML = "";
  for (let i = 0; i < total; i++) {
    const d = document.createElement("div");
    if (S.shots[i]) { const im = new Image(); im.src = S.shots[i].toDataURL("image/jpeg", .7); d.append(im); } else d.textContent = i + 1;
    box.append(d);
  }
}
async function runShoot() {
  if (S.busy) return;
  S.busy = true;
  S.shots = [];
  $("btnShoot").hidden = true;
  const total = need() + EXTRA_SHOTS;
  const prompts = [...PROMPTS].sort(() => Math.random() - .5);
  attachVideos();
  drawThumbs(total);
  for (let i = 0; i < total; i++) {
    $("shootTitle").textContent = `Shot ${i + 1} of ${total}`;
    $("shootSub").textContent = "";
    $("tryText").textContent = "TRY  " + prompts[i % prompts.length];
    await countdown();
    S.shots.push(grab());
    drawThumbs(total);
    await wait(500);
  }
  S.busy = false;
  $("btnShoot").hidden = false;
  $("shootTitle").textContent = "Get ready";
  $("shootSub").textContent = "Pastikan wajah kelihatan, lalu mulai.";
  $("tryText").textContent = "";
  startPick();
}
$("btnShoot").onclick = () => { send({ t: "shoot" }); runShoot(); };

/* ---------- Pilih foto ---------- */
function startPick() {
  S.picked = [];
  $("pickSub").textContent = `Pilih ${need()} foto, urutan sesuai yang kamu klik.`;
  const grid = $("pickGrid");
  grid.innerHTML = "";
  S.shots.forEach((c, i) => {
    const b = document.createElement("button");
    b.innerHTML = `<img src="${c.toDataURL("image/jpeg", .8)}"><em hidden></em>`;
    b.onclick = () => {
      const at = S.picked.indexOf(i);
      if (at >= 0) S.picked.splice(at, 1);
      else if (S.picked.length < need()) S.picked.push(i);
      grid.querySelectorAll("button").forEach((btn, k) => {
        const pos = S.picked.indexOf(k);
        btn.classList.toggle("sel", pos >= 0);
        const em = btn.querySelector("em"); em.hidden = pos < 0; em.textContent = pos + 1;
      });
      $("btnPickNext").disabled = S.picked.length !== need();
    };
    grid.append(b);
  });
  $("btnPickNext").disabled = true;
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
  go("done");
};
$("btnAgain").onclick = () => { S.shots = []; S.picked = []; go("layout"); };

go("home");
