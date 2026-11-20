// XY: spela in från mikrofonen (högst 10 s) och spela inspelningen granulärt med fingrarna/musen.
//
// Knappen ● Spela in (spelraden på XY) startar mikrofonen; ett tryck till – eller 10 sekunder – stoppar.
// Själva inspelningen sköts av js/micrec.js (tystnaden i början och slutet klipps bort, normaliseras).
// Den sparas i webbläsaren (IndexedDB) och XY byter till klangen "Inspelning".
//
// Granulärt: varje pekare spelar korta, överlappande korn (90 ms, ett nytt var 30:e ms) ur inspelningen.
// Kornen räknas i ljudtråden (rec-grain i js/pm-worklet.js: mjuka fönster och exakt tid, inget knaster);
// finns ingen ljudtråd görs de med vanliga ljudnoder.
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

const xyRec = { buf: null, pending: null, peaks: null, id: 0, sentId: -1, sentCtx: null, worklet: null };
const xyGrains = new Map(); // pointerId -> { nx, ny, next, amp }
let xyGrainTimer = 0;

const xyRecOn = () => xySoundKey() === 'rec';
const xyRecording = () => micActive() && mic.onDone === xyRecDone;

// ---------- Inspelning (js/micrec.js: mikrofonen, tystnaden klipps bort) ----------
async function xyRecStart() {
  if (micActive()) return;
  xyStopAll();
  const ok = await micStart({ max: XYREC_MAX_S, onDone: xyRecDone, onTick: () => { xyRecSync(); xyDraw(); } });
  if (!ok) return;
  xyRecSync();
  xyDraw();
  log(t('Spelar in … (högst 10 sekunder, tryck igen för att sluta)'));
}

function xyRecStop() { if (xyRecording()) micStop(); }

function xyRecDone(data, sr, err) {
  xyRecSync();
  if (!data) { log(err); xyDraw(); return; }
  xyRecSet(data, sr);
  micSave('xy', { sr, data });
  // Byt till klangen Inspelning
  if (ui.xySound.value !== 'rec') {
    ui.xySound.value = 'rec';
    ui.xySound.dispatchEvent(new Event('change'));
    if (ui.xySound.segBox) syncSegment(ui.xySound);
  }
  log(t(`Inspelat: ${(data.length / sr).toFixed(1).replace('.', ',')} s. Rör dig över plattan: X = var i inspelningen, Y = tonhöjd.`));
}

function xyRecSet(data, sr) {
  const ctx = audioCtx;
  if (!ctx) { xyRec.pending = { data, sr }; return; } // ljudet är inte startat än: skapas vid första behov
  xyRec.buf = ctx.createBuffer(1, data.length, sr);
  xyRec.buf.copyToChannel(data, 0);
  xyRec.id++; // (ny inspelning: skickas till ljudtråden nästa gång)
  xyRec.peaks = null; // vågformen ritas om
  xyGrainPrepare();
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
  const rec = xyRecording();
  b.classList.toggle('recording', rec);
  b.setAttribute('aria-pressed', rec);
  const left = micLeft();
  b.querySelector('span').textContent = rec ? `${left} s` : t('Spela in');
  b.setAttribute('aria-label', rec ? t(`Sluta spela in (${left} s kvar)`) : t('Spela in'));
  b.title = t(rec ? 'Sluta spela in' : 'Spela in från mikrofonen (högst 10 sekunder) och spela det på plattan');
  // Ikonen: mikrofon, eller en stoppruta medan inspelningen pågår
  const svg = b.querySelector('svg');
  if (svg) svg.innerHTML = rec ? '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>' : XYREC_DOT;
}

async function xyRecLoad() {
  const v = await micLoad('xy');
  if (v?.data?.length) xyRecSet(v.data, v.sr);
}

// ---------- Granulär uppspelning ----------
// Ljudtrådens modul laddas när det finns en inspelning (så att första kornet kommer direkt)
function xyGrainPrepare() {
  const ctx = audioCtx;
  if (!ctx?.audioWorklet || typeof AudioWorkletNode !== 'function' || xyRec.worklet === ctx) return;
  if (!ctx.pmModule) ctx.pmModule = ctx.audioWorklet.addModule(PM_WORKLET_URL);
  ctx.pmModule.then(() => { xyRec.worklet = ctx; }, () => {});
}

function xyGrainStart(id, nx, ny) {
  const buf = xyRecBuffer();
  if (!buf) { log(t('Spela in något först med ● Spela in.')); return; }
  const ctx = audioCtx;
  engines.xy.wake();
  const holder = { released: 0, kill() {} }; // motorn somnar inte medan pekaren spelar
  engines.xy.voices.add(holder);
  if (xyRec.worklet === ctx) {
    // I ljudtråden: inspelningen skickas bara första gången (sedan delar noderna på den)
    const send = xyRec.sentId !== xyRec.id || xyRec.sentCtx !== ctx;
    try {
      const node = new AudioWorkletNode(ctx, 'rec-grain', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: {
          id: xyRec.id, data: send ? buf.getChannelData(0) : null, sr: buf.sampleRate,
          grain: GRAIN_S, every: GRAIN_EVERY, jitter: GRAIN_JITTER, level: GRAIN_LEVEL, pan: 0.35,
          nx, semis: xyGrainSemis(ny),
        },
      });
      xyRec.sentId = xyRec.id;
      xyRec.sentCtx = ctx;
      node.connect(xyBus());
      xyGrains.set(id, { nx, ny, node, holder });
      return;
    } catch { /* reserv nedan */ }
  }
  xyGrainPrepare();
  const amp = ctx.createGain();
  amp.gain.value = 0;
  amp.gain.setTargetAtTime(1, ctx.currentTime, 0.01);
  amp.connect(xyBus());
  xyGrains.set(id, { nx, ny, next: ctx.currentTime + NOTE_LOOKAHEAD, amp, holder });
  if (!xyGrainTimer) xyGrainTimer = setInterval(xyGrainTick, 20);
  xyGrainTick();
}

function xyGrainMove(id, nx, ny) {
  const v = xyGrains.get(id);
  if (!v) return;
  v.nx = nx;
  v.ny = ny;
  v.node?.port.postMessage({ nx, semis: xyGrainSemis(ny) });
}

function xyGrainStop(id) {
  const v = xyGrains.get(id);
  if (!v) return;
  xyGrains.delete(id);
  engines.xy.voices.delete(v.holder);
  if (v.node) {
    v.node.port.postMessage({ stop: true }); // tonas ut i ljudtråden, sedan är noden klar
    setTimeout(() => { try { v.node.disconnect(); } catch {} }, 400);
    return;
  }
  const now = audioCtx.currentTime;
  v.amp.gain.cancelScheduledValues(now);
  v.amp.gain.setTargetAtTime(0, now, 0.02);
  setTimeout(() => { try { v.amp.disconnect(); } catch {} }, (GRAIN_S + 0.3) * 1000);
  if (![...xyGrains.values()].some((g) => g.amp)) { clearInterval(xyGrainTimer); xyGrainTimer = 0; }
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
    if (v.node) continue; // (räknas i ljudtråden)
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
  if (xyRecording()) {
    const s = ((performance.now() - mic.started) / 1000).toFixed(1).replace('.', ',');
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
  b.addEventListener('click', () => (xyRecording() ? xyRecStop() : xyRecStart()));
  ui.xySound.addEventListener('change', () => {
    xyStopAll();
    if (xyRecOn() && !xyRec.buf && !xyRec.pending) log(t('Spela in något först med ● Spela in.'));
    if (xyRecOn() && audioCtx) { xyRecBuffer(); xyGrainPrepare(); }
  });
  xyRecSync();
  xyRecLoad();
}
