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

const PAD_COUNT = 16;
const ONESHOT_MS = 300;

const $ = (id) => document.getElementById(id);
const ui = {
  outAudio: $('out-audio'),
  outMidi: $('out-midi'),
  playMode: $('play-mode'),
  padGap: $('pad-gap'),
  root: $('root'),
  octave: $('octave'),
  scale: $('scale'),
  chordCount: $('chord-count'),
  chordOctave: $('chord-octave'),
  chordBass: $('chord-bass'),
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
function attachHover(pad, hitEl) {
  hitEl.addEventListener('pointerenter', () => trigger(pad));
  hitEl.addEventListener('pointerleave', () => {
    // I "kort ton"-läget släpps tonen av en timer i stället
    if (ui.playMode.value === 'hold') release(pad);
  });
  // Pekskärm: släpp "pointer capture" så enter/leave fungerar när fingret glider
  hitEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') hitEl.releasePointerCapture(e.pointerId);
  });
}

function trigger(pad) {
  if (!audioCtx) return; // inte startat än
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
  return Array.from({ length: PAD_COUNT }, (_, i) =>
    clampNote(base + 12 * Math.floor(i / scale.length) + scale[i % scale.length])
  );
}

function buildNotePads() {
  for (let i = 0; i < PAD_COUNT; i++) {
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
  updateNotes();
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
// Alla 8 ackordval sparas, även de som inte syns när antalet är lägre.
let chords = loadChords();

function loadChords() {
  try {
    const saved = JSON.parse(localStorage.getItem('hoverPadsChords'));
    if (Array.isArray(saved) && saved.length === MAX_CHORDS) return saved;
  } catch {}
  return DEFAULT_CHORDS.map((c) => ({ ...c }));
}

const saveChords = () => localStorage.setItem('hoverPadsChords', JSON.stringify(chords));
const chordName = (c) => CHORD_ROOTS[c.root] + c.type;

function chordNotes(c) {
  const base = 12 * (Number(ui.chordOctave.value) + 1) + Number(c.root);
  const notes = CHORD_INTERVALS[c.type].map((i) => base + i);
  if (ui.chordBass.checked) notes.unshift(base - 12); // grundton en oktav ner
  return notes.map(clampNote);
}

function buildChordPads() {
  chordPads.forEach(release);
  chordPads.length = 0;
  ui.chordPads.innerHTML = '';

  const count = Number(ui.chordCount.value);
  const cols = count <= 4 ? count : Math.ceil(count / 2);
  ui.chordPads.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let i = 0; i < count; i++) {
    const chord = chords[i];
    const el = document.createElement('div');
    el.className = 'pad chord-pad';
    el.innerHTML = `
      <div class="pad-hit"><span class="chord-name"></span><small></small></div>
      <div class="pad-edit">
        <select class="sel-root" title="Grundton"></select>
        <select class="sel-type" title="Ackordtyp"></select>
      </div>`;
    const hit = el.querySelector('.pad-hit');
    const selRoot = el.querySelector('.sel-root');
    const selType = el.querySelector('.sel-type');
    CHORD_ROOTS.forEach((n, r) => selRoot.append(new Option(n, r)));
    CHORD_TYPES.forEach(([s, label]) => selType.append(new Option(label, s)));
    selRoot.value = chord.root;
    selType.value = chord.type;

    const pad = {
      el, release: null, sample: null,
      notes: () => chordNotes(chord),
      label: () => chordName(chord),
    };
    chordPads.push(pad);
    attachHover(pad, hit); // bara den stora ytan spelar, inte väljarna

    const onPick = () => {
      release(pad);
      chord.root = Number(selRoot.value);
      chord.type = selType.value;
      saveChords();
      renderChordPad(pad);
    };
    selRoot.addEventListener('change', onPick);
    selType.addEventListener('change', onPick);

    renderChordPad(pad);
    ui.chordPads.append(el);
  }
}

function renderChordPad(pad) {
  pad.el.querySelector('.chord-name').textContent = pad.label();
  pad.el.querySelector('small').textContent = pad.notes().map(noteName).join(' ');
}

const updateChordLabels = () => { chordPads.forEach(release); chordPads.forEach(renderChordPad); };

// ---------- Ljudmotor: presets och reglage ----------
const CUSTOM = '__custom';
let synthParams;
let synthPreset;
const synthInputs = {}; // key -> { row, input, output, def }

(function loadSynth() {
  try {
    const saved = JSON.parse(localStorage.getItem('hoverPadsSynth'));
    if (saved && saved.params) {
      synthPreset = saved.preset in SYNTH_PRESETS || saved.preset === CUSTOM ? saved.preset : CUSTOM;
      synthParams = { ...SYNTH_DEFAULTS, ...saved.params };
      return;
    }
  } catch {}
  synthPreset = DEFAULT_PRESET;
  synthParams = presetParams(DEFAULT_PRESET);
})();

const saveSynth = () =>
  localStorage.setItem('hoverPadsSynth', JSON.stringify({ preset: synthPreset, params: synthParams }));

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
      synthPreset = CUSTOM;
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
  synthParams = params;
  synthPreset = preset;
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
  applySynth(p, CUSTOM);
  log('Slumpade ett nytt ljud');
}

function setupSynthUi() {
  Object.keys(SYNTH_PRESETS).forEach((name) => ui.preset.append(new Option(name, name)));
  ui.preset.append(new Option('Eget (ändrat)', CUSTOM));
  buildSynthPanel();
  ui.preset.value = synthPreset;
  syncSynthPanel();

  ui.preset.addEventListener('change', () => {
    if (ui.preset.value === CUSTOM) return;
    applySynth(presetParams(ui.preset.value), ui.preset.value);
    log(`Preset: ${ui.preset.value}`);
  });

  const toggle = $('synth-toggle');
  const showPanel = (open) => {
    $('synth').hidden = !open;
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = open ? 'Ljudmotor ▾' : 'Ljudmotor ▸';
    localStorage.setItem('hoverPadsSynthOpen', open ? '1' : '');
  };
  toggle.addEventListener('click', () => showPanel($('synth').hidden));
  showPanel(!!localStorage.getItem('hoverPadsSynthOpen'));

  // "Återställ" går tillbaka till senast valda preset (eller standard om ljudet är eget)
  let lastPreset = synthPreset === CUSTOM ? DEFAULT_PRESET : synthPreset;
  ui.preset.addEventListener('change', () => { if (ui.preset.value !== CUSTOM) lastPreset = ui.preset.value; });
  $('synth-reset').addEventListener('click', () => applySynth(presetParams(lastPreset), lastPreset));
  $('synth-random').addEventListener('click', randomSynth);
}

// ---------- Flikar ----------
function showTab(tab) {
  allPads().forEach(release);
  document.body.dataset.tab = tab;
  document.querySelectorAll('#tabs button').forEach((b) =>
    b.classList.toggle('on', b.dataset.tab === tab)
  );
  localStorage.setItem('hoverPadsTab', tab);
}

function log(msg) { ui.log.textContent = msg; }

// ---------- Inställningar ----------
const SAVED = ['outAudio', 'outMidi', 'playMode', 'padGap', 'root', 'octave', 'scale',
  'chordCount', 'chordOctave', 'chordBass', 'volume', 'midiCh', 'velocity'];

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
}

// ---------- Uppstart ----------
NOTE_NAMES.forEach((n, i) => ui.root.append(new Option(n, i)));
loadSettings();
applyGap();
setupSynthUi();
buildNotePads();
buildChordPads();
showTab(localStorage.getItem('hoverPadsTab') || 'notes');

for (const k of SAVED) ui[k].addEventListener('change', saveSettings);
[ui.root, ui.octave, ui.scale].forEach((el) => el.addEventListener('change', updateNotes));
ui.chordCount.addEventListener('change', buildChordPads);
[ui.chordOctave, ui.chordBass].forEach((el) => el.addEventListener('change', updateChordLabels));
ui.padGap.addEventListener('input', applyGap);
ui.volume.addEventListener('input', () => engine && engine.setVolume(Number(ui.volume.value)));
ui.midiOut.addEventListener('change', () => { panic(); updateMidiStatus(); saveSettings(); });
ui.outMidi.addEventListener('change', () => { if (!ui.outMidi.checked) panic(); });
ui.midiCh.addEventListener('change', panic);
ui.panic.addEventListener('click', panic);
document.querySelectorAll('#tabs button').forEach((b) =>
  b.addEventListener('click', () => showTab(b.dataset.tab))
);
window.addEventListener('blur', () => allPads().forEach(release));

$('start-btn').addEventListener('click', async () => {
  initAudio();
  $('start-overlay').classList.add('hidden');
  await initMidi();
});
