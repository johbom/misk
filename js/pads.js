// Rutor i allmänhet: spela/släpp, mus-hover och pekskärm.

// ---------- Gemensamt för alla rutor ----------
// En ruta (pad) har: el (hela rutan), notes() (vilka MIDI-toner), label (för loggen)
const notePads = [];
const chordPads = [];
const allPads = () => [...notePads, ...chordPads];

const noteName = (n) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const clampNote = (n) => Math.max(0, Math.min(127, n));

// Kopplar mouseover/mouseout på hover-ytan till att spela/släppa rutan.
// Gäller musen; fingrar sköts av setupTouch() nedan.
function attachHover(pad, hitEl) {
  hitEl.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') trigger(pad);
  });
  hitEl.addEventListener('pointerleave', (e) => {
    // I "kort ton"-läget släpps tonen av en timer i stället
    if (e.pointerType === 'mouse' && ui.playMode.value === 'hold') release(pad);
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
  const stillHeld = old && [...fingers.values()].includes(old);
  if (old && !stillHeld && ui.playMode.value === 'hold') release(old);
  if (pad) trigger(pad);
}

function liftFinger(id) {
  if (!fingers.has(id)) return;
  moveFinger(id, null);
  fingers.delete(id);
}

function setupTouch() {
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !inPlayArea(e.target)) return;
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

  if (ui.playMode.value === 'oneshot') {
    const r = pad.release;
    setTimeout(() => { if (pad.release === r) release(pad); }, ONESHOT_MS);
  }
}

function release(pad) {
  pad.el.classList.remove('active');
  if (pad.release) { pad.release(); pad.release = null; }
}
