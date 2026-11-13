// XY-platta: varje muspekare och varje finger är en egen oscillator.
//   X = tonhöjd, steglöst frekvensglissando (exponentiellt, så att varje oktav är lika bred)
//   Y = highcut (lågpassfilter) som öppnar uppåt: längst ned dovt, längst upp helt öppet.
//       Sinus har inga övertoner att filtrera, så där styr Y i stället vibrato: inget längst ned,
//       djupt och lite snabbare längst upp.
//       Klanger med få övertoner (Sinus, Triangel, Varm) får dessutom FM på Y: längst ned ren,
//       uppåt allt fler övertoner, så att Y hörs tydligt även på dem.
// Musen låter så länge den är över ytan (som resten av appen), fingrar så länge de rör skärmen.
// Varje pekare ritar ett glödande spår som bleknar bort.

const XY_TRAIL_MS = 1400; // hur länge spåret syns
// Filtret följer tonhöjden: längst ned ligger brytfrekvensen vid grundtonen (bara den hörs, dovt),
// längst upp XY_CUT_OCTAVES oktaver över (alla övertoner, öppet). Då blir skillnaden lika tydlig i
// hela registret, och ingen ton försvinner helt längst ned.
const XY_CUT_OCTAVES = 7;
const XY_CUT_MAX = 18000; // Hz
const XY_LEVEL = 0.2;
const XY_RELEASE = 0.04; // s: tonen tystnar direkt när fingret släpper (reverb och delay klingar ut ändå)

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
  pulses: [], // arpeggiots steg: ringar som växer och bleknar
  colorIdx: 0,
  frame: 0,
};

// ---------- Tonhöjd och filter ----------
// Högerkanten är alltid C7; omfånget (oktaver, under Instrument) räknas nedåt därifrån.
const XY_TOP_MIDI = 96; // C7
const xyOctaves = () => Number(ui.xyOctaves.value) || 5; // 5 = C2–C7
const xyLowHz = () => 440 * Math.pow(2, (XY_TOP_MIDI - 12 * xyOctaves() - 69) / 12);
// nx 0..1, vänster..höger. Steglöst – eller, med Skala (kvantisera) på, närmaste ton i tonarten.
const xyFreq = (nx) => {
  const f = xyLowHz() * Math.pow(2, nx * xyOctaves());
  if (!xyQuantOn()) return f;
  return 440 * Math.pow(2, (xyQuantMidi(69 + 12 * Math.log2(f / 440)) - 69) / 12);
};
// Kvantisera: XY håller sig i tonarten (grundton och skala, samma som på Toner)
const xyQuantOn = () => ui.xyQuantize.checked;
function xyQuantMidi(m) {
  const scale = SCALES[ui.scale.value] || SCALES.major;
  const root = Number(ui.root.value);
  let best = Math.round(m);
  let dist = Infinity;
  // Största glappet i skalorna är 3 halvtoner, så närmaste skalton ligger inom ±2
  for (let c = Math.floor(m) - 2; c <= Math.ceil(m) + 2; c++) {
    if (!scale.includes(((c - root) % 12 + 12) % 12)) continue;
    const d = Math.abs(c - m);
    if (d < dist) { dist = d; best = c; }
  }
  return best;
}
const xyCut = (ny, freq) => Math.min(XY_CUT_MAX, freq * Math.pow(2, ny * XY_CUT_OCTAVES)); // ny 0..1, nederkant..överkant
// Vibrato på Y (sinus): djup i cent och takt i Hz. Kurvan gör nedre delen nästan rak.
const XY_VIB_MAX = 55;
const xyVibDepth = (ny) => XY_VIB_MAX * Math.pow(ny, 1.6);
const xyVibRate = (ny) => 4 + 3 * ny;
// FM-djup (frekvenssvängning i Hz) för höjden ny: ingenting längst ned, kurva som gör toppen tydligast
const xyFmDev = (fm, ny, freq) => fm.index * Math.pow(ny, 1.4) * fm.ratio * freq;
// Vald klang – aldrig tom: ett okänt eller saknat värde (gammal inställning, preset) blir Sinus
const xySoundKey = () => (ui.xySound.value in XY_SOUNDS ? ui.xySound.value : 'sine');
const xyYIsVibrato = () => XY_SOUNDS[xySoundKey()].y === 'vibrato';

// ---------- Ljud: en röst per pekare ----------
// XY har egen klang och egen reverb, oberoende av rutornas ljud. Nivåerna är utjämnade så att
// alla klanger låter ungefär lika starkt.
const XY_SOUNDS = {
  // Uppmätta: övertonsrika klanger låter starkare per energi, så de ligger lite lägre än sinus
  // fm: Y styr FM-djupet (ratio = modulatorns frekvens / tonens, index = djup längst upp)
  sine: { level: 0.85, y: 'vibrato', fm: { ratio: 1, index: 3.5 } }, // vibrato + FM (filter hörs inte på en sinus)
  triangle: { level: 0.95, fm: { ratio: 2, index: 2.5 } }, // ihålig -> ljus
  warm: { level: 0.85, fm: { ratio: 1, index: 3 } },
  sawtooth: { level: 1.05 },
  square: { level: 0.75 },
  supersaw: { level: 2.2, detunes: [-18, -9, 0, 9, 18], wave: 'sawtooth' }, // bred, i stereo
};

// Egen buss: torrt + egen reverb, direkt till volymen (efter rutornas effekter)
function xyBus() {
  if (xy.bus && xy.busCtx === audioCtx) return xy.bus;
  const ctx = audioCtx;
  xy.busCtx = ctx;
  xy.bus = ctx.createGain();
  xy.send = ctx.createGain();
  xy.send.gain.value = Number(ui.xyReverb.value);
  const rev = ctx.createConvolver();
  rev.buffer = engines.notes.makeImpulse(2.8);
  xy.bus.connect(engines.notes.volume);
  xy.bus.connect(xy.send).connect(rev).connect(engines.notes.volume);
  return xy.bus;
}

// En röst: XY:s klang -> highcut -> volym. ny = höjd på ytan (filter eller vibrato).
// when = ljudklockans starttid (arpeggiatorn planerar i förväg).
function xyMakeVoice(freq, ny, when = 0) {
  const ctx = audioCtx;
  const t = Math.max(ctx.currentTime + NOTE_LOOKAHEAD, when);
  const key = xySoundKey();
  const snd = XY_SOUNDS[key];
  const yVib = snd.y === 'vibrato';
  const cut = yVib ? XY_CUT_MAX : xyCut(ny, freq);
  const mix = ctx.createGain();
  const oscs = (snd.detunes || [0]).map((cents, i, all) => {
    const o = engines.notes.makeOsc(snd.wave || key, freq);
    o.detune.value = cents;
    if (all.length > 1) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = (i / (all.length - 1)) * 1.4 - 0.7;
      o.connect(pan).connect(mix);
    } else o.connect(mix);
    return o;
  });
  mix.gain.value = snd.level / Math.sqrt(oscs.length);
  // Highcut i två steg (24 dB/oktav) med lite resonans: tydlig skillnad mellan dovt och öppet,
  // och ett hörbart svep när fingret rör sig upp och ned
  const hp = ctx.createBiquadFilter();
  hp.type = 'lowpass';
  hp.Q.value = 2;
  hp.frequency.value = cut;
  const hp2 = ctx.createBiquadFilter();
  hp2.type = 'lowpass';
  hp2.Q.value = 0.7;
  hp2.frequency.value = cut;
  const amp = ctx.createGain();
  const attack = 0.012; // XY svarar direkt
  amp.gain.value = 0;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(XY_LEVEL, t + attack);
  // Vibrato (vickning)
  const vib = ctx.createGain();
  vib.gain.value = 0;
  engines.notes.vibLfo.connect(vib);
  oscs.forEach((o) => vib.connect(o.detune));
  // Vibrato från Y (sinus): en egen LFO per röst, så att varje finger har sitt eget
  let yLfo = null;
  let yDepth = null;
  if (yVib) {
    yLfo = ctx.createOscillator();
    yLfo.frequency.value = xyVibRate(ny);
    yDepth = ctx.createGain();
    yDepth.gain.value = xyVibDepth(ny);
    yLfo.connect(yDepth);
    oscs.forEach((o) => yDepth.connect(o.detune));
    yLfo.start(t);
  }
  // FM från Y: en modulator per röst, som följer tonhöjden
  let fmMod = null;
  let fmDepth = null;
  if (snd.fm) {
    fmMod = ctx.createOscillator();
    fmMod.frequency.value = freq * snd.fm.ratio;
    fmDepth = ctx.createGain();
    fmDepth.gain.value = xyFmDev(snd.fm, ny, freq);
    fmMod.connect(fmDepth);
    oscs.forEach((o) => fmDepth.connect(o.frequency));
    fmMod.start(t);
  }
  mix.connect(hp).connect(hp2).connect(amp).connect(xyBus());
  oscs.forEach((o) => o.start(t));
  return { osc: oscs[0], oscs, hp, hp2, amp, vib, yLfo, yDepth, fm: snd.fm, fmMod, fmDepth, t, attack };
}

// Släpp en röst (at = ljudklockans tid, annars så snart som möjligt). Reverb klingar ut ändå.
function xyVoiceEnd(v, at = 0) {
  const ctx = audioCtx;
  const rel = XY_RELEASE;
  const r = Math.max(ctx.currentTime + NOTE_LOOKAHEAD, at, v.t + 0.005); // aldrig före starten
  if (v.amp.gain.cancelAndHoldAtTime) v.amp.gain.cancelAndHoldAtTime(r);
  else {
    v.amp.gain.cancelScheduledValues(r);
    const level = r - v.t < v.attack ? (XY_LEVEL * (r - v.t)) / v.attack : XY_LEVEL;
    v.amp.gain.linearRampToValueAtTime(level, r);
  }
  v.amp.gain.setTargetAtTime(0, r, rel / 4);
  const end = r + (rel / 4) * 9 + 0.05;
  v.oscs.forEach((o) => o.stop(end));
  if (v.yLfo) v.yLfo.stop(end);
  if (v.fmMod) v.fmMod.stop(end);
  v.osc.onended = () => {
    v.amp.disconnect();
    try { engines.notes.vibLfo.disconnect(v.vib); } catch {}
  };
}

function xyVoiceStart(id, nx, ny) {
  if (!audioCtx || !engines.notes || !ui.outAudio.checked) return;
  oscSend('xy', xyOscId(id), { f: nx }, { f: ny }, 1);
  if (arpOn()) { xyArpAdd(id, nx, ny); return; } // arpeggio: pekaren blir en ton i arpeggiot
  xy.voices.set(id, xyMakeVoice(xyFreq(nx), ny));
}

function xyVoiceMove(id, nx, ny) {
  oscSend('xy', xyOscId(id), { f: nx }, { f: ny }, 1);
  if (xyArp.pts.has(id)) { xyArpMove(id, nx, ny); return; }
  const v = xy.voices.get(id);
  if (!v) return;
  const now = audioCtx.currentTime;
  const f = xyFreq(nx);
  // Kort glidtid: följer pekaren mjukt utan trappsteg mellan mushändelserna
  v.oscs.forEach((o) => o.frequency.setTargetAtTime(f, now, 0.012));
  if (v.fmMod) {
    v.fmMod.frequency.setTargetAtTime(f * v.fm.ratio, now, 0.012);
    v.fmDepth.gain.setTargetAtTime(xyFmDev(v.fm, ny, f), now, 0.02);
  }
  if (v.yLfo) {
    v.yDepth.gain.setTargetAtTime(xyVibDepth(ny), now, 0.03);
    v.yLfo.frequency.setTargetAtTime(xyVibRate(ny), now, 0.05);
  } else [v.hp, v.hp2].forEach((flt) => flt.frequency.setTargetAtTime(xyCut(ny, f), now, 0.02));
}

function xyVoiceStop(id) {
  if (xyArp.pts.has(id)) { xyArpRemove(id); oscSend('xy', xyOscId(id), { f: 0 }, { f: 0 }, 0); return; }
  const v = xy.voices.get(id);
  if (!v) return;
  xy.voices.delete(id);
  xyVoiceEnd(v);
  oscSend('xy', xyOscId(id), { f: 0 }, { f: 0 }, 0);
}

// ---------- Arpeggio på XY ----------
// Alla fingrar bildar tillsammans ett arpeggio, som tonerna i ett ackord på rutorna: varje finger
// är en ton (steglös tonhöjd och eget filter), och mönstret stegar genom fingrarnas toner – över
// oktaverna – en i taget. Bara Strum spelar alla på varje slag. Ett finger och 1 oktav = rytmisk
// upprepning. Mönster, tempo, notvärde, oktaver och tonlängd är samma som för rutorna (js/arp.js).
const xyArp = { pts: new Map(), timer: 0, nextTime: 0, emptySince: 0, step: 0, last: -1, order: 0 };

function xyArpAdd(id, nx, ny) {
  xyArp.pts.set(id, { id, nx, ny, order: xyArp.order++, vib: 0, voices: new Set() });
  if (!xyArp.timer) {
    // Första steget vid nästa runda: fingrar som landar samtidigt hinner med
    xyArp.step = 0;
    xyArp.last = -1;
    xyArp.nextTime = audioCtx.currentTime + NOTE_LOOKAHEAD + 0.03;
    xyArp.timer = setInterval(xyArpTick, ARP_TICK_MS);
  } else if (arpRetrig()) {
    // Retrigg: mönstret börjar om från första tonen, nu. Planerat men inte hört stryks.
    const now = audioCtx.currentTime;
    for (const p of xyArp.pts.values()) {
      p.voices.forEach((v) => {
        if (v.t > now) {
          try { v.amp.disconnect(); v.oscs.forEach((o) => o.stop()); v.yLfo?.stop(); v.fmMod?.stop(); } catch {}
          p.voices.delete(v);
        }
      });
    }
    xyArp.step = 0;
    xyArp.last = -1;
    xyArp.nextTime = now + NOTE_LOOKAHEAD + 0.03;
  }
}

function xyArpMove(id, nx, ny) {
  const p = xyArp.pts.get(id);
  if (p) { p.nx = nx; p.ny = ny; }
}

function xyArpRemove(id) {
  xyArp.pts.delete(id);
  if (!xyArp.pts.size) xyArp.emptySince = audioCtx.currentTime; // takten fortsätter ett steg
}

function xyArpReset() {
  clearInterval(xyArp.timer);
  xyArp.timer = 0;
  xyArp.pts.clear();
}

// Tonföljden för alla fingrar enligt mönstret: [{ p, f }] (f = frekvens i Hz)
function xyArpSequence() {
  const pattern = ui.arpPattern.value;
  const base = [...xyArp.pts.values()].map((p) => ({ p, f: xyFreq(p.nx) }));
  if (pattern === 'order') base.sort((a, b) => a.p.order - b.p.order); // i den ordning fingrarna kom
  else base.sort((a, b) => a.f - b.f);
  const octaves = Number(ui.arpOctaves.value) || 1;
  let seq = [];
  for (let o = 0; o < octaves; o++) seq.push(...base.map((e) => ({ p: e.p, f: e.f * 2 ** o })));
  if (pattern === 'down') seq.reverse();
  else if (pattern === 'updown' && seq.length > 2) seq = seq.concat(seq.slice(1, -1).reverse());
  else if (arpStrum()) seq.sort((a, b) => a.f - b.f); // Strum: alla toner nedifrån och upp
  return seq;
}

function xyArpTick() {
  const now = audioCtx.currentTime;
  if (xyArp.nextTime < now - 0.05) xyArp.nextTime = now + NOTE_LOOKAHEAD;
  if (!xyArp.pts.size && now - xyArp.emptySince > arpStepDur()) {
    clearInterval(xyArp.timer);
    xyArp.timer = 0;
    return;
  }
  while (xyArp.nextTime < now + ARP_LOOKAHEAD) {
    xyArpStep(xyArp.nextTime);
    xyArp.nextTime += arpStepDur();
  }
}

// En ton i arpeggiot: start t, slut end
function xyArpNote({ p, f }, t, end) {
  const v = xyMakeVoice(f, p.ny, t);
  if (p.vib) v.vib.gain.value = p.vib;
  xyVoiceEnd(v, end);
  p.voices.add(v);
  setTimeout(() => p.voices.delete(v), (end - audioCtx.currentTime) * 1000 + 150);
}

function xyArpStep(time) {
  const seq = xyArpSequence();
  if (!seq.length) return;
  const dur = arpGateDur();
  const wait = Math.max(0, (time - audioCtx.currentTime) * 1000);
  let hits;
  if (arpStrum()) {
    // Strum: alla fingrars toner på varje slag, snabbt efter varandra (Ner & upp: vartannat slag uppifrån)
    if (ui.arpPattern.value === 'strumud' && xyArp.step % 2) seq.reverse();
    xyArp.step++;
    const gap = arpStrumGap(seq.length);
    seq.forEach((e, i) => { const t = time + i * gap; xyArpNote(e, t, Math.max(time + dur, t + 0.05)); });
    hits = [...new Set(seq.map((e) => e.p))];
  } else {
    let idx;
    if (ui.arpPattern.value === 'random') {
      idx = Math.floor(Math.random() * seq.length);
      if (seq.length > 1 && idx === xyArp.last) idx = (idx + 1) % seq.length;
    } else idx = xyArp.step % seq.length;
    xyArp.last = idx;
    xyArp.step++;
    xyArpNote(seq[idx], time, time + dur);
    hits = [seq[idx].p];
  }
  setTimeout(() => {
    const t = performance.now();
    hits.forEach((p) => xy.pulses.push({ x: p.nx, y: 1 - p.ny, t, color: xy.trails.get(p.id)?.color || '#fff' }));
    xyLoop();
  }, wait);
}

// Vibrato för en XY-pekare (anropas av js/vibrato.js)
function xyVibrato(id, cents, rate) {
  const now = audioCtx.currentTime;
  if (rate) engines.notes.vibLfo.frequency.setTargetAtTime(rate, now, 0.25);
  const v = xy.voices.get(id);
  if (v) v.vib.gain.setTargetAtTime(cents, now, cents > 0 ? 0.12 : 0.25);
  const p = xyArp.pts.get(id);
  if (p) {
    p.vib = cents;
    p.voices.forEach((pv) => pv.vib.gain.setTargetAtTime(cents, now, 0.12));
  }
}

const xyStopAll = () => { [...xy.voices.keys()].forEach(xyVoiceStop); xyArpReset(); xy.present.clear(); };
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
  // En gång: standard är nu C2–C7 (5 oktaver)
  if (!localStorage.getItem('hoverPadsXyRange3')) {
    localStorage.setItem('hoverPadsXyRange3', '1');
    ui.xyOctaves.value = '5';
    saveSettings();
  }
  // Reverben finns både i spelraden på XY-sidan och under Inställningar → Instrument – de följs åt
  const revBar = $('xy-reverb-bar');
  revBar.value = ui.xyReverb.value;
  ui.xyReverb.addEventListener('input', () => {
    revBar.value = ui.xyReverb.value;
    if (xy.send) xy.send.gain.setTargetAtTime(Number(ui.xyReverb.value), audioCtx.currentTime, 0.05);
  });
  revBar.addEventListener('input', () => {
    ui.xyReverb.value = revBar.value;
    ui.xyReverb.dispatchEvent(new Event('input')); // ljud och värdetext
  });
  revBar.addEventListener('change', () => ui.xyReverb.dispatchEvent(new Event('change'))); // sparar
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
  [ui.xyOctaves, ui.root, ui.scale, ui.xySound, ui.xyQuantize].forEach((el) => el.addEventListener('change', xyDraw));
  // Skala-knappen i spelraden (samma val som under Instrument → XY-platta)
  $('xy-quant-toggle').addEventListener('click', () => {
    ui.xyQuantize.checked = !xyQuantOn();
    ui.xyQuantize.dispatchEvent(new Event('change')); // sparar och ritar om
    log(xyQuantOn() ? `${t('Skala')}: ${NOTE_NAMES[Number(ui.root.value)]} ${t(scaleName())}` : t('Steglös tonhöjd'));
  });
  [ui.xyQuantize, ui.root, ui.scale].forEach((el) => el.addEventListener('change', syncXyQuant));
  syncXyQuant();
}

// Anropas när fliken byts
function xyShow(on) {
  if (!on) { xyStopAll(); return; }
  $('xy-reverb-bar').value = ui.xyReverb.value; // om värdet bytts av ett preset
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

// Bakgrund: linjer för skalans toner – svaga som orientering när tonhöjden glider steglöst,
// tydligare med Skala (kvantisera) på, när varje linje är en ton man hamnar på
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
    const q = xyQuantOn();
    g.strokeStyle = hc ? (isRoot ? '#fff' : q ? '#bbb' : '#777') : isRoot ? `rgba(140,160,255,${q ? 0.55 : 0.38})` : `rgba(140,150,190,${q ? 0.3 : 0.12})`;
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
  g.fillText(t(xyYIsVibrato() ? 'Mer vibrato  →' : 'Filter öppnas  →'), 0, 0);
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
    if (xy.voices.has(id) || xyArp.pts.has(id)) {
      const last = pts[pts.length - 1];
      g.globalAlpha = 1;
      g.shadowBlur = hc ? 0 : 30;
      g.fillStyle = hc ? '#ffd400' : '#fff';
      g.beginPath();
      g.arc(last.x * W, last.y * H, 7, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Arpeggiots steg: en ring som växer ut från pekaren och bleknar
  xy.pulses = xy.pulses.filter((pl) => now - pl.t < 450);
  for (const pl of xy.pulses) {
    const k = (now - pl.t) / 450;
    g.globalAlpha = (1 - k) * 0.9;
    g.shadowBlur = hc ? 0 : 18;
    g.shadowColor = pl.color;
    g.strokeStyle = hc ? '#ffd400' : pl.color;
    g.lineWidth = 3 * (1 - k) + 1;
    g.beginPath();
    g.arc(pl.x * W, pl.y * H, 8 + 34 * k, 0, Math.PI * 2);
    g.stroke();
    alive = true;
  }
  g.globalAlpha = 1;
  g.shadowBlur = 0;
  // Fortsätt rita medan något bleknar
  if (alive) xyLoop();
}

// Skala-knappen. När den är på visas också Tonart-knappen på XY (annars är tonarten ointressant där).
function syncXyQuant() {
  const b = $('xy-quant-toggle');
  const on = xyQuantOn();
  const key = `${NOTE_NAMES[Number(ui.root.value)]} ${t(scaleName())}`;
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
  b.querySelector('span').textContent = t('Skala');
  $('quick-key').classList.toggle('xy-on', on);
  if (!on && quick.open === 'key' && document.body.dataset.tab === 'xy') closeQuick();
  b.title = t(`Håll tonerna i skalan (${key}) – av: steglös tonhöjd`);
}
