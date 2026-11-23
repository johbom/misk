// Effektplattan (avancerat läge): en XY-platta som styr två effekter på allt ljud på Toner och Ackord –
// rutorna, trumseten, sequencern och line-in. Välj vad X och Y styr ur effektlistan (filter, drive,
// chorus, delay, reverb). Plattan styrs med pekaren: det räcker att föra den över plattan.
// Hold av: effekten går tillbaka (till vila) när pekaren lämnar plattan. Hold på: den stannar.
//
// Ljudvägen: när plattan är på spelar Toner- och Ackord-motorerna (och line-in) in i en egen effektmotor
// (SynthEngine utan egen kompressor, js/synth.js) som i sin tur spelar till slutmixen. Av: direkt till
// slutmixen, som förut. Knappen FX-platta i spelraden öppnar rutan (js/quick.js, som Arp och Seq).

// Vad X och Y kan styra. min/max: från vänster/nederkant till höger/överkant. rest: värdet i vila
// (null = behåll senaste). filter: post-filtrets typ.
const FXPAD_AXES = [
  ['lowpass', { label: 'Lågpass', key: 'postFreq', filter: 'lowpass', min: 120, max: 20000, log: true, rest: 20000, fmt: hz }],
  ['highpass', { label: 'Högpass', key: 'postFreq', filter: 'highpass', min: 20, max: 8000, log: true, rest: 20, fmt: hz }],
  ['bandpass', { label: 'Bandpass', key: 'postFreq', filter: 'bandpass', min: 150, max: 6000, log: true, rest: null, fmt: hz }],
  ['postQ', { label: 'Resonans (filter)', key: 'postQ', min: 0.7, max: 14, log: true, rest: 0.7, fmt: (v) => v.toFixed(1) }],
  ['drive', { label: 'Drive', key: 'drive', min: 0, max: 1, rest: 0, fmt: pct }],
  ['chorus', { label: 'Chorus', key: 'chorus', min: 0, max: 1, rest: 0, fmt: pct }],
  ['delayMix', { label: 'Delay', key: 'delayMix', min: 0, max: 0.8, rest: 0, fmt: pct }],
  ['delayTime', { label: 'Delaytid', key: 'delayTime', min: 0.05, max: 1, log: true, rest: null, fmt: sec }],
  ['delayFeedback', { label: 'Feedback (delay)', key: 'delayFeedback', min: 0, max: 0.9, rest: null, fmt: pct }],
  ['reverbMix', { label: 'Reverb', key: 'reverbMix', min: 0, max: 1, rest: 0, fmt: pct }],
];
const FXPAD_AXIS = Object.fromEntries(FXPAD_AXES);
// Utgångsläget för det plattan inte styr (delayn hörs när Delay styrs, osv.)
const FXPAD_BASE = { drive: 0, chorus: 0, delayMix: 0, delaySync: 'off', delayTime: 0.375, delayFeedback: 0.45, reverbMix: 0, reverbSize: 3, postFilter: 'off', postFreq: 1000, postQ: 0.7, postPos: 'after' };

const fxpad = { engine: null, x: 0.5, y: 0.5, live: false, line: null, lineGain: null, keep: {} };

// Valen för X och Y (fylls direkt, så att sparade inställningar hittar sina värden)
for (const [sel, def] of [[ui.fxpadX, 'lowpass'], [ui.fxpadY, 'reverbMix']]) {
  sel.innerHTML = FXPAD_AXES.map(([v, a]) => `<option value="${v}">${a.label}</option>`).join('');
  sel.value = def;
}

const fxPadOn = () => ui.fxpadOn.checked && document.body.dataset.level !== 'simple';
const fxAxis = (sel) => FXPAD_AXIS[sel.value] || FXPAD_AXES[0][1];
const fxAxisValue = (a, n) => (a.log ? a.min * Math.pow(a.max / a.min, n) : a.min + (a.max - a.min) * n);

// Motorns parametrar för pekarens läge (eller vila)
function fxPadParams() {
  const p = { ...SYNTH_DEFAULTS, ...FXPAD_BASE, ...fxpad.keep };
  const axes = [[fxAxis(ui.fxpadX), fxpad.x], [fxAxis(ui.fxpadY), fxpad.y]];
  // Två filter på en gång går inte (det finns ett): X vinner
  const filt = axes.find(([a]) => a.filter)?.[0].filter || null;
  for (const [a, n] of axes) {
    if (a.filter && a.filter !== filt) continue;
    if (a.filter) {
      if (fxpad.live) { p.postFilter = a.filter; p.postFreq = fxAxisValue(a, n); }
      else if (a.rest !== null) { p.postFilter = a.filter; p.postFreq = a.rest; }
      continue;
    }
    if (fxpad.live) p[a.key] = fxAxisValue(a, n);
    else if (a.rest !== null) p[a.key] = a.rest;
  }
  return p;
}

// Det som inte har något viloläge (delaytid, feedback) stannar där det senast var
function fxPadKeep() {
  for (const sel of [ui.fxpadX, ui.fxpadY]) {
    const a = fxAxis(sel);
    if (a.rest === null && !a.filter) fxpad.keep[a.key] = fxAxisValue(a, sel === ui.fxpadX ? fxpad.x : fxpad.y);
  }
}

function fxPadApply() {
  fxpad.engine?.setParams(fxPadParams());
  fxPadDraw();
}

function fxPadDraw() {
  const el = $('fxpad');
  el.style.setProperty('--x', fxpad.x);
  el.style.setProperty('--y', fxpad.y);
  el.classList.toggle('live', fxpad.live);
  el.classList.toggle('off', !ui.fxpadOn.checked);
  const ax = fxAxis(ui.fxpadX), ay = fxAxis(ui.fxpadY);
  const txt = (a, n, axis) => `${axis} ${t(a.label)} ${a.fmt(fxAxisValue(a, n))}`;
  el.querySelector('.fxpad-val').textContent = fxpad.live
    ? `${txt(ax, fxpad.x, 'X')} · ${txt(ay, fxpad.y, 'Y')}`
    : t(ui.fxpadOn.checked ? 'För pekaren över plattan' : 'Plattan är av');
}

// Ljudvägen: genom plattan eller direkt till slutmixen
function fxPadRoute() {
  if (!audioCtx || !audioMaster) return;
  const on = fxPadOn();
  if (on && !fxpad.engine) {
    fxpad.engine = new SynthEngine(audioCtx, fxPadParams(), audioMaster, { dynamics: false });
    fxpad.engine.setVolume(1);
  }
  if (fxpad.engine) {
    fxpad.engine.keepAwake = on;
    if (on) fxpad.engine.wake();
  }
  const dest = on ? fxpad.engine.input : audioMaster;
  for (const e of new Set([engines.notes, engines.chords])) e?.setOut(dest);
  if (fxpad.lineGain) {
    try { fxpad.lineGain.disconnect(); } catch {}
    fxpad.lineGain.connect(dest);
  }
}

// Pekaren över plattan
function fxPadPoint(e) {
  if (!ui.fxpadOn.checked) return;
  const r = $('fxpad').getBoundingClientRect();
  if (!r.width || !r.height) return;
  fxpad.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  fxpad.y = Math.min(1, Math.max(0, (r.bottom - e.clientY) / r.height));
  if (!fxpad.live) {
    fxpad.live = true;
    if (!audioCtx) { try { initAudio(); } catch {} }
    wakeAudio();
  }
  fxPadApply();
}

function fxPadLeave() {
  if (!fxpad.live) return;
  fxPadKeep();
  if (ui.fxpadHold.checked) return; // Hold: effekten stannar
  fxpad.live = false;
  fxPadApply();
}

// Line-in: ljudet in spelas live (genom plattan när den är på)
async function fxPadLine() {
  if (ui.lineIn.checked) {
    if (fxpad.line) return;
    if (!audioCtx) { try { initAudio(); } catch {} }
    const src = await liveInAcquire('line-in');
    if (!src || !ui.lineIn.checked) {
      if (!src) ui.lineIn.checked = false;
      else liveInRelease('line-in');
      return;
    }
    fxpad.line = src;
    fxpad.lineGain = audioCtx.createGain();
    fxpad.lineGain.gain.value = Number(ui.lineInLevel.value);
    src.connect(fxpad.lineGain);
    fxPadRoute();
    log(t('Line-in på – använd hörlurar, annars kan det tjuta.'));
  } else if (fxpad.line) {
    try { fxpad.line.disconnect(fxpad.lineGain); } catch {}
    try { fxpad.lineGain.disconnect(); } catch {}
    fxpad.line = null;
    fxpad.lineGain = null;
    liveInRelease('line-in');
    log(t('Line-in av'));
  }
}

function syncFxPadToggle() {
  const b = $('fxpad-toggle');
  b.classList.toggle('on', ui.fxpadOn.checked);
  b.setAttribute('aria-pressed', ui.fxpadOn.checked);
  fxPadDraw();
}

function setupFxPad() {
  const pad = $('fxpad');
  // Hover räcker; med finger eller penna gäller samma sak medan man rör plattan
  pad.addEventListener('pointermove', fxPadPoint);
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); fxPadPoint(e); });
  pad.addEventListener('pointerleave', fxPadLeave);
  pad.addEventListener('pointercancel', fxPadLeave);
  pad.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') fxPadLeave(); });

  ui.fxpadOn.addEventListener('change', () => {
    if (!ui.fxpadOn.checked) { fxpad.live = false; fxpad.keep = {}; }
    fxPadRoute();
    fxPadApply();
    syncFxPadToggle();
    log(t(`Effektplatta ${ui.fxpadOn.checked ? 'på' : 'av'}`));
  });
  [ui.fxpadX, ui.fxpadY].forEach((sel) => sel.addEventListener('change', fxPadApply));
  ui.fxpadHold.addEventListener('change', () => { if (!ui.fxpadHold.checked && !pad.matches(':hover')) { fxpad.live = false; fxPadApply(); } });
  ui.lineIn.addEventListener('change', fxPadLine);
  const showLevel = () => { $('line-in-level-value').textContent = `${Math.round(Number(ui.lineInLevel.value) * 100)} %`; };
  ui.lineInLevel.addEventListener('input', () => {
    showLevel();
    fxpad.lineGain?.gain.setTargetAtTime(Number(ui.lineInLevel.value), audioCtx.currentTime, 0.03);
  });
  showLevel();

  // Knappen öppnar och stänger rutan; av med brytaren i rutan. Är plattan av slås den på när rutan öppnas.
  $('fxpad-toggle').addEventListener('click', () => {
    if (quick.open === 'fxpad') { closeQuick(); return; }
    if (!ui.fxpadOn.checked) {
      ui.fxpadOn.checked = true;
      ui.fxpadOn.dispatchEvent(new Event('change'));
    }
    openQuick('fxpad');
  });
  syncFxPadToggle();
}

// Sparade inställningar och presets: plattan och knappen följer med
function fxPadSync() {
  fxPadRoute();
  fxPadApply();
  syncFxPadToggle();
}
