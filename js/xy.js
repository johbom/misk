// XY-platta: varje muspekare och varje finger är en egen oscillator.
//   X = tonhöjd, steglöst frekvensglissando (exponentiellt, så att varje oktav är lika bred)
//   Y = highcut (lågpassfilter) som öppnar uppåt: längst ned dovt, längst upp helt öppet
// Musen låter så länge den är över ytan (som resten av appen), fingrar så länge de rör skärmen.
// Varje pekare ritar ett glödande spår som bleknar bort.

const XY_TRAIL_MS = 1400; // hur länge spåret syns
const XY_CUT_MIN = 150; // Hz längst ned (dovt)
const XY_CUT_MAX = 16000; // Hz längst upp (öppet)
const XY_LEVEL = 0.2;

const xy = {
  el: null,
  canvas: null,
  g: null,
  dpr: 1,
  w: 0,
  h: 0,
  voices: new Map(), // pointerId -> röst
  present: new Set(), // pekare som just nu är på ytan (mus över, finger nere)
  trails: new Map(), // pointerId -> { color, pts: [{ x, y, t }] }
  colorIdx: 0,
  frame: 0,
};

// ---------- Tonhöjd och filter ----------
// Lägsta frekvens = grundtonen och oktaven från sidan Toner; omfånget väljs under Spel.
function xyLowHz() {
  const midi = 12 * (Number(ui.octave.value) + 1) + Number(ui.root.value) - 12; // en oktav under Toner-sidan
  return 440 * Math.pow(2, (midi - 69) / 12);
}
const xyOctaves = () => Number(ui.xyOctaves.value) || 3;
const xyFreq = (nx) => xyLowHz() * Math.pow(2, nx * xyOctaves()); // nx 0..1, vänster..höger
const xyCut = (ny) => XY_CUT_MIN * Math.pow(XY_CUT_MAX / XY_CUT_MIN, ny); // ny 0..1, nederkant..överkant

// ---------- Ljud: en röst per pekare ----------
function xyVoiceStart(id, nx, ny) {
  if (!audioCtx || !engine || !ui.outAudio.checked) return;
  const ctx = audioCtx;
  const p = engine.p;
  const t = ctx.currentTime + NOTE_LOOKAHEAD;
  // Vågformen från ljudmotorn (fysiska modeller har ingen glidande oscillator – då sågtand)
  const wave = p.model && p.model !== 'osc' ? 'sawtooth' : p.osc1Wave;
  const osc = engine.makeOsc(wave, xyFreq(nx));
  const hp = ctx.createBiquadFilter();
  hp.type = 'lowpass'; // highcut
  hp.Q.value = 1.2; // lite karaktär när filtret sveper
  hp.frequency.value = xyCut(ny);
  const amp = ctx.createGain();
  const attack = Math.min(0.5, Math.max(0.01, p.attack));
  amp.gain.value = 0;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(XY_LEVEL, t + attack);
  // Vibrato (vickning) på XY-rösterna också
  const vib = ctx.createGain();
  vib.gain.value = 0;
  engine.vibLfo.connect(vib).connect(osc.detune);
  osc.connect(hp).connect(amp).connect(engine.input);
  osc.start(t);
  xy.voices.set(id, { osc, hp, amp, vib, t, attack });
  oscSend('xy', xyOscId(id), { f: nx }, { f: ny }, 1);
}

function xyVoiceMove(id, nx, ny) {
  const v = xy.voices.get(id);
  if (!v) return;
  const now = audioCtx.currentTime;
  // Kort glidtid: följer pekaren mjukt utan trappsteg mellan mushändelserna
  v.osc.frequency.setTargetAtTime(xyFreq(nx), now, 0.012);
  v.hp.frequency.setTargetAtTime(xyCut(ny), now, 0.02);
  oscSend('xy', xyOscId(id), { f: nx }, { f: ny }, 1);
}

function xyVoiceStop(id) {
  const v = xy.voices.get(id);
  if (!v) return;
  xy.voices.delete(id);
  const ctx = audioCtx;
  const rel = Math.min(3, Math.max(0.03, engine.p.release));
  // Aldrig före rösten börjat (den ligger en aning framåt)
  const r = Math.max(ctx.currentTime + NOTE_LOOKAHEAD, v.t + 0.005);
  if (v.amp.gain.cancelAndHoldAtTime) v.amp.gain.cancelAndHoldAtTime(r);
  else {
    v.amp.gain.cancelScheduledValues(r);
    const level = r - v.t < v.attack ? (XY_LEVEL * (r - v.t)) / v.attack : XY_LEVEL;
    v.amp.gain.linearRampToValueAtTime(level, r);
  }
  v.amp.gain.setTargetAtTime(0, r, rel / 4);
  const end = r + (rel / 4) * 9 + 0.05;
  v.osc.stop(end);
  v.osc.onended = () => {
    v.amp.disconnect();
    try { engine.vibLfo.disconnect(v.vib); } catch {}
  };
  oscSend('xy', xyOscId(id), { f: 0 }, { f: 0 }, 0);
}

const xyStopAll = () => { [...xy.voices.keys()].forEach(xyVoiceStop); xy.present.clear(); };
const xyOscId = (id) => (id > 1e6 ? id % 1000 : id); // korta id:n i OSC

// ---------- Pekare ----------
function xyPos(e) {
  const r = xy.el.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  return { x, y, nx: x, ny: 1 - y }; // ny: 0 längst ned
}

function xyTrail(id, x, y) {
  let tr = xy.trails.get(id);
  if (!tr) {
    tr = { color: CHORD_PALETTE[xy.colorIdx++ % CHORD_PALETTE.length], pts: [] };
    xy.trails.set(id, tr);
  }
  tr.pts.push({ x, y, t: performance.now() });
  xyLoop();
}

function setupXY() {
  xy.el = $('xy-pad');
  xy.canvas = $('xy-canvas');
  xy.g = xy.canvas.getContext('2d');

  // Mus (och penna som svävar): låter så länge den är över ytan
  xy.el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    xy.present.add(e.pointerId);
    const p = xyPos(e);
    xyVoiceStart(e.pointerId, p.nx, p.ny);
    xyTrail(e.pointerId, p.x, p.y);
  });
  xy.el.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    xy.present.delete(e.pointerId);
    xyVoiceStop(e.pointerId);
    const tr = xy.trails.get(e.pointerId);
    if (tr) { xy.trails.delete(e.pointerId); xy.trails.set(`${e.pointerId}-${performance.now()}`, tr); } // spåret bleknar för sig
  });
  // Fingrar: var och en är en egen röst så länge den rör skärmen
  xy.el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    xy.present.add(e.pointerId);
    const p = xyPos(e);
    xyVoiceStart(e.pointerId, p.nx, p.ny);
    xyTrail(e.pointerId, p.x, p.y);
  });
  // Rörelser följs i hela dokumentet: ett finger som glider utanför ytan stannar vid kanten
  document.addEventListener('pointermove', (e) => {
    if (document.body.dataset.tab !== 'xy') return;
    if (!xy.present.has(e.pointerId)) return;
    const p = xyPos(e);
    xyVoiceMove(e.pointerId, p.nx, p.ny);
    xyTrail(e.pointerId, p.x, p.y);
  });
  const lift = (e) => {
    if (e.pointerType !== 'touch' || !xy.present.has(e.pointerId)) return;
    xy.present.delete(e.pointerId);
    xyVoiceStop(e.pointerId);
    const tr = xy.trails.get(e.pointerId);
    if (tr) { xy.trails.delete(e.pointerId); xy.trails.set(`${e.pointerId}-${performance.now()}`, tr); }
  };
  document.addEventListener('pointerup', lift);
  document.addEventListener('pointercancel', lift);
  window.addEventListener('blur', xyStopAll);

  new ResizeObserver(xyResize).observe(xy.el);
  [ui.xyOctaves, ui.root, ui.octave].forEach((el) => el.addEventListener('change', xyDraw));
}

// Anropas när fliken byts
function xyShow(on) {
  if (!on) { xyStopAll(); return; }
  xyResize();
}

// ---------- Ritning ----------
function xyResize() {
  if (!xy.el || document.body.dataset.tab !== 'xy') return;
  if (!FIXED_SCREEN) {
    // Fyll höjden ned till sidfoten
    const top = xy.el.getBoundingClientRect().top + window.scrollY;
    const footer = document.querySelector('footer').offsetHeight;
    xy.el.style.height = `${Math.max(300, window.innerHeight - top - footer - 16)}px`;
  }
  const r = xy.el.getBoundingClientRect();
  xy.dpr = Math.min(2, window.devicePixelRatio || 1);
  xy.w = r.width;
  xy.h = r.height;
  xy.canvas.width = Math.round(r.width * xy.dpr);
  xy.canvas.height = Math.round(r.height * xy.dpr);
  xyDraw();
}

function xyLoop() {
  if (!xy.frame) xy.frame = requestAnimationFrame(() => { xy.frame = 0; xyDraw(); });
}

// Bakgrund: svaga linjer för skalans toner (bara orientering – tonhöjden glider steglöst)
function xyDrawGrid(g, W, H, hc) {
  const low = xyLowHz();
  const octs = xyOctaves();
  const lowMidi = 69 + 12 * Math.log2(low / 440);
  const scale = SCALES[ui.scale.value] || SCALES.major;
  const root = Number(ui.root.value);
  g.font = `${11}px system-ui, sans-serif`;
  g.textAlign = 'center';
  for (let m = Math.ceil(lowMidi); m <= lowMidi + 12 * octs + 0.001; m++) {
    const pc = ((m - root) % 12 + 12) % 12;
    if (!scale.includes(pc)) continue;
    const x = ((m - lowMidi) / (12 * octs)) * W;
    const isRoot = pc === 0;
    g.strokeStyle = hc ? (isRoot ? '#fff' : '#777') : isRoot ? 'rgba(140,160,255,0.38)' : 'rgba(140,150,190,0.12)';
    g.lineWidth = isRoot ? 1.5 : 1;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, H);
    g.stroke();
    if (isRoot) {
      g.fillStyle = hc ? '#fff' : 'rgba(170,185,255,0.75)';
      g.fillText(noteName(m), Math.min(W - 14, Math.max(14, x)), H - 8);
    }
  }
  // Y-axelns rubrik
  g.save();
  g.translate(14, H / 2);
  g.rotate(-Math.PI / 2);
  g.fillStyle = hc ? '#fff' : 'rgba(170,175,200,0.55)';
  g.fillText('Filter öppnas  →', 0, 0);
  g.restore();
}

function xyDraw() {
  const { g, dpr } = xy;
  if (!g || !xy.w) return;
  const W = xy.w;
  const H = xy.h;
  const hc = ui.highContrast.checked;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  xyDrawGrid(g, W, H, hc);

  // Spåren: glöder (adderas ljust på ljust) och bleknar med åldern
  const now = performance.now();
  const life = ui.reduceMotion.checked ? XY_TRAIL_MS / 2 : XY_TRAIL_MS;
  g.globalCompositeOperation = hc ? 'source-over' : 'lighter';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  let alive = false;
  for (const [id, tr] of xy.trails) {
    tr.pts = tr.pts.filter((pt) => now - pt.t < life);
    if (!tr.pts.length) { xy.trails.delete(id); continue; }
    alive = true;
    const pts = tr.pts;
    // Bredare, svagare glöd underst – smal, ljus kärna överst
    for (const [width, glow, alphaMul] of [[18, 24, 0.22], [7, 12, 0.55], [2.5, 0, 1]]) {
      g.shadowBlur = hc ? 0 : glow;
      g.shadowColor = tr.color;
      for (let i = 1; i < pts.length; i++) {
        const a = 1 - (now - pts[i].t) / life;
        if (a <= 0) continue;
        g.strokeStyle = hc ? '#ffd400' : tr.color;
        g.globalAlpha = Math.max(0, a) * alphaMul;
        g.lineWidth = width * (0.35 + 0.65 * a);
        g.beginPath();
        g.moveTo(pts[i - 1].x * W, pts[i - 1].y * H);
        g.lineTo(pts[i].x * W, pts[i].y * H);
        g.stroke();
      }
    }
    // Pekarens punkt (så länge den låter)
    if (xy.voices.has(id)) {
      const last = pts[pts.length - 1];
      g.globalAlpha = 1;
      g.shadowBlur = hc ? 0 : 30;
      g.fillStyle = hc ? '#ffd400' : '#fff';
      g.beginPath();
      g.arc(last.x * W, last.y * H, 7, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.shadowBlur = 0;
  // Fortsätt rita medan något bleknar
  if (alive) xyLoop();
}
