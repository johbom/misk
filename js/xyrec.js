// XY: spela in från mikrofonen (högst 10 s) och spela inspelningen granulärt med fingrarna/musen.
//
// Knappen ● Spela in (spelraden på XY) startar mikrofonen; ett tryck till – eller 10 sekunder – stoppar.
// Mikrofonen stängs direkt efteråt (på iPhone låter annars allt tystare medan den är öppen). Inspelningen
// normaliseras, sparas i webbläsaren (IndexedDB) och XY byter till klangen "Inspelning".
//
// Granulärt: varje pekare spelar korta, överlappande korn (90 ms, ett nytt var 30:e ms) ur inspelningen.
//  X = var i inspelningen kornen tas (vänster = början, höger = slutet)
//  Y = tonhöjd, en oktav ned (nederkant) till en oktav upp (överkant); mitten = som inspelat.
//      Med Skala på hoppar tonhöjden i halvtoner.
// Kornen får lite slumpad plats och stereo, så att ljudet blir levande även när pekaren står still.
// Allt går genom XY:s egen buss (reverben i spelraden).

const XYREC_MAX_S = 10;
const XYREC_DOT = '<circle cx="12" cy="12" r="6.5" fill="#ff5a4e" stroke="none"/>'; // inspelningsknappen: röd prick (klangen Inspelning har mikrofonen)
const GRAIN_S = 0.09; // kornets längd
const GRAIN_EVERY = 0.03; // tid mellan kornen (tre överlappar)
const GRAIN_JITTER = 0.015; // slumpad förskjutning i inspelningen (s)
const GRAIN_LEVEL = 0.55;

const xyRec = { buf: null, recording: false, stream: null, src: null, node: null, chunks: [], timer: 0, tick: 0, started: 0 };
const xyGrains = new Map(); // pointerId -> { nx, ny, next, amp }
let xyGrainTimer = 0;

const xyRecOn = () => xySoundKey() === 'rec';

// ---------- Inspelning ----------
async function xyRecStart() {
  if (xyRec.recording) return;
  if (!navigator.mediaDevices?.getUserMedia) { log(t('Den här webbläsaren kan inte spela in från mikrofonen.')); return; }
  if (!audioCtx) { try { initAudio(); } catch {} }
  if (!audioCtx) return;
  if (audioCtx.state !== 'running') audioCtx.resume();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch {
    log(t('Mikrofonen gick inte att öppna. Tillåt mikrofonen för sidan och försök igen.'));
    return;
  }
  // Ljudtrådens modul (laddas annars först när ett ljud behöver den)
  if (!audioCtx.pmModule) audioCtx.pmModule = audioCtx.audioWorklet.addModule(PM_WORKLET_URL);
  try { await audioCtx.pmModule; } catch { log(t('Mikrofonen gick inte att öppna. Tillåt mikrofonen för sidan och försök igen.')); stream.getTracks().forEach((tr) => tr.stop()); return; }
  xyStopAll();
  xyRec.stream = stream;
  xyRec.chunks = [];
  xyRec.src = audioCtx.createMediaStreamSource(stream);
  xyRec.node = new AudioWorkletNode(audioCtx, 'rec-capture', { numberOfOutputs: 1, outputChannelCount: [1] });
  xyRec.node.port.onmessage = (e) => {
    if (e.data === 'done') { xyRecFinish(); return; }
    xyRec.chunks.push(e.data);
  };
  const mute = audioCtx.createGain();
  mute.gain.value = 0; // (noden måste vara kopplad för att räknas, men ska inte höras)
  xyRec.src.connect(xyRec.node).connect(mute).connect(audioCtx.destination);
  xyRec.mute = mute;
  xyRec.recording = true;
  xyRec.started = performance.now();
  xyRec.timer = setTimeout(xyRecStop, XYREC_MAX_S * 1000);
  xyRec.tick = setInterval(() => { xyRecSync(); xyDraw(); }, 250);
  xyRecSync();
  xyDraw();
  log(t('Spelar in … (högst 10 sekunder, tryck igen för att sluta)'));
}

function xyRecStop() {
  if (!xyRec.recording) return;
  xyRec.recording = false;
  clearTimeout(xyRec.timer);
  clearInterval(xyRec.tick);
  xyRec.node?.port.postMessage('stop'); // sista blocket kommer, sedan 'done'
  xyRec.stream?.getTracks().forEach((tr) => tr.stop()); // stäng mikrofonen direkt
  xyRecSync();
}

function xyRecFinish() {
  try { xyRec.src?.disconnect(); xyRec.node?.disconnect(); xyRec.mute?.disconnect(); } catch {}
  xyRec.src = xyRec.node = xyRec.mute = xyRec.stream = null;
  const n = xyRec.chunks.reduce((a, c) => a + c.length, 0);
  const max = Math.round(XYREC_MAX_S * audioCtx.sampleRate);
  const data = new Float32Array(Math.min(n, max));
  let o = 0;
  for (const c of xyRec.chunks) { if (o >= data.length) break; data.set(c.subarray(0, data.length - o), o); o += c.length; }
  xyRec.chunks = [];
  if (data.length < audioCtx.sampleRate * 0.2) { log(t('Inspelningen blev för kort. Försök igen.')); xyRecSync(); xyDraw(); return; }
  // Normalisera (toppen till 0,9) och tona in/ut 5 ms
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 1e-4) { log(t('Det hördes inget i mikrofonen. Försök igen.')); xyRecSync(); xyDraw(); return; }
  const k = 0.9 / peak;
  const fade = Math.round(audioCtx.sampleRate * 0.005);
  for (let i = 0; i < data.length; i++) {
    const f = Math.min(1, i / fade, (data.length - 1 - i) / fade);
    data[i] *= k * f;
  }
  xyRecSet(data, audioCtx.sampleRate);
  xyRecSave(data, audioCtx.sampleRate);
  // Byt till klangen Inspelning
  if (ui.xySound.value !== 'rec') {
    ui.xySound.value = 'rec';
    ui.xySound.dispatchEvent(new Event('change'));
    if (ui.xySound.segBox) syncSegment(ui.xySound);
  }
  log(t(`Inspelat: ${(data.length / audioCtx.sampleRate).toFixed(1).replace('.', ',')} s. Rör dig över plattan: X = var i inspelningen, Y = tonhöjd.`));
}

function xyRecSet(data, sr) {
  const ctx = audioCtx;
  if (!ctx) { xyRec.pending = { data, sr }; return; } // ljudet är inte startat än: skapas vid första behov
  xyRec.buf = ctx.createBuffer(1, data.length, sr);
  xyRec.buf.copyToChannel(data, 0);
  xyRec.peaks = null; // vågformen ritas om
  xyRecSync();
  xyDraw();
}

// Inspelningen som ljudbuffert (skapas när ljudet startats, om den lästs in från webbläsaren innan dess)
function xyRecBuffer() {
  if (!xyRec.buf && xyRec.pending && audioCtx) { const { data, sr } = xyRec.pending; xyRec.pending = null; xyRecSet(data, sr); }
  return xyRec.buf;
}

// Knappen: ● Spela in / ■ 7 s
function xyRecSync() {
  const b = $('xy-rec');
  if (!b) return;
  b.classList.toggle('recording', xyRec.recording);
  b.setAttribute('aria-pressed', xyRec.recording);
  const left = Math.max(0, Math.ceil(XYREC_MAX_S - (performance.now() - xyRec.started) / 1000));
  b.querySelector('span').textContent = xyRec.recording ? `${left} s` : t('Spela in');
  b.setAttribute('aria-label', xyRec.recording ? t(`Sluta spela in (${left} s kvar)`) : t('Spela in'));
  b.title = t(xyRec.recording ? 'Sluta spela in' : 'Spela in från mikrofonen (högst 10 sekunder) och spela det på plattan');
  // Ikonen: mikrofon, eller en stoppruta medan inspelningen pågår
  const svg = b.querySelector('svg');
  if (svg) svg.innerHTML = xyRec.recording ? '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>' : XYREC_DOT;
}

// ---------- Spara i webbläsaren (IndexedDB) ----------
function xyRecDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hoverPads', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('rec');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function xyRecSave(data, sr) {
  try {
    const db = await xyRecDb();
    db.transaction('rec', 'readwrite').objectStore('rec').put({ sr, data }, 'xy');
  } catch { /* ingen lagring: inspelningen finns kvar tills sidan laddas om */ }
}
async function xyRecLoad() {
  try {
    const db = await xyRecDb();
    const req = db.transaction('rec').objectStore('rec').get('xy');
    req.onsuccess = () => { const v = req.result; if (v?.data?.length) xyRecSet(v.data, v.sr); };
  } catch { /* ingen sparad inspelning */ }
}

// ---------- Granulär uppspelning ----------
function xyGrainStart(id, nx, ny) {
  const buf = xyRecBuffer();
  if (!buf) { log(t('Spela in något först med ● Spela in.')); return; }
  const ctx = audioCtx;
  engines.notes.wake();
  const amp = ctx.createGain();
  amp.gain.value = 0;
  amp.gain.setTargetAtTime(1, ctx.currentTime, 0.01);
  amp.connect(xyBus());
  const holder = { released: 0, kill() {} }; // motorn somnar inte medan pekaren spelar
  engines.notes.voices.add(holder);
  xyGrains.set(id, { nx, ny, next: ctx.currentTime + NOTE_LOOKAHEAD, amp, holder });
  if (!xyGrainTimer) xyGrainTimer = setInterval(xyGrainTick, 20);
  xyGrainTick();
}

function xyGrainMove(id, nx, ny) {
  const v = xyGrains.get(id);
  if (v) { v.nx = nx; v.ny = ny; }
}

function xyGrainStop(id) {
  const v = xyGrains.get(id);
  if (!v) return;
  xyGrains.delete(id);
  engines.notes.voices.delete(v.holder);
  const now = audioCtx.currentTime;
  v.amp.gain.cancelScheduledValues(now);
  v.amp.gain.setTargetAtTime(0, now, 0.02);
  setTimeout(() => { try { v.amp.disconnect(); } catch {} }, (GRAIN_S + 0.3) * 1000);
  if (!xyGrains.size) { clearInterval(xyGrainTimer); xyGrainTimer = 0; }
}

const xyGrainStopAll = () => [...xyGrains.keys()].forEach(xyGrainStop);

// Halvtoner från Y: −12 (nederkant) … +12 (överkant); med Skala på i hela halvtoner
function xyGrainSemis(ny) {
  const s = (ny - 0.5) * 24;
  return xyQuantOn() ? Math.round(s) : s;
}

function xyGrainTick() {
  const ctx = audioCtx;
  const buf = xyRec.buf;
  if (!ctx || !buf) return;
  const now = ctx.currentTime;
  for (const v of xyGrains.values()) {
    if (v.next < now) v.next = now + 0.005; // (efter en paus i webbläsaren: börja om nu)
    while (v.next < now + 0.08) {
      const rate = Math.pow(2, xyGrainSemis(v.ny) / 12);
      const len = GRAIN_S * rate; // så mycket av inspelningen kornet läser
      const pos = Math.max(0, Math.min(buf.duration - len, v.nx * buf.duration - len / 2 + (Math.random() * 2 - 1) * GRAIN_JITTER));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const env = ctx.createGain();
      const t0 = v.next;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(GRAIN_LEVEL, t0 + GRAIN_S / 2);
      env.gain.linearRampToValueAtTime(0, t0 + GRAIN_S);
      let out = env;
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = (Math.random() * 2 - 1) * 0.35;
        env.connect(pan);
        out = pan;
      }
      src.connect(env);
      out.connect(v.amp);
      src.start(t0, pos, len);
      src.onended = () => { try { out.disconnect(); env.disconnect(); } catch {} };
      v.next += GRAIN_EVERY;
    }
  }
}

// ---------- Plattan: vågformen ----------
function xyDrawRec(g, W, H, hc) {
  g.font = '13px system-ui, sans-serif';
  g.textAlign = 'center';
  if (xyRec.recording) {
    const s = ((performance.now() - xyRec.started) / 1000).toFixed(1).replace('.', ',');
    g.fillStyle = hc ? '#fff' : 'rgba(255,120,120,0.9)';
    g.fillText(t(`Spelar in … ${s} s`), W / 2, H / 2);
    return;
  }
  const buf = xyRecBuffer();
  if (!buf) {
    g.fillStyle = hc ? '#fff' : 'rgba(170,175,200,0.75)';
    g.fillText(t('Spela in något med ● Spela in (högst 10 sekunder).'), W / 2, H / 2);
    return;
  }
  // Toppar per pixelkolumn (räknas om när storleken ändras)
  const cols = Math.max(1, Math.round(W));
  if (!xyRec.peaks || xyRec.peaks.length !== cols) {
    const d = buf.getChannelData(0);
    const per = d.length / cols;
    xyRec.peaks = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      let m = 0;
      const a = Math.floor(c * per);
      const b = Math.min(d.length, Math.floor((c + 1) * per));
      for (let i = a; i < b; i++) m = Math.max(m, Math.abs(d[i]));
      xyRec.peaks[c] = m;
    }
  }
  const mid = H / 2;
  g.fillStyle = hc ? '#888' : 'rgba(120,140,230,0.35)';
  for (let c = 0; c < cols; c++) {
    const h = Math.max(1, xyRec.peaks[c] * (H * 0.42));
    g.fillRect(c, mid - h, 1, h * 2);
  }
  // Mittlinjen = tonhöjd som inspelat; tidslinjer varje sekund
  g.strokeStyle = hc ? '#fff' : 'rgba(170,185,255,0.55)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, mid); g.lineTo(W, mid); g.stroke();
  g.fillStyle = hc ? '#fff' : 'rgba(170,185,255,0.75)';
  for (let s = 0; s <= buf.duration; s++) {
    const x = (s / buf.duration) * W;
    g.fillText(`${s} s`, Math.min(W - 14, Math.max(14, x)), H - 8);
  }
  g.save();
  g.translate(14, H / 2);
  g.rotate(-Math.PI / 2);
  g.fillText(t('Högre ton  →'), H / 4, 0);
  g.restore();
}

function setupXyRec() {
  const b = $('xy-rec');
  b.addEventListener('click', () => (xyRec.recording ? xyRecStop() : xyRecStart()));
  ui.xySound.addEventListener('change', () => {
    xyStopAll();
    if (xyRecOn() && !xyRec.buf && !xyRec.pending) log(t('Spela in något först med ● Spela in.'));
  });
  xyRecSync();
  xyRecLoad();
}
