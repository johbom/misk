// Sidan Ackord: ackord, voicing, färger, harpa och högerklicksmeny.

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

// Fyller i det som saknas i äldre sparade ackord
function normalizeChord(c, i) {
  return { voicing: 'root', shift: 0, color: CHORD_PALETTE[i], ...c };
}

function loadChords() {
  try {
    const saved = JSON.parse(localStorage.getItem('hoverPadsChords'));
    if (Array.isArray(saved) && saved.length === MAX_CHORDS) return saved.map(normalizeChord);
  } catch {}
  return DEFAULT_CHORDS.map(normalizeChord);
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
      chord,
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
    // Färg för just det här ackordet
    const color = document.createElement('input');
    color.type = 'color';
    color.title = 'Färg';
    color.value = chord.color || '#5b6078';
    color.classList.toggle('none', !chord.color);
    color.addEventListener('input', () => {
      chords[i].color = color.value;
      color.classList.remove('none');
      saveChords();
      paintChordPad(pad);
      name.style.color = color.value;
    });
    name.style.color = chord.color || '';
    row.append(color, name);
    box.append(row);
  });
}

function renderChordPad(pad) {
  pad.el.querySelector('.chord-name').textContent = pad.label();
  paintChordPad(pad);
  // En prick per ton längs strängen (syns bara i formationen Strängar)
  const n = pad.strumNotes().length;
  pad.el.querySelector('.strum').innerHTML = Array.from({ length: n }, (_, k) =>
    `<i style="bottom:${((k + 0.5) / n) * 100}%"></i>`).join('');
}

// Ackordets egen färg (tom = ingen färg). Sätts som CSS-variabler som style.css använder.
function paintChordPad(pad) {
  const hex = pad.chord.color;
  pad.el.classList.toggle('colored', !!hex);
  if (!hex) return;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  pad.el.style.setProperty('--c', hex);
  pad.el.style.setProperty('--c-rgb', `${r}, ${g}, ${b}`);
  // Mörk text på ljusa färger när rutan lyser
  pad.el.style.setProperty('--c-ink', 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1a1206' : '#fff');
}

function setChordColors(colors) {
  colors.forEach((c, i) => { chords[i].color = c; });
  saveChords();
  chordPads.forEach(paintChordPad);
  buildChordEditor();
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
  if (dot && !ui.reduceMotion.checked) {
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
    if (ui.formation.value !== 'strings' || picker.open || scanning()) return;
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
  if (document.body.classList.contains('locked')) return; // låst spelyta: ingen meny
  chordPads.forEach(release);
  chordPads.forEach((p, j) => p.el.classList.toggle('editing', j === i));
  picker.index = i;
  renderChordPicker();
  picker.el.hidden = false;
  // Lägg menyn vid muspekaren, men håll den inom fönstret
  const { offsetWidth: w, offsetHeight: h } = picker.el;
  // (zoom = vald storlek på reglage; positionen räknas i menyns egen skala)
  const z = parseFloat(getComputedStyle(picker.el).zoom) || 1;
  picker.el.style.left = `${Math.max(8, Math.min(x, innerWidth - w * z - 8)) / z}px`;
  picker.el.style.top = `${Math.max(8, Math.min(y, innerHeight - h * z - 8)) / z}px`;
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
