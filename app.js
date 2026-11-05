// Hover Pads – spelar ljud (Web Audio) och/eller skickar MIDI (Web MIDI) vid mouseover.
// Två sidor: "Toner" (en ton per ruta) och "Ackord" (2–8 rutor, valfritt ackord i varje).

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
// [suffix, namn i listan, intervall i halvtoner från grundtonen]
const CHORD_TYPES = [
  ['', 'dur', [0, 4, 7]],
  ['m', 'moll', [0, 3, 7]],
  ['7', '7', [0, 4, 7, 10]],
  ['maj7', 'maj7', [0, 4, 7, 11]],
  ['m7', 'm7', [0, 3, 7, 10]],
  ['6', '6', [0, 4, 7, 9]],
  ['m6', 'm6', [0, 3, 7, 9]],
  ['9', '9', [0, 4, 7, 10, 14]],
  ['add9', 'add9', [0, 4, 7, 14]],
  ['sus2', 'sus2', [0, 2, 7]],
  ['sus4', 'sus4', [0, 5, 7]],
  ['dim', 'dim', [0, 3, 6]],
  ['dim7', 'dim7', [0, 3, 6, 9]],
  ['m7b5', 'm7b5', [0, 3, 6, 10]],
  ['aug', 'aug', [0, 4, 8]],
];
const CHORD_INTERVALS = Object.fromEntries(CHORD_TYPES.map(([s, , iv]) => [s, iv]));
const MAX_CHORDS = 8;
// Standard: C G Am F Dm Em E7 Bb
const DEFAULT_CHORDS = [[0, ''], [7, ''], [9, 'm'], [5, ''], [2, 'm'], [4, 'm'], [4, '7'], [10, '']]
  .map(([root, type]) => ({ root, type }));

const NOTE_COUNT_MIN = 2;
const NOTE_COUNT_MAX = 32;
const ONESHOT_MS = 300;

const $ = (id) => document.getElementById(id);
const ui = {
  outAudio: $('out-audio'),
  outMidi: $('out-midi'),
  playMode: $('play-mode'),
  padGap: $('pad-gap'),
  formation: $('formation'),
  root: $('root'),
  octave: $('octave'),
  scale: $('scale'),
  noteCount: $('note-count'),
  chordCount: $('chord-count'),
  chordOctave: $('chord-octave'),
  chordBass: $('chord-bass'),
  chordAdvanced: $('chord-advanced'),
  preset: $('preset'),
  volume: $('volume'),
  midiOut: $('midi-out'),
  midiCh: $('midi-ch'),
  velocity: $('velocity'),
  panic: $('panic'),
  midiStatus: $('midi-status'),
  pads: $('pads'),
  chordPads: $('chord-pads'),
  log: $('log'),
};

// ---------- Ljud (Web Audio + ljudmotorn i synth.js) ----------
let audioCtx = null;
let engine = null;

function initAudio() {
  // iPhone: spela även när ljudlös-knappen är på (Safari 16.4+)
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  engine = new SynthEngine(audioCtx, synthParams);
  engine.setVolume(Number(ui.volume.value));
}

// Spelar en uppladdad ljudfil genom effekterna (spelar alltid klart).
function playSample(buffer) {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(engine.input);
  src.start();
}

// ---------- MIDI (Web MIDI) ----------
let midiAccess = null;

async function initMidi() {
  if (!navigator.requestMIDIAccess) {
    ui.midiStatus.textContent = 'MIDI: stöds ej i denna webbläsare';
    ui.outMidi.disabled = true;
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess();
    refreshMidiOutputs();
    midiAccess.onstatechange = refreshMidiOutputs;
  } catch (err) {
    ui.midiStatus.textContent = 'MIDI: åtkomst nekad';
  }
}

function refreshMidiOutputs() {
  const prev = ui.midiOut.value || localStorage.getItem('midiOut') || '';
  ui.midiOut.innerHTML = '<option value="">– ingen –</option>';
  for (const out of midiAccess.outputs.values()) {
    ui.midiOut.append(new Option(out.name, out.id));
  }
  if (prev && [...ui.midiOut.options].some((o) => o.value === prev)) ui.midiOut.value = prev;
  else if (ui.midiOut.options.length > 1) ui.midiOut.selectedIndex = 1;
  updateMidiStatus();
}

function currentMidiOutput() {
  return midiAccess && ui.midiOut.value ? midiAccess.outputs.get(ui.midiOut.value) : null;
}

function updateMidiStatus() {
  const out = currentMidiOutput();
  ui.midiStatus.textContent = out ? `MIDI: ${out.name}` : 'MIDI: ingen enhet vald';
  ui.midiStatus.classList.toggle('ok', !!out);
}

function sendMidi(bytes) {
  const out = currentMidiOutput();
  if (!out) return;
  out.send(bytes);
  ui.midiStatus.classList.add('flash');
  setTimeout(() => ui.midiStatus.classList.remove('flash'), 60);
}

// Räknar hur många rutor som håller samma ton, så att en ruta som släpps
// inte stänger av en ton som en annan ruta (t.ex. ett annat ackord) fortfarande spelar.
const heldNotes = new Map(); // "kanal:ton" -> antal

const midiChannel = () => (Math.min(16, Math.max(1, Number(ui.midiCh.value) || 1)) - 1);

function noteOn(note, ch) {
  const key = `${ch}:${note}`;
  heldNotes.set(key, (heldNotes.get(key) || 0) + 1);
  sendMidi([0x90 | ch, note, Number(ui.velocity.value)]);
}

function noteOff(note, ch) {
  const key = `${ch}:${note}`;
  const left = (heldNotes.get(key) || 1) - 1;
  if (left > 0) { heldNotes.set(key, left); return; }
  heldNotes.delete(key);
  sendMidi([0x80 | ch, note, 0]);
}

function panic() {
  allPads().forEach(release);
  heldNotes.clear();
  const out = currentMidiOutput();
  if (!out) return;
  for (let ch = 0; ch < 16; ch++) {
    out.send([0xb0 | ch, 123, 0]); // All Notes Off
    out.send([0xb0 | ch, 120, 0]); // All Sound Off
  }
  log('Panik: All Notes Off skickat');
}

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
const CONTROLS = 'header, #play-bar, #settings, #chord-picker, #start-overlay, input, select, label, button:not(.pad)';
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

// ---------- Sidan "Toner" ----------
function noteScale() {
  const scale = SCALES[ui.scale.value];
  const base = 12 * (Number(ui.octave.value) + 1) + Number(ui.root.value); // C4 = 60
  return Array.from({ length: notePads.length }, (_, i) =>
    clampNote(base + 12 * Math.floor(i / scale.length) + scale[i % scale.length])
  );
}

// Lägger till eller tar bort rutor i slutet, så att uppladdade ljudfiler finns kvar.
function buildNotePads() {
  const count = Number(ui.noteCount.value);
  notePads.forEach(release);
  while (notePads.length > count) notePads.pop().el.remove();
  while (notePads.length < count) addNotePad(notePads.length);
  updateNotes();
  layoutPads();
}

function addNotePad(i) {
  const el = document.createElement('button');
  el.className = 'pad';
  el.type = 'button';
  const pad = {
    el, note: 0, sample: null, sampleName: '', release: null,
    notes: () => [pad.note],
    label: () => noteName(pad.note),
  };
  notePads.push(pad);
  attachHover(pad, el);

  // Dra-och-släpp en ljudfil till en ruta
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', (e) => onDropSample(e, pad));
  // Högerklick tar bort ljudfilen
  el.addEventListener('contextmenu', (e) => {
    if (!pad.sample) return;
    e.preventDefault();
    pad.sample = null;
    renderNotePad(pad);
    log(`Ruta ${i + 1}: ljudfil borttagen`);
  });

  ui.pads.append(el);
}

function updateNotes() {
  notePads.forEach(release);
  noteScale().forEach((n, i) => { notePads[i].note = n; renderNotePad(notePads[i]); });
}

function renderNotePad(pad) {
  pad.el.classList.toggle('sample', !!pad.sample);
  pad.el.innerHTML = `${noteName(pad.note)}<small>${
    pad.sample ? pad.sampleName : `MIDI ${pad.note}`
  }</small>`;
}

async function onDropSample(e, pad) {
  e.preventDefault();
  pad.el.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!audioCtx) { log('Starta först, sedan kan du släppa ljudfiler.'); return; }
  try {
    pad.sample = await audioCtx.decodeAudioData(await file.arrayBuffer());
    pad.sampleName = file.name;
    renderNotePad(pad);
    log(`Laddade "${file.name}" till ${noteName(pad.note)}`);
  } catch {
    log(`Kunde inte läsa "${file.name}" som ljud.`);
  }
}

// ---------- Sidan "Ackord" ----------
// Voicing (avancerat läge): hur ackordets toner läggs ut. [id, namn i listan, kort namn i menyn]
const VOICINGS = [
  ['root', 'Grundläge', 'Grund'],
  ['inv1', '1:a omvändning', '1:a omv'],
  ['inv2', '2:a omvändning', '2:a omv'],
  ['inv3', '3:e omvändning', '3:e omv'],
  ['open', 'Öppen', 'Öppen'],
  ['drop2', 'Drop 2', 'Drop 2'],
];
const CHORD_SHIFTS = [[-1, 'Oktav −1'], [0, 'Oktav ±0'], [1, 'Oktav +1']];

// Alla 8 ackordval sparas, även de som inte syns när antalet är lägre.
let chords = loadChords();

function loadChords() {
  const fill = (c) => ({ voicing: 'root', shift: 0, ...c });
  try {
    const saved = JSON.parse(localStorage.getItem('hoverPadsChords'));
    if (Array.isArray(saved) && saved.length === MAX_CHORDS) return saved.map(fill);
  } catch {}
  return DEFAULT_CHORDS.map(fill);
}

const saveChords = () => localStorage.setItem('hoverPadsChords', JSON.stringify(chords));
const chordName = (c) => CHORD_ROOTS[c.root] + c.type;
const isAdvanced = () => ui.chordAdvanced.checked;
const chordSize = (c) => CHORD_INTERVALS[c.type].length;
// 3:e omvändningen finns bara för ackord med minst fyra toner
const voicingAllowed = (v, c) => v !== 'inv3' || chordSize(c) >= 4;

// Lägger om tonerna (stigande ordning in, stigande ordning ut).
function voice(notes, v) {
  const up = (i) => { notes[i] += 12; };
  const sort = () => notes.sort((a, b) => a - b);
  const inv = { inv1: 1, inv2: 2, inv3: 3 }[v];
  if (inv) {
    // Flytta den lägsta tonen upp en oktav, en gång per omvändning
    for (let k = 0; k < Math.min(inv, notes.length - 1); k++) { up(0); sort(); }
  } else if (v === 'open') {
    // Varannan ton upp en oktav: t.ex. C E G -> C G E
    notes.forEach((_, i) => { if (i % 2 === 1) up(i); });
    sort();
  } else if (v === 'drop2') {
    // Näst högsta tonen ner en oktav
    notes[notes.length - 2] -= 12;
    sort();
  }
  return notes;
}

function chordNotes(c) {
  const adv = isAdvanced();
  const base = 12 * (Number(ui.chordOctave.value) + 1 + (adv ? c.shift : 0)) + Number(c.root);
  let notes = CHORD_INTERVALS[c.type].map((i) => base + i);
  if (adv) notes = voice(notes, voicingAllowed(c.voicing, c) ? c.voicing : 'root');
  if (ui.chordBass.checked) {
    // Grundtonen i basen, alltid under resten av ackordet
    let bass = base - 12;
    while (bass >= notes[0]) bass -= 12;
    notes.unshift(bass);
  }
  return notes.map(clampNote);
}

// Rutorna på sidan Ackord: bara ackordnamnet, hela rutan spelar.
function buildChordPads() {
  closeChordPicker();
  chordPads.forEach(release);
  chordPads.length = 0;
  ui.chordPads.innerHTML = '';

  const count = Number(ui.chordCount.value);
  for (let i = 0; i < count; i++) {
    const chord = chords[i];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pad chord-pad';
    el.innerHTML = '<span class="strum"></span><span class="chord-name"></span>';
    const pad = {
      el, release: null, sample: null,
      notes: () => chordNotes(chord),
      strumNotes: () => strumNotes(chord),
      label: () => chordName(chord),
    };
    chordPads.push(pad);
    attachHover(pad, el);
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openChordPicker(i, e.clientX, e.clientY);
    });
    renderChordPad(pad);
    ui.chordPads.append(el);
  }
  buildChordEditor();
  layoutPads();
}

// Ackordvalen under fliken Inställningar: en rad per ruta (+ voicing i avancerat läge).
function buildChordEditor() {
  const box = $('chord-editor');
  const adv = isAdvanced();
  box.innerHTML = '';
  box.classList.toggle('adv', adv);
  chordPads.forEach((pad, i) => {
    const chord = chords[i];
    const row = document.createElement('div');
    row.className = 'chord-row';
    const select = (title, options, value, key, parse = (x) => x) => {
      const sel = document.createElement('select');
      sel.title = title;
      options.forEach(([v, text]) => {
        const o = new Option(text, v);
        if (key === 'voicing') o.disabled = !voicingAllowed(v, chord);
        sel.append(o);
      });
      sel.value = value;
      sel.addEventListener('change', () => {
        setChord(i, { [key]: parse(sel.value) });
        if (key === 'type') buildChordEditor(); // 3:e omvändning kan bli (o)tillgänglig
        else name.textContent = chordName(chord);
      });
      return sel;
    };
    const label = document.createElement('span');
    label.textContent = `Ruta ${i + 1}`;
    const name = document.createElement('output');
    name.textContent = chordName(chord);
    row.append(
      label,
      select('Grundton', CHORD_ROOTS.map((n, r) => [r, n]), chord.root, 'root', Number),
      select('Ackordtyp', CHORD_TYPES.map(([s, l]) => [s, l]), chord.type, 'type'),
    );
    if (adv) {
      row.append(
        select('Voicing', VOICINGS, chord.voicing, 'voicing'),
        select('Oktavläge', CHORD_SHIFTS, chord.shift, 'shift', Number),
      );
    }
    row.append(name);
    box.append(row);
  });
}

function renderChordPad(pad) {
  pad.el.querySelector('.chord-name').textContent = pad.label();
  // En prick per ton längs strängen (syns bara i formationen Strängar)
  const n = pad.strumNotes().length;
  pad.el.querySelector('.strum').innerHTML = Array.from({ length: n }, (_, k) =>
    `<i style="bottom:${((k + 0.5) / n) * 100}%"></i>`).join('');
}

// ---------- Harpa: håll inne och dra över strängarna ----------
// Ackordets toner över två oktaver, nerifrån och upp, t.ex. C E G C E G C.
function strumNotes(c) {
  const base = 12 * (Number(ui.chordOctave.value) + 1 + (isAdvanced() ? c.shift : 0)) + Number(c.root);
  const pcs = [...new Set(CHORD_INTERVALS[c.type].map((i) => i % 12))].sort((a, b) => a - b);
  const notes = [0, 12].flatMap((o) => pcs.map((p) => base + o + p));
  notes.push(base + 24);
  return notes.map(clampNote);
}

const PLUCK_MS = 450; // hur länge en knäppt ton hålls innan den klingar ut
const PLUCK_LEVEL = 0.5;
// pad: strängen man är på, idx: senaste höjd, harp: har harpläget börjat på den här strängen?
const strum = { active: false, pad: null, idx: -1, harp: false };

// Vilken ton (prick) på strängen som ligger närmast höjden y
function strumIndex(pad, y) {
  const r = pad.el.querySelector('.strum').getBoundingClientRect();
  const n = pad.strumNotes().length;
  return Math.max(0, Math.min(n - 1, Math.floor(((r.bottom - y) / r.height) * n)));
}

function pluck(pad, idx) {
  if (!audioCtx) return;
  const note = pad.strumNotes()[idx];
  const stops = [];
  if (ui.outAudio.checked) stops.push(engine.noteOn(note, PLUCK_LEVEL));
  if (ui.outMidi.checked) {
    const ch = midiChannel();
    noteOn(note, ch);
    stops.push(() => noteOff(note, ch));
  }
  setTimeout(() => stops.forEach((s) => s()), PLUCK_MS);
  const dot = pad.el.querySelectorAll('.strum i')[idx];
  if (dot) {
    dot.animate([
      { transform: 'translate(-50%, 50%) scale(2.8)', background: '#ffb547', boxShadow: '0 0 14px #ffb547' },
      { transform: 'translate(-50%, 50%) scale(1)' },
    ], { duration: 600, easing: 'ease-out' });
  }
  log(`♪ ${pad.label()}: ${noteName(note)}`);
}

function strumMove(e) {
  if (!strum.active) return;
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.chord-pad');
  const pad = chordPads.find((p) => p.el === el);
  if (!pad) { strum.pad = null; return; } // i mellanrummet mellan strängarna
  const idx = strumIndex(pad, e.clientY);
  if (pad !== strum.pad) {
    // Första anslaget på en sträng spelar hela ackordet (det sköter hover);
    // här noteras bara var på strängen man kom in.
    strum.harp = false;
  } else if (idx !== strum.idx) {
    // Man stannar på strängen och rör sig upp/ner: nu blir det harpa.
    if (!strum.harp) { release(pad); strum.harp = true; }
    // Snabb dragning: knäpp alla toner man passerat, som ett glissando
    const dir = Math.sign(idx - strum.idx);
    for (let k = strum.idx + dir, t = 0; ; k += dir, t++) {
      setTimeout(() => pluck(pad, k), t * 12);
      if (k === idx) break;
    }
  }
  strum.pad = pad;
  strum.idx = idx;
}

function setupStrum() {
  // Harpan kan också börja på bakgrunden – sedan drar man in på strängarna
  document.addEventListener('pointerdown', (e) => {
    if (document.body.dataset.tab !== 'chords' || !inPlayArea(e.target)) return;
    if (ui.formation.value !== 'strings' || picker.open) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); // ingen textmarkering när man drar
    strum.active = true;
    strum.pad = null;
    strumMove(e);
  });
  window.addEventListener('pointermove', strumMove);
  const stop = () => { strum.active = false; strum.pad = null; strum.harp = false; };
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  window.addEventListener('blur', stop);
}

const updateChordLabels = () => { chordPads.forEach(release); chordPads.forEach(renderChordPad); };

// Byt ackord på ruta i – används av både Inställningar och högerklicksmenyn.
function setChord(i, patch) {
  const pad = chordPads[i];
  if (pad) release(pad);
  Object.assign(chords[i], patch);
  if (!voicingAllowed(chords[i].voicing, chords[i])) chords[i].voicing = 'root';
  saveChords();
  if (pad) renderChordPad(pad);
}

function onAdvancedChange() {
  document.body.classList.toggle('advanced', isAdvanced());
  closeChordPicker();
  updateChordLabels();
  buildChordEditor();
}

// ---------- Högerklicksmeny: byt ackord direkt på rutan ----------
const picker = {
  el: $('chord-picker'),
  title: $('cp-title'),
  notes: $('cp-notes'),
  groups: [], // { key, buttons: [{ b, value }] }
  index: -1,
  get open() { return !this.el.hidden; },
};

function buildChordPicker() {
  const group = (boxId, key, options) => {
    const buttons = options.map(([value, text]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', () => pickChord({ [key]: value }));
      $(boxId).append(b);
      return { b, value };
    });
    picker.groups.push({ key, buttons });
  };
  group('cp-roots', 'root', CHORD_ROOTS.map((n, r) => [r, n]));
  group('cp-types', 'type', CHORD_TYPES.map(([s, l]) => [s, l]));
  group('cp-voicings', 'voicing', VOICINGS.map(([v, , short]) => [v, short]));
  group('cp-shifts', 'shift', CHORD_SHIFTS.map(([v]) => [v, v === 0 ? '±0' : v > 0 ? `+${v}` : `−${-v}`]));

  $('cp-close').addEventListener('click', closeChordPicker);
  // Klick utanför eller Esc stänger
  document.addEventListener('pointerdown', (e) => {
    if (picker.open && !picker.el.contains(e.target)) closeChordPicker();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeChordPicker(); });
}

function openChordPicker(i, x, y) {
  chordPads.forEach(release);
  chordPads.forEach((p, j) => p.el.classList.toggle('editing', j === i));
  picker.index = i;
  renderChordPicker();
  picker.el.hidden = false;
  // Lägg menyn vid muspekaren, men håll den inom fönstret
  const { offsetWidth: w, offsetHeight: h } = picker.el;
  picker.el.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`;
  picker.el.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
}

function closeChordPicker() {
  if (!picker.open) return;
  picker.el.hidden = true;
  chordPads.forEach((p) => p.el.classList.remove('editing'));
}

function renderChordPicker() {
  const c = chords[picker.index];
  picker.title.textContent = `Ruta ${picker.index + 1}: ${chordName(c)}`;
  picker.notes.textContent = chordNotes(c).map(noteName).join(' ');
  for (const { key, buttons } of picker.groups) {
    for (const { b, value } of buttons) {
      b.classList.toggle('on', String(value) === String(c[key]));
      if (key === 'voicing') b.disabled = !voicingAllowed(value, c);
    }
  }
}

function pickChord(patch) {
  setChord(picker.index, patch);
  renderChordPicker();
  buildChordEditor(); // håll listan under Inställningar i synk
}

// ---------- Ljudmotor: presets och reglage ----------
const CUSTOM = '__custom';
let synthParams;
let synthPreset;
const synthInputs = {}; // key -> { row, input, output, def }
// Ljud från presetbiblioteket laddas in i "Eget": namn + om man har skruvat efteråt
let synthLib = { name: '', edited: false };

(function loadSynth() {
  try {
    const saved = JSON.parse(localStorage.getItem('hoverPadsSynth'));
    if (saved && saved.params) {
      synthPreset = saved.preset in SYNTH_PRESETS || saved.preset === CUSTOM ? saved.preset : CUSTOM;
      synthParams = { ...SYNTH_DEFAULTS, ...saved.params };
      if (saved.lib && synthPreset === CUSTOM) synthLib = saved.lib;
      return;
    }
  } catch {}
  synthPreset = DEFAULT_PRESET;
  synthParams = presetParams(DEFAULT_PRESET);
})();

const saveSynth = () =>
  localStorage.setItem('hoverPadsSynth', JSON.stringify({ preset: synthPreset, params: synthParams, lib: synthLib }));

// Logaritmiska reglage går 0..1000 och räknas om till t.ex. 40 Hz..18 kHz.
const toSlider = (d, v) => (d.log ? Math.round(1000 * Math.log(v / d.min) / Math.log(d.max / d.min)) : v);
const fromSlider = (d, s) => {
  if (!d.log) return Number(s);
  const v = d.min * Math.pow(d.max / d.min, Number(s) / 1000);
  return v < 1 ? Number(v.toFixed(3)) : v < 100 ? Number(v.toFixed(2)) : Math.round(v);
};

function buildSynthPanel() {
  const root = $('synth-groups');
  let box;
  for (const d of SYNTH_PARAMS) {
    if (d.group) {
      box = document.createElement('fieldset');
      box.innerHTML = `<legend>${d.group}</legend>`;
      root.append(box);
    }
    const row = document.createElement('label');
    row.className = 'knob';
    row.append(d.label);
    let input;
    const output = document.createElement('output');
    if (d.options) {
      input = document.createElement('select');
      d.options.forEach(([v, text]) => input.append(new Option(text, v)));
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.min = d.log ? 0 : d.min;
      input.max = d.log ? 1000 : d.max;
      input.step = d.log ? 1 : d.step;
    }
    row.append(input);
    if (!d.options) row.append(output);
    box.append(row);
    synthInputs[d.key] = { row, input, output, def: d };

    input.addEventListener('input', () => {
      const v = d.options ? input.value : fromSlider(d, input.value);
      synthParams[d.key] = v;
      if (!d.options) output.textContent = d.fmt(v);
      engine && engine.set(d.key, v);
      if (synthPreset === CUSTOM && synthLib.name) synthLib.edited = true;
      else if (synthPreset !== CUSTOM) synthLib = { name: '', edited: false };
      synthPreset = CUSTOM;
      updateCustomLabel();
      ui.preset.value = CUSTOM;
      refreshSynthDisabled();
      saveSynth();
    });
  }
}

function syncSynthPanel() {
  for (const { input, output, def } of Object.values(synthInputs)) {
    const v = synthParams[def.key];
    input.value = def.options ? v : toSlider(def, v);
    if (!def.options) output.textContent = def.fmt(v);
  }
  refreshSynthDisabled();
}

function refreshSynthDisabled() {
  for (const [key, isOff] of Object.entries(SYNTH_DISABLED_WHEN)) {
    synthInputs[key].row.classList.toggle('off', isOff(synthParams));
  }
}

function applySynth(params, preset) {
  allPads().forEach(release);
  synthParams = { ...params };
  synthPreset = preset;
  updateCustomLabel();
  ui.preset.value = preset;
  syncSynthPanel();
  engine && engine.setParams(synthParams);
  saveSynth();
}

function randomSynth() {
  const p = { ...SYNTH_DEFAULTS };
  for (const d of SYNTH_PARAMS) {
    if (d.options) p[d.key] = d.options[Math.floor(Math.random() * d.options.length)][0];
    else p[d.key] = fromSlider(d, d.log ? Math.random() * 1000
      : Math.round((d.min + Math.random() * (d.max - d.min)) / d.step) * d.step);
  }
  // Håll slumpen spelbar: hörbar nivå, inte för lång attack, inte för mycket effekter.
  Object.assign(p, {
    osc1Level: Math.max(p.osc1Level, 0.6),
    attack: Math.min(p.attack, 0.5),
    sustain: Math.max(p.sustain, 0.3),
    cutoff: Math.max(p.cutoff, 300),
    q: Math.min(p.q, 10),
    delayFeedback: Math.min(p.delayFeedback, 0.6),
    reverbMix: Math.min(p.reverbMix, 0.6),
    drive: Math.min(p.drive, 0.6),
    unison: Math.min(p.unison, 5),
  });
  synthLib = { name: '', edited: false };
  applySynth(p, CUSTOM);
  log('Slumpade ett nytt ljud');
}

// "Eget" i presetmenyn visar vilket biblioteksljud som är inladdat
function updateCustomLabel() {
  const opt = [...ui.preset.options].find((o) => o.value === CUSTOM);
  if (opt) {
    opt.textContent = !synthLib.name ? 'Eget (ändrat)'
      : `Eget: ${synthLib.name}${synthLib.edited ? ' (ändrat)' : ''}`;
  }
  const current = synthPreset === CUSTOM ? synthLib.name : '';
  document.querySelectorAll('.lib-preset').forEach((b) =>
    b.classList.toggle('on', b.dataset.name === current));
}

// ---------- Presetbibliotek (100 ljud, presets.js) ----------
let libCategory = 'Alla';

function buildPresetLibrary() {
  const cats = $('lib-cats');
  ['Alla', ...PRESET_CATEGORIES.map((c) => c.name)].forEach((cat) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lib-cat';
    b.textContent = cat;
    b.addEventListener('click', () => { libCategory = cat; renderPresetLibrary(); });
    cats.append(b);
  });
  const list = $('lib-list');
  PRESET_LIBRARY.forEach((entry) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lib-preset';
    b.dataset.name = entry.name;
    b.dataset.cat = entry.cat;
    b.innerHTML = `<span>${entry.name}</span><small>${entry.cat}</small>`;
    b.addEventListener('click', () => loadLibraryPreset(entry, true));
    list.append(b);
  });
  // Visa kategorin för ljudet som är inladdat, annars alla
  const cur = PRESET_LIBRARY.find((e) => e.name === synthLib.name);
  if (cur && synthPreset === CUSTOM) libCategory = cur.cat;
  renderPresetLibrary();
}

function renderPresetLibrary() {
  document.querySelectorAll('.lib-cat').forEach((b) => b.classList.toggle('on', b.textContent === libCategory));
  document.querySelectorAll('.lib-preset').forEach((b) => {
    b.hidden = libCategory !== 'Alla' && b.dataset.cat !== libCategory;
  });
}

function loadLibraryPreset(entry, preview) {
  synthLib = { name: entry.name, edited: false };
  applySynth(entry.params, CUSTOM);
  log(`Eget: ${entry.name} (${entry.cat})`);
  // Provlyssna: en kort ton (C4) om ljudet är igång
  if (preview && audioCtx && ui.outAudio.checked) {
    const stop = engine.noteOn(60, 0.7);
    setTimeout(stop, 450);
  }
}

function setupSynthUi() {
  Object.keys(SYNTH_PRESETS).forEach((name) => ui.preset.append(new Option(name, name)));
  ui.preset.append(new Option('Eget (ändrat)', CUSTOM));
  buildSynthPanel();
  buildPresetLibrary();
  updateCustomLabel();
  ui.preset.value = synthPreset;
  syncSynthPanel();

  ui.preset.addEventListener('change', () => {
    if (ui.preset.value === CUSTOM) return;
    synthLib = { name: '', edited: false };
    applySynth(presetParams(ui.preset.value), ui.preset.value);
    log(`Preset: ${ui.preset.value}`);
  });

  // "Återställ" går tillbaka till senast valda preset (eller standard om ljudet är eget)
  let lastPreset = synthPreset === CUSTOM ? DEFAULT_PRESET : synthPreset;
  ui.preset.addEventListener('change', () => { if (ui.preset.value !== CUSTOM) lastPreset = ui.preset.value; });
  $('synth-reset').addEventListener('click', () => {
    // Laddat från biblioteket? Då går "Återställ" tillbaka till det biblioteksljudet.
    const lib = synthPreset === CUSTOM && PRESET_LIBRARY.find((e) => e.name === synthLib.name);
    if (lib) loadLibraryPreset(lib, false);
    else { synthLib = { name: '', edited: false }; applySynth(presetParams(lastPreset), lastPreset); }
  });
  $('synth-random').addEventListener('click', randomSynth);
}

// ---------- Flikar ----------
function showTab(tab) {
  closeChordPicker();
  allPads().forEach(release);
  document.body.dataset.tab = tab;
  document.querySelectorAll('#tabs button').forEach((b) =>
    b.classList.toggle('on', b.dataset.tab === tab)
  );
  localStorage.setItem('hoverPadsTab', tab);
  layoutPads();
}

// ---------- Formation (layout.js räknar ut positionerna) ----------
// Antal kolumner i rutnätet.
function gridColumns(container, n) {
  if (FIXED_SCREEN) {
    // Fast skärm: välj det kolumnantal som ger störst rutor på den yta som finns
    const cs = getComputedStyle(container);
    const W = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = container.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const gap = parseFloat(cs.columnGap) || 0;
    let best = 1;
    let bestSide = 0;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const side = Math.min((W - (cols - 1) * gap) / cols, (H - (rows - 1) * gap) / rows);
      if (side > bestSide + 0.5) { bestSide = side; best = cols; }
    }
    return best;
  }
  const wanted = n <= 4 ? n : n <= 8 ? Math.ceil(n / 2) : n <= 16 ? 4 : n <= 24 ? 6 : 8;
  // Men aldrig så många att rutorna blir smalare än ca 60 px med valt mellanrum
  const cs = getComputedStyle(container);
  const W = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const gap = parseFloat(cs.columnGap) || 0;
  return Math.max(1, Math.min(wanted, Math.floor((W + gap) / (60 + gap))));
}

// Knappar med en liten bild per formation; valet sparas i det dolda fältet #formation.
function buildFormationButtons() {
  const box = $('formation-buttons');
  const valid = ui.formation.value in FORMATIONS;
  if (!valid) ui.formation.value = 'grid';
  Object.entries(FORMATIONS).forEach(([value, text]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'formation-btn';
    b.dataset.value = value;
    b.setAttribute('role', 'radio');
    b.innerHTML = `${FORMATION_ICONS[value]}<span>${text}</span>`;
    b.addEventListener('click', () => {
      if (ui.formation.value === value) return;
      ui.formation.value = value;
      ui.formation.dispatchEvent(new Event('change')); // sparar och placerar om
      syncFormationButtons();
    });
    box.append(b);
  });
  syncFormationButtons();
}

function syncFormationButtons() {
  document.querySelectorAll('.formation-btn').forEach((b) => {
    const on = b.dataset.value === ui.formation.value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
}

function layoutPads() {
  const f = ui.formation.value;
  ui.pads.dataset.formation = f;
  ui.chordPads.dataset.formation = f;

  const tab = document.body.dataset.tab;
  const container = tab === 'notes' ? ui.pads : tab === 'chords' ? ui.chordPads : null;
  if (!container) return; // fliken Inställningar: inget att placera
  const pads = container === ui.pads ? notePads : chordPads;
  pads.forEach((p) => p.el.removeAttribute('style'));

  if (f === 'grid') {
    container.style.height = '';
    container.style.gridTemplateColumns = `repeat(${gridColumns(container, pads.length)}, 1fr)`;
    return;
  }

  let height;
  if (FIXED_SCREEN) {
    // Fast skärm: ytan får den höjd som blir över (CSS flex), ingen scroll
    container.style.height = '';
    height = container.clientHeight;
  } else {
    // Fyll höjden ner till sidfoten
    const top = container.getBoundingClientRect().top + window.scrollY;
    const footer = document.querySelector('footer').offsetHeight;
    height = Math.max(360, window.innerHeight - top - footer - 8);
    container.style.height = `${height}px`;
  }
  container.style.gridTemplateColumns = '';

  const cs = getComputedStyle(container);
  const left = parseFloat(cs.paddingLeft);
  const topPad = parseFloat(cs.paddingTop);
  const W = container.clientWidth - left - parseFloat(cs.paddingRight);
  const H = height - topPad - parseFloat(cs.paddingBottom);
  const rects = LAYOUTS[f](pads.length, W, H, Number(ui.padGap.value));
  pads.forEach((p, i) => {
    const r = rects[i];
    Object.assign(p.el.style, {
      left: `${left + r.x}px`,
      top: `${topPad + r.y}px`,
      width: `${r.w}px`,
      height: `${r.h}px`,
      fontSize: `${Math.max(11, r.font)}px`,
    });
    if (r.clip) {
      // Formen (t.ex. en ringsektor) – klippningen styr också var man träffar rutan
      p.el.style.clipPath = r.clip;
      p.el.style.webkitClipPath = r.clip;
    }
    if (r.label) {
      // Flytta texten till punkten label genom att lägga padding på rätt sidor
      const { x, y } = r.label;
      p.el.style.padding = `${Math.max(0, 2 * y - r.h)}px ${Math.max(0, r.w - 2 * x)}px `
        + `${Math.max(0, r.h - 2 * y)}px ${Math.max(0, 2 * x - r.w)}px`;
    }
  });
  // Viloplatsen i mitten av ringen markeras med en svag cirkel
  if (rects.hole) {
    container.style.setProperty('--hole-x', `${left + rects.hole.x}px`);
    container.style.setProperty('--hole-y', `${topPad + rects.hole.y}px`);
    container.style.setProperty('--hole-r', `${rects.hole.r}px`);
  }
}

function log(msg) { ui.log.textContent = msg; }

// ---------- Inställningar ----------
const SAVED = ['outAudio', 'outMidi', 'playMode', 'padGap', 'formation', 'noteCount', 'root', 'octave', 'scale',
  'chordCount', 'chordOctave', 'chordBass', 'chordAdvanced', 'volume', 'midiCh', 'velocity'];

function loadSettings() {
  const s = JSON.parse(localStorage.getItem('hoverPads') || '{}');
  for (const k of SAVED) {
    if (!(k in s)) continue;
    if (ui[k].type === 'checkbox') ui[k].checked = s[k];
    else ui[k].value = s[k];
  }
}

function saveSettings() {
  const s = {};
  for (const k of SAVED) s[k] = ui[k].type === 'checkbox' ? ui[k].checked : ui[k].value;
  localStorage.setItem('hoverPads', JSON.stringify(s));
  localStorage.setItem('midiOut', ui.midiOut.value);
}

// Tomrum mellan rutorna – där kan musen röra sig utan att något spelas.
function applyGap() {
  document.documentElement.style.setProperty('--pad-gap', `${ui.padGap.value}px`);
  $('gap-value').textContent = `${ui.padGap.value} px`;
  layoutPads();
}

// ---------- Uppstart ----------
// Mobil och iPad: hela sidan ryms på skärmen och scrollar inte (bara Inställningar scrollar inuti).
// (?fast i adressen slår på det även på dator.)
const FIXED_SCREEN = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1
  || new URLSearchParams(location.search).has('fast');
document.documentElement.classList.toggle('fixed-screen', FIXED_SCREEN);
NOTE_NAMES.forEach((n, i) => ui.root.append(new Option(n, i)));
for (let n = NOTE_COUNT_MIN; n <= NOTE_COUNT_MAX; n++) ui.noteCount.append(new Option(n, n));
ui.noteCount.value = 16;
loadSettings();
buildFormationButtons();
document.body.classList.toggle('advanced', isAdvanced());
applyGap();
setupSynthUi();
buildNotePads();
buildChordPicker();
buildChordPads();
setupStrum();
setupTouch();
showTab(localStorage.getItem('hoverPadsTab') || 'notes');

for (const k of SAVED) ui[k].addEventListener('change', saveSettings);
[ui.root, ui.octave, ui.scale].forEach((el) => el.addEventListener('change', updateNotes));
ui.chordCount.addEventListener('change', buildChordPads);
ui.noteCount.addEventListener('change', buildNotePads);
[ui.chordOctave, ui.chordBass].forEach((el) => el.addEventListener('change', updateChordLabels));
ui.padGap.addEventListener('input', applyGap);
ui.formation.addEventListener('change', layoutPads);
ui.chordAdvanced.addEventListener('change', onAdvancedChange);
let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(layoutPads);
});
ui.volume.addEventListener('input', () => engine && engine.setVolume(Number(ui.volume.value)));
ui.midiOut.addEventListener('change', () => { panic(); updateMidiStatus(); saveSettings(); });
ui.outMidi.addEventListener('change', () => { if (!ui.outMidi.checked) panic(); });
ui.midiCh.addEventListener('change', panic);
ui.panic.addEventListener('click', panic);
document.querySelectorAll('#tabs button').forEach((b) =>
  b.addEventListener('click', () => showTab(b.dataset.tab))
);
window.addEventListener('blur', () => { fingers.clear(); allPads().forEach(release); });

$('start-btn').addEventListener('click', async () => {
  initAudio();
  $('start-overlay').classList.add('hidden');
  await initMidi();
});
