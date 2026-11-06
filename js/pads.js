// Rutor i allmänhet: spela/släpp, mus-hover och pekskärm.

// ---------- Gemensamt för alla rutor ----------
// En ruta (pad) har: el (hela rutan), notes() (vilka MIDI-toner), label (för loggen)
const notePads = [];
const chordPads = [];
const allPads = () => [...notePads, ...chordPads];

const noteName = (n) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const clampNote = (n) => Math.max(0, Math.min(127, n));

// ---------- Pekare över en ruta (mus, ögonstyrning, finger) ----------
// Alla pekare går genom enterPad/leavePad, så att tillgänglighetsinställningarna gäller överallt:
//  - aktiveringstid: pekaren måste vila på rutan en stund innan den spelar (mot "Midas touch")
//  - släppfördröjning: pekaren får darra ut över kanten en kort stund utan att tonen släpps
//  - spärrtid: samma ruta kan inte spelas igen direkt (mot stamning vid kanten)
const ms = (el) => Number(el.value) || 0;

function hoverState(pad) {
  if (!pad.hover) pad.hover = { on: new Set(), dwell: 0, leave: 0, last: -Infinity };
  return pad.hover;
}

function enterPad(pad, src) {
  if (scanning()) return;
  const h = hoverState(pad);
  const wasEmpty = h.on.size === 0;
  h.on.add(src);
  if (h.leave) { clearTimeout(h.leave); h.leave = 0; return; } // tillbaka inom tålighetstiden
  if (!wasEmpty) return;
  const wait = ms(ui.dwell);
  if (!wait) { activate(pad); return; }
  pad.el.style.setProperty('--dwell-ms', `${wait}ms`);
  pad.el.classList.add('dwelling');
  gazeDwell(wait);
  h.dwell = setTimeout(() => { h.dwell = 0; pad.el.classList.remove('dwelling'); gazeDwell(0); activate(pad); }, wait);
}

function leavePad(pad, src) {
  const h = hoverState(pad);
  if (!h.on.delete(src) || h.on.size) return;
  const grace = ms(ui.releaseDelay);
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

// Spela, om spärrtiden har gått ut
function activate(pad) {
  const h = hoverState(pad);
  const now = performance.now();
  if (now - h.last < ms(ui.lockout)) return;
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
    if (e.pointerType !== 'touch') enterPad(pad, 'mouse');
  });
  hitEl.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') leavePad(pad, 'mouse');
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
  if (old) leavePad(old, id);
  if (pad) enterPad(pad, id);
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
  if (ui.outAudio.checked) {
    if (pad.sample) playSample(pad.sample);
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
  pad.release = () => stops.forEach((s) => s());
  log(`▶ ${pad.label()}  (${notes.map(noteName).join(' ')})`);

  if (mode === 'oneshot') {
    const r = pad.release;
    setTimeout(() => { if (pad.release === r) release(pad); }, ms(ui.noteLength) || ONESHOT_MS);
  }
}

function release(pad) {
  pad.el.classList.remove('active');
  if (pad.release) { pad.release(); pad.release = null; }
}
