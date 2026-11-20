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
// Baston (avancerat läge): -1 = ackordets grundton, annars en egen ton (snedstrecksackord, t.ex. C/E)
const BASS_ROOT = -1;
const BASS_OPTIONS = [[BASS_ROOT, 'Grundton'], ...CHORD_ROOTS.map((n, r) => [r, n])];

// Alla 8 ackordval sparas, även de som inte syns när antalet är lägre.
let chords = loadChords();

// Fyller i det som saknas i äldre sparade ackord
function normalizeChord(c, i) {
  return { voicing: 'root', shift: 0, bass: BASS_ROOT, color: CHORD_PALETTE[i], ...c };
}

function loadChords() {
  try {
    const saved = JSON.parse(localStorage.getItem('hoverPadsChords'));
    if (Array.isArray(saved) && saved.length === MAX_CHORDS) return saved.map(normalizeChord);
  } catch {}
  return DEFAULT_CHORDS.map(normalizeChord);
}

const saveChords = () => localStorage.setItem('hoverPadsChords', JSON.stringify(chords));
const isAdvanced = () => ui.chordAdvanced.checked;
// Egen baston gäller i avancerat läge, och bara om den skiljer sig från grundtonen
const slashBass = (c) => (isAdvanced() && c.bass >= 0 && c.bass !== Number(c.root) ? c.bass : null);
const chordName = (c) => {
  const b = slashBass(c);
  return CHORD_ROOTS[c.root] + c.type + (b === null ? '' : `/${CHORD_ROOTS[b]}`);
};
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

// Slumpad voicing (Inställningar → Ackord): varje anslag läggs ackordet på ett nytt sätt, men basen är
// alltid samma ton. Treklangen (grundton, ters, kvint – eller sus/dim/aug) i grundläge, 1:a eller 2:a
// omvändning, och varje färgton (sjuan, sexan, nian …) antingen nedflyttad inne i ackordet (närmast
// ovanför ackordets lägsta ton) eller ovanpå hela läget. Samma läge två gånger i rad undviks.
// Ackordet hålls runt samma tonläge: börjar läget en kvint eller mer ovanför grundtonen läggs det en oktav
// lägre, om det fortfarande ryms ovanför basen (bass = bastonen, som aldrig flyttas).
const lastRandomVoicing = new WeakMap(); // ackord -> nyckel för förra läget
function voiceRandom(c, base, bass) {
  const iv = CHORD_INTERVALS[c.type];
  const triad = iv.slice(0, 3);
  const colors = iv.slice(3);
  const pick = () => {
    const inv = Math.floor(Math.random() * Math.min(3, triad.length));
    const inside = colors.map(() => Math.random() < 0.5);
    return { inv, inside, key: `${inv}:${inside.map(Number).join('')}` };
  };
  let v = pick();
  // (förra läget igen: ett nytt försök – ger fler olika lägen i följd, men bara om det finns fler)
  if (v.key === lastRandomVoicing.get(c) && (triad.length > 1 || colors.length)) v = pick();
  if (v.key === lastRandomVoicing.get(c)) v = pick();
  lastRandomVoicing.set(c, v.key);
  const notes = triad.map((i) => base + i);
  for (let k = 0; k < v.inv; k++) { notes[0] += 12; notes.sort((a, b) => a - b); }
  const low = notes[0];
  const top = notes[notes.length - 1];
  colors.forEach((i, k) => {
    // Inne i ackordet: första oktaven ovanför den lägsta tonen. Ovanpå: första oktaven ovanför den högsta.
    const floor = v.inside[k] ? low : top;
    let n = base + (i % 12);
    while (n <= floor) n += 12;
    if (notes.includes(n)) n += 12; // (ingen dubblerad ton)
    notes.push(n);
  });
  notes.sort((a, b) => a - b);
  if (notes[0] - base >= 7 && notes[0] - 12 > bass) return notes.map((n) => n - 12);
  return notes;
}

function chordNotes(c) {
  const adv = isAdvanced();
  const base = 12 * (Number(ui.chordOctave.value) + 1 + (adv ? c.shift : 0)) + Number(c.root);
  const random = ui.chordRandom.checked;
  const slash = slashBass(c);
  let notes = CHORD_INTERVALS[c.type].map((i) => base + i);
  if (random) {
    // Slumpad voicing har alltid basen, och alltid samma bas (den håller ihop ackordet när resten byter läge)
    const bass = base - 12 + (slash === null ? 0 : slash - Number(c.root));
    return [bass, ...voiceRandom(c, base, bass)].map(clampNote);
  }
  if (adv) notes = voice(notes, voicingAllowed(c.voicing, c) ? c.voicing : 'root');
  // Basen: grundtonen (om Bas är på) eller en vald egen baston (alltid), under resten av ackordet.
  if (slash !== null || ui.chordBass.checked) {
    let bass = base - 12 + (slash === null ? 0 : slash - Number(c.root));
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
  renderPadKeys();
}

// Ackordvalen under fliken Inställningar: ett kort per ruta.
// Överst det som hör ihop med hur rutan ser ut (nummer, namn, färg), under det ackordvalen.
function buildChordEditor() {
  const box = $('chord-editor');
  const adv = isAdvanced();
  box.innerHTML = '';
  box.classList.toggle('adv', adv);
  chordPads.forEach((pad, i) => {
    const chord = chords[i];
    const card = document.createElement('div');
    card.className = 'chord-row';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `Ackord ${i + 1}`);

    // Huvud: nummer, ackordnamn och färg tätt ihop
    const head = document.createElement('div');
    head.className = 'cr-head';
    const num = document.createElement('span');
    num.className = 'cr-num';
    num.textContent = i + 1;
    const name = document.createElement('output');
    name.className = 'cr-name';
    name.textContent = chordName(chord);
    const color = document.createElement('input');
    color.type = 'color';
    color.title = `Färg för ackord ${i + 1}`;
    color.value = chord.color || '#5b6078';
    color.classList.toggle('none', !chord.color);
    const paint = () => {
      card.style.setProperty('--cr', chord.color || 'var(--border)');
      name.style.color = chord.color || '';
    };
    color.addEventListener('input', () => {
      chords[i].color = color.value;
      color.classList.remove('none');
      saveChords();
      paintChordPad(pad);
      paint();
    });
    head.append(num, name, color);

    // Ackordvalen, med en liten rubrik över varje
    const fields = document.createElement('div');
    fields.className = 'cr-fields';
    const field = (title, options, value, key, parse = (x) => x) => {
      const label = document.createElement('label');
      label.className = `cr-field cr-${key}`;
      const cap = document.createElement('small');
      cap.textContent = title;
      const sel = document.createElement('select');
      sel.title = `${title}, ackord ${i + 1}`;
      options.forEach(([v, text]) => {
        const o = new Option(text, v);
        if (key === 'voicing') o.disabled = !voicingAllowed(v, chord);
        sel.append(o);
      });
      sel.value = value;
      // Slumpad voicing (Inställningar → Ackord) gäller i stället för ackordets egen voicing
      if (key === 'voicing' && ui.chordRandom.checked) { sel.disabled = true; sel.title = t('Slumpad voicing är på'); }
      sel.addEventListener('change', () => {
        setChord(i, { [key]: parse(sel.value) });
        if (key === 'type') buildChordEditor(); // 3:e omvändning kan bli (o)tillgänglig
        else name.textContent = chordName(chord);
      });
      label.append(cap, sel);
      fields.append(label);
    };
    field('Grundton', CHORD_ROOTS.map((n, r) => [r, n]), chord.root, 'root', Number);
    field('Typ', CHORD_TYPES.map(([suf, l]) => [suf, l]), chord.type, 'type');
    if (adv) {
      field('Voicing', VOICINGS, chord.voicing, 'voicing');
      field('Oktavläge', CHORD_SHIFTS, chord.shift, 'shift', Number);
      field('Bas', BASS_OPTIONS, chord.bass, 'bass', Number);
    }

    paint();
    card.append(head, fields);
    box.append(card);
  });
}

function renderChordPad(pad) {
  pad.el.querySelector('.chord-name').textContent = pad.label();
  paintChordPad(pad);
  // En prick per ton längs strängen (syns bara i formationen Strängar)
  const n = pad.strumNotes().length;
  pad.el.querySelector('.strum').innerHTML = Array.from({ length: n }, (_, k) =>
    `<i style="--k:${(k + 0.5) / n}"></i>`).join(''); // läget sätts i CSS (lodrätt eller vågrätt)
  renderPadKeys(); // ackordnamnet i listan över tangenter (Hjälpmedel → Tangentbord)
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

// Vilken ton (prick) på strängen som ligger närmast pekaren: nerifrån och upp på lodräta strängar,
// från vänster till höger på vågräta
// strumFloat: läget i "prickar" (0 = nedersta/vänstra kanten, n = översta/högra), strumIndex: pricken
function strumFloat(pad, e) {
  const r = pad.el.querySelector('.strum').getBoundingClientRect();
  const n = pad.strumNotes().length;
  const pos = ui.stringDir.value === 'h' ? (e.clientX - r.left) / r.width : (r.bottom - e.clientY) / r.height;
  return pos * n;
}
function strumIndex(pad, e) {
  return Math.max(0, Math.min(pad.strumNotes().length - 1, Math.floor(strumFloat(pad, e))));
}
// Man måste in en bit på nästa tons del av strängen innan den knäpps, så att en pekare
// (eller blick) som darrar vid gränsen inte knäpper samma två toner om och om igen
const STRUM_HYST = 0.2;

// Mus (eller penna) utan nedtryckt knapp: harpan spelas också genom att bara föra pekaren
// längs strängen – ackordet låter när man kommer in, tonerna knäpps när man rör sig längs den.
// Inte med aktiveringstid (ögonprofilerna), där varje ruta ska vänta in blicken.
function hoverHarpOk(e) {
  return e.pointerType !== 'touch' && e.buttons === 0 && !ms(ui.dwell)
    && document.body.dataset.tab === 'chords' && ui.formation.value === 'strings'
    && !picker.open && !scanning() && inPlayArea(e.target);
}

function pluck(pad, idx) {
  if (!audioCtx) return;
  const note = pad.strumNotes()[idx];
  const stops = [];
  if (ui.outAudio.checked) {
    const s = engines.chords.noteOn(note, PLUCK_LEVEL);
    posForVoice(pad, s); // läge på rutan: tvärs över strängen
    stops.push(s);
  }
  if (ui.outMidi.checked) {
    const ch = midiChannel();
    noteOn(note, ch);
    stops.push(() => noteOff(note, ch));
  }
  harpDebug(`knäpp ${pad.label()} ton ${noteName(note)} (ljud ${ui.outAudio.checked ? audioCtx.state : 'av'})`);
  const oscStop = oscPluck(note);
  if (oscStop) stops.push(oscStop);
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

// Felsökning: öppna sidan med #harpdebug så visas vad harpan ser (pekare, sträng, ton) överst
const HARP_DEBUG = location.hash.includes('harpdebug');
const harpLines = [];
let harpMoves = 0;
const elName = (el) => (el instanceof Element ? el.getAttribute('class') || el.tagName.toLowerCase() : '-');
function harpDebug(msg) {
  if (!HARP_DEBUG) return;
  let box = document.getElementById('harp-debug');
  if (!box) {
    box = document.createElement('pre');
    box.id = 'harp-debug';
    box.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:99;margin:0;padding:8px;'
      + 'background:rgba(0,0,0,.85);color:#7be3a0;font:12px/1.35 ui-monospace,Menlo,monospace;'
      + 'pointer-events:none;white-space:pre-wrap;max-height:40vh;overflow:hidden;border-radius:8px';
    document.body.append(box);
  }
  harpLines.push(`${(performance.now() / 1000).toFixed(2)} ${msg}`);
  if (harpLines.length > 14) harpLines.shift();
  box.textContent = `Harpa (felsökning) · v${document.querySelector('script[src*="main.js"]')?.src.match(/v=(\d+)/)?.[1]}\n`
    + `${navigator.userAgent}\n${harpLines.join('\n')}`;
}

function strumMove(e) {
  if (!strum.active && !hoverHarpOk(e)) {
    // Pekaren lämnade spelytan (eller harpan gäller inte här): börja om nästa gång
    if (strum.pad) { strum.pad = null; strum.harp = false; }
    return;
  }
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.chord-pad');
  const pad = chordPads.find((p) => p.el === el);
  if (HARP_DEBUG && (harpMoves++ % 8 === 0 || pad !== strum.pad)) {
    harpDebug(`move ${e.type} ${e.pointerType} buttons=${e.buttons} x=${Math.round(e.clientX)} y=${Math.round(e.clientY)} `
      + `under=${elName(document.elementFromPoint(e.clientX, e.clientY))} sträng=${pad ? pad.label() : '-'}`
      + `${pad ? ` idx=${strumIndex(pad, e)}` : ''}`);
  }
  if (!pad) { strum.pad = null; return; } // i mellanrummet mellan strängarna
  let idx = strumIndex(pad, e);
  const f = strumFloat(pad, e);
  if (pad === strum.pad && strum.idx >= 0 && f > strum.idx - STRUM_HYST && f < strum.idx + 1 + STRUM_HYST) idx = strum.idx;
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
    harpDebug(`down ${e.pointerType} button=${e.button} buttons=${e.buttons} mål=${elName(e.target)} `
      + `flik=${document.body.dataset.tab} spelyta=${inPlayArea(e.target)} formation=${ui.formation.value} `
      + `meny=${picker.open} stegning=${scanning()} ljud=${audioCtx ? audioCtx.state : 'inte startat'}`);
    if (document.body.dataset.tab !== 'chords' || !inPlayArea(e.target)) return;
    if (ui.formation.value !== 'strings' || picker.open || scanning()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); // ingen textmarkering när man drar
    strum.active = true;
    strum.pad = null;
    harpDebug('harpan aktiv (håll inne och dra)');
    strumMove(e);
  });
  window.addEventListener('pointermove', strumMove);
  const stop = (e) => {
    if (strum.active) harpDebug(`slut: ${e.type}${e.pointerType ? ` ${e.pointerType}` : ''}`);
    strum.active = false; strum.pad = null; strum.harp = false;
  };
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  window.addEventListener('blur', stop);
  if (HARP_DEBUG) {
    ['dragstart', 'selectstart', 'contextmenu', 'lostpointercapture'].forEach((t) =>
      window.addEventListener(t, (e) => harpDebug(`${t} på ${elName(e.target)}`), true));
    harpDebug('på – välj Ackord och Strängar, håll inne och dra längs en sträng');
  }
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
  group('cp-basses', 'bass', BASS_OPTIONS.map(([v, text]) => [v, v === BASS_ROOT ? 'Samma som grundtonen' : text]));

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
  picker.notes.textContent = chordNotes(c).map(noteName).join(' ') + (ui.chordRandom.checked ? ` · ${t('slumpas varje gång')}` : '');
  for (const { key, buttons } of picker.groups) {
    for (const { b, value } of buttons) {
      b.classList.toggle('on', String(value) === String(c[key]));
      if (key === 'voicing') b.disabled = !voicingAllowed(value, c) || ui.chordRandom.checked;
    }
  }
}

function pickChord(patch) {
  setChord(picker.index, patch);
  renderChordPicker();
  buildChordEditor(); // håll listan under Inställningar i synk
}

// ---------- Ackorden följer tonarten ----------
// Byter man grundton eller skala – i tonartsrutan, under Instrument eller i guiden – följer ackorden med.
// Ett ackord på ett skalsteg byggs om på samma steg i den nya skalan (I V vi IV i C dur → i v VI iv i
// C moll: Cm Gm A♭ Fm), med samma sorts ackord (treklang, sjuackord, sexackord …). Ackord utanför skalan
// (t.ex. E7 eller B♭ i C dur) och sus-ackord behåller sin typ och flyttas bara med grundtonen. Pentatonisk räknas som dur och
// blues som moll; kromatisk ändrar inga ackordtyper.
const KEY_PARENT = { major: 'major', pentatonic: 'major', minor: 'minor', blues: 'minor' };
const PARENT_STEPS = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const TRIAD_TYPE = { '4,7': '', '3,7': 'm', '3,6': 'dim', '4,8': 'aug' };
const SEVENTH_TYPE = { '4,7,11': 'maj7', '4,7,10': '7', '3,7,10': 'm7', '3,6,10': 'm7b5', '3,6,9': 'dim7', '3,7,11': 'm7' };
const DIM_TYPES = new Set(['dim', 'dim7', 'm7b5']);
const CHORD_FAMILY = {
  '': 'triad', m: 'triad', dim: 'triad', aug: 'triad',
  7: 'seventh', maj7: 'seventh', m7: 'seventh', m7b5: 'seventh', dim7: 'seventh',
  6: 'six', m6: 'six', 9: 'ninth', add9: 'add9',
};

// Ackordtypen på skalsteg d i skalan steps, i samma familj som type
function diatonicType(steps, d, type) {
  const iv = (k) => (steps[(d + k) % 7] - steps[d] + 12) % 12;
  const triad = TRIAD_TYPE[`${iv(2)},${iv(4)}`] ?? '';
  const minor = triad === 'm';
  const dim = triad === 'dim';
  switch (CHORD_FAMILY[type]) {
    case 'triad': return triad;
    case 'seventh': return SEVENTH_TYPE[`${iv(2)},${iv(4)},${iv(6)}`] ?? type;
    case 'six': return dim ? 'dim' : minor ? 'm6' : '6';
    case 'ninth': return dim ? 'm7b5' : minor ? 'm7' : '9';
    case 'add9': return dim ? 'dim' : minor ? 'm' : 'add9';
    default: return type; // sus2, sus4: bara grundtonen flyttas
  }
}

function rekeyChords(list, fromRoot, fromScale, toRoot, toScale) {
  const from = PARENT_STEPS[KEY_PARENT[fromScale]];
  const to = PARENT_STEPS[KEY_PARENT[toScale]];
  const sameMode = !from || !to || from === to;
  const move = (r) => {
    const i = ((r - fromRoot) % 12 + 12) % 12;
    const d = sameMode ? -1 : from.indexOf(i);
    return { root: (toRoot + (d >= 0 ? to[d] : i)) % 12, d };
  };
  return list.map((c) => {
    const { root, d } = move(Number(c.root));
    // Bara ackord som hör till skalan byter typ. Ett annat ackord på ett skalsteg (t.ex. E7 i C dur,
    // dominanten till Am) flyttas med steget men behåller sin typ: E7 → E♭7 i C moll (dominanten till A♭).
    const diatonic = d >= 0 && diatonicType(from, d, c.type) === c.type;
    let type = diatonic ? diatonicType(to, d, c.type) : c.type;
    // Inget ackord görs om till förminskat (vii° i dur, ii° i moll används sällan): det står kvar som det
    // var. Då blir t.ex. B♭ (♭VII) kvar i både C moll och C dur, och fram och tillbaka blir som innan.
    if (DIM_TYPES.has(type) && !DIM_TYPES.has(c.type)) {
      const i = ((Number(c.root) - fromRoot) % 12 + 12) % 12;
      return { ...c, root: (toRoot + i) % 12, ...(c.bass >= 0 ? { bass: ((Number(c.bass) - fromRoot + toRoot) % 12 + 12) % 12 } : {}) };
    }
    const out = { ...c, root, type };
    if (c.bass >= 0) out.bass = move(Number(c.bass)).root;
    if (!voicingAllowed(out.voicing, out)) out.voicing = 'root';
    return out;
  });
}

// Tonarten som ackorden senast följde (uppdateras också när ett preset laddas, utan att ackorden ändras)
const keyState = { root: 0, scale: 'major' };
function syncKeyState() {
  keyState.root = Number(ui.root.value);
  keyState.scale = ui.scale.value;
}

function followKey() {
  const root = Number(ui.root.value);
  const scale = ui.scale.value;
  if (root === keyState.root && scale === keyState.scale) return;
  chordPads.forEach(release);
  // På plats: rutorna (och sequencern) håller samma ackordobjekt
  rekeyChords(chords, keyState.root, keyState.scale, root, scale).forEach((c, i) => Object.assign(chords[i], c));
  syncKeyState();
  saveChords();
  updateChordLabels();
  chordPads.forEach((p) => { if (p.chord) paintChordPad(p); });
  buildChordEditor();
}

function setupKeyFollow() {
  syncKeyState();
  [ui.root, ui.scale].forEach((el) => el.addEventListener('change', followKey));
}
