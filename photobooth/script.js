const $ = (id) => document.getElementById(id);
const SHOTS = 3, PREFIX = "ldrbooth-";

let stream, peer, conn, isHost = false, busy = false;

const setStatus = (t) => ($("status").textContent = t);

$("btnStart").onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
  } catch (e) {
    alert("Kamera tidak bisa diakses. Izinkan akses kamera dan buka lewat HTTPS.");
    return;
  }
  $("local").srcObject = stream;
  $("btnStart").hidden = true;
  $("connect").hidden = false;
  $("stage").hidden = false;
};

function newCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

$("btnCreate").onclick = () => {
  isHost = true;
  const code = newCode();
  peer = new Peer(PREFIX + code);
  setStatus("Membuat room...");
  peer.on("open", () => setStatus(`Kode room: ${code} — kirim ke pasanganmu, lalu tunggu dia join.`));
  peer.on("error", (e) => setStatus("Error: " + e.type + (e.type === "unavailable-id" ? " (coba lagi)" : "")));
  peer.on("call", (call) => { call.answer(stream); call.on("stream", showRemote); });
  peer.on("connection", setupConn);
};

$("btnJoin").onclick = () => {
  const code = $("joinCode").value.trim().toUpperCase();
  if (!code) return setStatus("Masukkan kode room dulu.");
  isHost = false;
  peer = new Peer();
  setStatus("Menyambung...");
  peer.on("error", (e) => setStatus("Gagal join: " + e.type));
  peer.on("open", () => {
    setupConn(peer.connect(PREFIX + code));
    const call = peer.call(PREFIX + code, stream);
    call.on("stream", showRemote);
  });
};

function setupConn(c) {
  conn = c;
  conn.on("open", () => setStatus("Terhubung ✅"));
  conn.on("data", (msg) => { if (msg === "snap") runSession(); });
  conn.on("close", () => { setStatus("Pasangan terputus."); $("remoteBox").hidden = true; });
}

function showRemote(rs) {
  $("remote").srcObject = rs;
  $("remoteBox").hidden = false;
  setStatus("Terhubung ✅");
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function countdown() {
  const el = $("count");
  el.hidden = false;
  for (let i = 3; i > 0; i--) { el.textContent = i; await wait(1000); }
  el.hidden = true;
}

// Frame 4:3 per orang; kiri = host, kanan = tamu.
function grab(local, remote, W, H) {
  const c = document.createElement("canvas");
  const paired = remote;
  c.width = paired ? W * 2 : W;
  c.height = H;
  const ctx = c.getContext("2d");
  const draw = (v, x, mirror) => {
    ctx.save();
    ctx.translate(x + (mirror ? W : 0), 0);
    if (mirror) ctx.scale(-1, 1);
    const vw = v.videoWidth || W, vh = v.videoHeight || H;
    const s = Math.max(W / vw, H / vh);
    ctx.drawImage(v, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
    ctx.restore();
  };
  const slotLocal = isHost || !paired ? 0 : W;
  const slotRemote = isHost ? W : 0;
  draw(local, slotLocal, true);
  if (paired) draw(remote, slotRemote, false);
  return c;
}

async function runSession() {
  if (busy) return;
  busy = true;
  $("btnSnap").disabled = true;
  $("result").hidden = true;
  const shots = [];
  const hasRemote = !$("remoteBox").hidden;
  for (let i = 0; i < SHOTS; i++) {
    await countdown();
    shots.push(grab($("local"), hasRemote ? $("remote") : null, 480, 360));
    await wait(300);
  }
  compose(shots);
  $("btnSnap").disabled = false;
  busy = false;
}

function compose(shots) {
  const pad = 24, gap = 16, cap = 70;
  const w = shots[0].width, h = shots[0].height;
  const c = $("strip");
  c.width = w + pad * 2;
  c.height = pad + shots.length * (h + gap) + cap;
  const ctx = c.getContext("2d");
  ctx.fillStyle = $("frameColor").value;
  ctx.fillRect(0, 0, c.width, c.height);
  shots.forEach((s, i) => ctx.drawImage(s, pad, pad + i * (h + gap)));
  ctx.fillStyle = "#3a2a30";
  ctx.textAlign = "center";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillText($("caption").value || "LDR Photobooth", c.width / 2, c.height - 36);
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleDateString("id-ID"), c.width / 2, c.height - 12);
  $("btnDownload").href = c.toDataURL("image/png");
  $("result").hidden = false;
  $("result").scrollIntoView({ behavior: "smooth" });
}

$("btnSnap").onclick = () => {
  if (conn && conn.open) conn.send("snap");
  runSession();
};
$("btnAgain").onclick = () => { $("result").hidden = true; window.scrollTo({ top: 0, behavior: "smooth" }); };
