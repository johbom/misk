// Rutor i allmänhet: spela/släpp, mus-hover och pekskärm.

// ---------- Gemensamt för alla rutor ----------
// En ruta (pad) har: el (hela rutan), notes() (vilka MIDI-toner), label (för loggen)
const notePads = [];
const chordPads = [];
const allPads = () => [...notePads, ...chordPads];

const noteName = (n) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const clampNote = (n) => Math.max(0, Math.min(127, n));

// ---------- Pekare över en ruta (mus, ögonstyrning, finger) ----------
// Alla pekare går genom enterPad/leavePad. Tillgänglighetsinställningarna gäller pekare som SVÄVAR
// (blick eller mus utan nedtryckt knapp). Trycker man eller drar med finger/musknapp är det avsiktligt,
// och då spelar det direkt – annars skulle t.ex. svep och harpa över strängarna sluta fungera.
//  - aktiveringstid: pekaren måste vila på rutan en stund innan den spelar (mot "Midas touch")
//  - släppfördröjning: pekaren får darra ut över kanten en kort stund utan att tonen släpps
//  - spärrtid: samma ruta kan inte spelas igen direkt (mot stamning vid kanten)
const ms = (el) => Number(el.value) || 0;

function hoverState(pad) {
  if (!pad.hover) pad.hover = { on: new Set(), dwell: 0, leave: 0, last: -Infinity };
  return pad.hover;
}

function enterPad(pad, src, pressed = false) {
  if (scanning()) return;
  const h = hoverState(pad);
  const wasEmpty = h.on.size === 0;
  h.on.add(src);
  if (h.leave) { clearTimeout(h.leave); h.leave = 0; return; } // tillbaka inom tålighetstiden
  if (!wasEmpty) return;
  const wait = pressed ? 0 : ms(ui.dwell);
  if (!wait) { activate(pad, pressed); return; }
  pad.el.style.setProperty('--dwell-ms', `${wait}ms`);
  pad.el.classList.add('dwelling');
  gazeDwell(wait);
  h.dwell = setTimeout(() => { h.dwell = 0; pad.el.classList.remove('dwelling'); gazeDwell(0); activate(pad); }, wait);
}

function leavePad(pad, src, pressed = false) {
  const h = hoverState(pad);
  if (!h.on.delete(src) || h.on.size) return;
  const grace = pressed ? 0 : ms(ui.releaseDelay);
  const done = () => {
    h.leave = 0;
    cancelDwell(pad);
    if (ui.playMode.value === 'hold') release(pad);
  };
  if (grace) h.leave = setTimeout(done, grace);
  else done();
}

function cancelDwell(pad) {
  const h = hoverState(pad);
  if (h.dwell) { clearTimeout(h.dwell); h.dwell = 0; gazeDwell(0); }
  pad.el.classList.remove('dwelling');
}

// Spela, om spärrtiden har gått ut (gäller inte när man trycker/drar)
function activate(pad, pressed = false) {
  const h = hoverState(pad);
  const now = performance.now();
  if (!pressed && now - h.last < ms(ui.lockout)) return;
  h.last = now;
  trigger(pad);
}

function resetHover() {
  allPads().forEach((p) => {
    const h = hoverState(p);
    clearTimeout(h.leave);
    h.leave = 0;
    h.on.clear();
    cancelDwell(p);
  });
}

// Musen (och ögonstyrning, som styr muspekaren); fingrar sköts av setupTouch() nedan.
function attachHover(pad, hitEl) {
  hitEl.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'touch') enterPad(pad, 'mouse', e.buttons > 0);
  });
  hitEl.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') leavePad(pad, 'mouse', e.buttons > 0);
  });
  // Trycker man på en ruta som väntar ut aktiveringstiden spelar den direkt
  hitEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || !hoverState(pad).dwell || scanning()) return;
    cancelDwell(pad);
    activate(pad, true);
  });
}

// ---------- Pekskärm ----------
// Ett finger "fångas" av elementet det landade på, så enter/leave på rutorna går inte att lita på
// (särskilt i Safari på iPhone). I stället kollar vi vid varje rörelse vilken ruta som ligger under
// fingret. Varje finger följs för sig, så flera fingrar kan spela samtidigt.
const fingers = new Map(); // pointerId -> ruta under fingret (eller null i ett mellanrum)

// Spelytan = allt utom reglage, flikar, inställningar och menyer – även bakgrunden runt rutorna,
// så att man kan börja dra var som helst och glida in på rutorna.
const CONTROLS = 'header, #play-bar, #settings, #chord-picker, #start-overlay, dialog, input, select, label, a, button:not(.pad)';
const inPlayArea = (target) => target instanceof Element && !target.closest(CONTROLS);

function padAt(x, y) {
  const el = document.elementFromPoint(x, y)?.closest('.pad');
  return el ? allPads().find((p) => p.el === el) || null : null;
}

function moveFinger(id, pad) {
  const old = fingers.get(id) || null;
  if (pad === old) return;
  fingers.set(id, pad);
  if (old) leavePad(old, id, true); // ett finger på skärmen trycker alltid
  if (pad) enterPad(pad, id, true);
}

function liftFinger(id) {
  if (!fingers.has(id)) return;
  moveFinger(id, null);
  fingers.delete(id);
}

function setupTouch() {
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !inPlayArea(e.target) || scanning()) return;
    // iOS kan ha pausat ljudet (skärmlås, samtal) – väck det vid beröring
    if (audioCtx && audioCtx.state !== 'running') audioCtx.resume();
    try { e.target.releasePointerCapture(e.pointerId); } catch {}
    fingers.set(e.pointerId, null);
    moveFinger(e.pointerId, padAt(e.clientX, e.clientY));
  });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || !fingers.has(e.pointerId)) return;
    moveFinger(e.pointerId, padAt(e.clientX, e.clientY));
  });
  document.addEventListener('pointerup', (e) => liftFinger(e.pointerId));
  document.addEventListener('pointercancel', (e) => liftFinger(e.pointerId));

  // Hindra iOS från att tolka dragningen som scroll/zoom (då avbryts fingret mitt i)
  const block = (e) => { if (inPlayArea(e.target)) e.preventDefault(); };
  document.addEventListener('touchstart', block, { passive: false });
  document.addEventListener('touchmove', block, { passive: false });
}

function trigger(pad) {
  if (!audioCtx) return; // inte startat än
  if (picker.open) return; // tyst medan högerklicksmenyn är öppen
  const mode = ui.playMode.value;
  if (mode === 'latch') {
    // Ligg kvar: samma ruta igen stänger av, en annan ruta tar över
    const wasOn = !!pad.release;
    allPads().forEach(release);
    if (wasOn) { log(`■ ${pad.label()}`); return; }
  }
  release(pad);
  pad.el.classList.add('active');

  const notes = pad.notes();
  const stops = [];
  const useSample = ui.outAudio.checked && !!pad.sample;
  if (ui.outAudio.checked) {
    if (useSample) stops.push(playSample(pad.sample));
    else {
      const level = 1 / Math.sqrt(notes.length);
      notes.forEach((n) => stops.push(engine.noteOn(n, level)));
    }
  }
  if (ui.outMidi.checked) {
    const ch = midiChannel();
    notes.forEach((n) => noteOn(n, ch));
    stops.push(() => notes.forEach((n) => noteOff(n, ch)));
  }
  const oscStop = oscNoteOn(pad, notes);
  if (oscStop) stops.push(oscStop);
  pad.release = () => stops.forEach((s) => s());
  // Vibrato på allt som rutan spelar just nu (styrs av js/vibrato.js)
  pad.vibrato = (cents, rate) => stops.forEach((s) => s.vibrato && s.vibrato(cents, rate));
  log(`▶ ${pad.label()}  (${notes.map(noteName).join(' ')})`);

  // One-shot och Bestämd längd: släpps av en timer, inte av pekaren
  const length = mode === 'fixed' ? ms(ui.noteLength) || ONESHOT_MS
    : mode === 'shot' ? (useSample ? pad.sample.duration * 1000 : naturalLength()) : 0;
  if (length) {
    const r = pad.release;
    setTimeout(() => { if (pad.release === r) release(pad); }, length);
  }
}

// One-shot för syntljud: anslag + avklingning enligt ljudets volymkurva (0,3–5 s)
function naturalLength() {
  const p = engine.p;
  return Math.min(5000, Math.max(300, (p.attack + 2 * p.decay) * 1000));
}

function release(pad) {
  pad.el.classList.remove('active');
  if (pad.release) { pad.release(); pad.release = null; }
  pad.vibrato = null;
}
