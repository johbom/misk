// Stegsequencer på sidorna Toner och Ackord.
//
// En rad med 4–16 steg (#seq-bar) ligger mellan spelraden och rutorna när sequencern är på. Varje steg
// minns vilka rutor som ska spela där (index bland rutorna på sidan), så Toner och Ackord har var sitt
// mönster: på Toner en melodi eller ett trumkomp, på Ackord en ackordföljd.
//
// Skriva: välj ett steg och spela en ruta – med mus, blick, finger eller kontakt, precis som vanligt.
// Med "Gå vidare" på hamnar rutan i steget och markeringen flyttar till nästa (en ruta per steg).
// Med den av stannar markeringen, och rutor läggs till eller tas bort (flera per steg, t.ex. bastrumma
// och hihat). Paus tömmer steget och går vidare. Spela in: medan sequencern går hamnar det man spelar
// på närmaste steg.
//
// Tempot är detsamma som arpeggiatorns. Noterna planeras i ljudklockan en bit i förväg, som i js/arp.js.

const SEQ_MAX = 16;
const SEQ_KEY = 'hoverPadsSeq';
// Taktslag per steg för varje notvärde
const SEQ_RATES = { 1: 4, 2: 2, 4: 1, 8: 0.5, 16: 0.25 };

const seq = {
  pat: { notes: [], chords: [] },
  running: false, timer: 0, nextTime: 0, step: 0, page: 'notes',
  sel: -1, // markerat steg som det man spelar skrivs in i (-1 = inget)
  rec: false, // spela in medan sequencern går
  sched: [], // planerade steg: { t, i } – för att hitta närmaste steg vid inspelning
  pending: [], // planerade toner som kan strykas när sequencern stoppas
  now: -1, // steget som hörs just nu (markeras i raden)
};

const seqOn = () => ui.seqOn.checked;
const seqTab = () => ['notes', 'chords'].includes(document.body.dataset.tab);
const seqPage = () => (document.body.dataset.tab === 'chords' ? 'chords' : 'notes');
const seqSteps = () => Math.min(SEQ_MAX, Number(ui.seqSteps.value) || 8);
const seqStepDur = () => (60 / (Number(ui.arpBpm.value) || 120)) * (SEQ_RATES[ui.seqRate.value] || 0.5);
const seqGateDur = () => seqStepDur() * Math.min(1, Math.max(0.05, Number(ui.seqGate.value) / 100));
const seqPadsOf = (page) => (page === 'chords' ? chordPads : notePads);
const seqEmpty = () => Array.from({ length: SEQ_MAX }, () => []);

// ---------- Spara (egen nyckel i localStorage, och i Mina presets) ----------
function seqData() {
  return { notes: seq.pat.notes.map((s) => [...s]), chords: seq.pat.chords.map((s) => [...s]) };
}

function applySeqData(d) {
  for (const page of ['notes', 'chords']) {
    const src = Array.isArray(d?.[page]) ? d[page] : [];
    seq.pat[page] = seqEmpty().map((_, i) => (Array.isArray(src[i]) ? src[i].filter((k) => Number.isInteger(k) && k >= 0) : []));
  }
}

function saveSeq() {
  try { localStorage.setItem(SEQ_KEY, JSON.stringify(seqData())); } catch { /* ingen lagring */ }
}

function loadSeq() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SEQ_KEY)); } catch { /* trasigt: börja tomt */ }
  applySeqData(d);
}

// ---------- Uppspelning ----------
function seqStart() {
  if (seq.running || !seqTab() || !audioCtx) return; // (ljudet startas av startrutan)
  if (audioCtx.state !== 'running') audioCtx.resume();
  seq.running = true;
  seq.page = seqPage();
  seq.step = 0;
  seq.sched = [];
  seq.nextTime = audioCtx.currentTime + NOTE_LOOKAHEAD + 0.03;
  seq.timer = setInterval(seqTick, ARP_TICK_MS);
  renderSeq();
  log('▶ Sequencer');
}

function seqStop() {
  if (!seq.running) return;
  clearInterval(seq.timer);
  seq.timer = 0;
  seq.running = false;
  const now = audioCtx.currentTime;
  seq.pending.forEach((e) => { if (e.time > now) e.cancel(); });
  seq.pending = [];
  seq.now = -1;
  renderSeq();
  log('■ Sequencer');
}

function seqTick() {
  const now = audioCtx.currentTime;
  // Har webbläsaren varit upptagen? Hoppa över missade steg i stället för att spela dem på en gång.
  if (seq.nextTime < now - 0.05) seq.nextTime = now + NOTE_LOOKAHEAD;
  while (seq.nextTime < now + ARP_LOOKAHEAD) {
    const i = seq.step % seqSteps();
    seqPlayStep(i, seq.nextTime);
    seq.sched.push({ t: seq.nextTime, i });
    if (seq.sched.length > 4) seq.sched.shift();
    seq.nextTime += seqStepDur();
    seq.step = i + 1;
  }
}

function seqPlayStep(i, time) {
  const pads = seqPadsOf(seq.page);
  const list = seq.pat[seq.page][i].map((k) => pads[k]).filter(Boolean);
  const off = time + seqGateDur();
  // Flera rutor i samma steg: lite svagare var, som när man spelar flera rutor samtidigt
  const count = list.reduce((n, p) => n + (p.drum ? 1 : p.notes().length), 0);
  const level = 0.8 / Math.sqrt(Math.max(1, count));
  list.forEach((p) => seqPlayPad(p, time, off, level));
  const wait = Math.max(0, (time - audioCtx.currentTime) * 1000);
  const t = setTimeout(() => { seq.now = i; markSeqNow(); }, wait);
  seq.pending.push({ time, cancel: () => clearTimeout(t) });
}

// En ruta i ett steg: från time till off (ljudklockans tid)
function seqPlayPad(pad, time, off, level) {
  const notes = pad.notes();
  const timers = [];
  const stops = [];
  if (ui.outAudio.checked) {
    if (pad.sample) stops.push(playSample(pad.sample, time));
    else if (pad.drum) stops.push(drumHit(pad.drum, time, 0.9));
    else notes.forEach((n) => stops.push(engine.noteOn(n, level, time)));
    stops.forEach((s) => s(off));
  }
  const wait = Math.max(0, (time - audioCtx.currentTime) * 1000);
  if (ui.outMidi.checked) {
    const ch = midiChannel();
    timers.push(setTimeout(() => notes.forEach((n) => { noteOn(n, ch, time); noteOff(n, ch, off); }),
      Math.max(0, wait - ARP_MIDI_AHEAD * 1000)));
  }
  // OSC och ljusblink på rutan, så nära tonen som möjligt
  timers.push(setTimeout(() => {
    notes.forEach((n) => oscSend('note', n, Number(ui.velocity.value) || 100));
    pad.el.classList.remove('arp-hit');
    void pad.el.offsetWidth;
    pad.el.classList.add('arp-hit');
    timers.push(setTimeout(() => notes.forEach((n) => oscSend('note', n, 0)), (off - time) * 1000));
  }, wait));
  const now = audioCtx.currentTime;
  seq.pending = seq.pending.filter((e) => e.time > now);
  seq.pending.push({
    time,
    cancel: () => {
      timers.forEach(clearTimeout);
      stops.forEach((s) => s.cancel?.());
    },
  });
}

// ---------- Skriva in (anropas av trigger() i js/pads.js när en ruta spelas) ----------
function seqInput(pad) {
  if (!seqOn() || !seqTab()) return;
  const page = seqPage();
  const k = seqPadsOf(page).indexOf(pad);
  if (k < 0) return;
  const steps = seq.pat[page];
  const live = seq.running && seq.rec && seq.page === page;
  let i;
  if (live) {
    // Närmaste steg i tid (det som just spelats eller det som kommer strax)
    const now = audioCtx.currentTime;
    const near = seq.sched.reduce((a, b) => (Math.abs(b.t - now) < Math.abs(a.t - now) ? b : a), seq.sched[0]);
    if (!near) return;
    i = near.i;
    if (!steps[i].includes(k)) steps[i].push(k);
  } else {
    if (seq.sel < 0 || seq.sel >= seqSteps()) return;
    i = seq.sel;
    const at = steps[i].indexOf(k);
    if (ui.seqAdvance.checked) {
      steps[i] = [k]; // en ruta per steg: skriv över
      seq.sel = i + 1 < seqSteps() ? i + 1 : -1;
      if (seq.sel < 0) log(t('Sista steget är ifyllt.'));
    } else if (at >= 0) steps[i].splice(at, 1); // samma ruta igen: ta bort
    else steps[i].push(k);
  }
  saveSeq();
  renderSeq();
}

// ---------- Raden med stegen ----------
function stepText(page, i) {
  const pads = seqPadsOf(page);
  return seq.pat[page][i].map((k) => pads[k]).filter(Boolean).map((p) => t(p.label()));
}

function renderSeq() {
  if (!seqOn() && seq.running) { seqStop(); return; } // (seqStop ritar om)
  const bar = $('seq-bar');
  const show = seqOn();
  if (bar.hidden === show) {
    bar.hidden = !show;
    layoutPads(); // raden tar höjd från rutorna
  }
  document.body.classList.toggle('seq-on', show);
  syncSeqToggle();
  if (!show) return;
  const page = seqPage();
  const pads = seqPadsOf(page);
  const n = seqSteps();
  const box = $('seq-steps');
  box.style.setProperty('--seq-n', n);
  if (box.children.length !== n) {
    box.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seq-step';
      b.dataset.i = i;
      b.innerHTML = '<small></small><span></span>';
      b.addEventListener('click', () => {
        seq.sel = seq.sel === i ? -1 : i;
        renderSeq();
      });
      return b;
    }));
  }
  [...box.children].forEach((b, i) => {
    const names = stepText(page, i);
    const first = pads[seq.pat[page][i][0]];
    b.querySelector('small').textContent = i + 1;
    b.querySelector('span').textContent = names.join(' ');
    b.classList.toggle('filled', names.length > 0);
    b.classList.toggle('sel', seq.sel === i);
    b.setAttribute('aria-pressed', seq.sel === i);
    b.setAttribute('aria-label', t(`Steg ${i + 1}: ${names.length ? names.join(', ') : 'tomt'}`));
    // Ackordets färg på steget (sidan Ackord)
    const hex = page === 'chords' && first?.chord?.color;
    if (hex) b.style.setProperty('--c', hex);
    else b.style.removeProperty('--c');
    b.classList.toggle('colored', !!hex);
  });
  markSeqNow();
  const play = $('seq-play');
  play.classList.toggle('on', seq.running);
  play.setAttribute('aria-pressed', seq.running);
  play.querySelector('span').textContent = t(seq.running ? 'Stopp' : 'Start');
  play.querySelector('b').textContent = seq.running ? '■' : '▶';
  $('seq-rec').classList.toggle('on', seq.rec);
  $('seq-rec').setAttribute('aria-pressed', seq.rec);
  $('seq-rest').disabled = seq.sel < 0;
  $('seq-clear').disabled = !seq.pat[page].slice(0, n).some((s) => s.length);
  $('seq-hint').textContent = t(seq.running && seq.rec ? 'Spela in: det du spelar hamnar på närmaste steg.'
    : seq.sel >= 0 ? `Spela en ruta så hamnar den i steg ${seq.sel + 1}.` : 'Välj ett steg och spela en ruta för att skriva in den.');
}

function markSeqNow() {
  const show = seq.running && seq.page === seqPage();
  [...$('seq-steps').children].forEach((b, i) => b.classList.toggle('now', show && i === seq.now));
}

// Sekv-knappen i spelraden visar om sequencern är på
function syncSeqToggle() {
  $('seq-toggle').classList.toggle('on', seqOn());
  $('seq-toggle').setAttribute('aria-pressed', seqOn());
}

// Tempot är arpeggiatorns: reglaget under Stegsequencer följer det åt
function syncSeqBpm(from) {
  const [a, b] = from === ui.seqBpm ? [ui.seqBpm, ui.arpBpm] : [ui.arpBpm, ui.seqBpm];
  if (b.value !== a.value) b.value = a.value;
  $('seq-bpm-value').textContent = `${ui.seqBpm.value} BPM`;
}

function setupSeq() {
  loadSeq();
  ui.seqOn.addEventListener('change', () => {
    if (!seqOn()) { seqStop(); seq.sel = -1; seq.rec = false; }
    else if (!seq.pat[seqPage()].some((s) => s.length)) seq.sel = 0; // tomt: börja skriva i steg 1
    renderSeq();
  });
  $('seq-toggle').addEventListener('click', () => {
    if (quick.open === 'seq') { closeQuick(); return; }
    ui.seqOn.checked = !seqOn();
    ui.seqOn.dispatchEvent(new Event('change'));
    log(t(`Stegsequencer ${seqOn() ? 'på' : 'av'}`));
    if (seqOn()) openQuick('seq');
    else closeQuick();
  });
  $('seq-settings').addEventListener('click', () => toggleQuick('seq'));
  $('seq-play').addEventListener('click', () => (seq.running ? seqStop() : seqStart()));
  $('seq-rec').addEventListener('click', () => {
    seq.rec = !seq.rec;
    if (seq.rec) { seq.sel = -1; seqStart(); }
    renderSeq();
  });
  $('seq-rest').addEventListener('click', () => {
    if (seq.sel < 0) return;
    seq.pat[seqPage()][seq.sel] = [];
    seq.sel = seq.sel + 1 < seqSteps() ? seq.sel + 1 : -1;
    saveSeq();
    renderSeq();
  });
  $('seq-clear').addEventListener('click', () => {
    if (!confirm(t('Tömma alla steg på den här sidan?'))) return;
    seq.pat[seqPage()] = seqEmpty();
    seq.sel = 0;
    saveSeq();
    renderSeq();
    log(t('Stegen är tömda.'));
  });
  [ui.seqSteps, ui.seqAdvance].forEach((el) => el.addEventListener('change', () => {
    if (seq.sel >= seqSteps()) seq.sel = -1;
    renderSeq();
  }));
  [ui.seqBpm, ui.arpBpm].forEach((el) => el.addEventListener('input', () => syncSeqBpm(el)));
  ui.seqBpm.addEventListener('change', () => ui.arpBpm.dispatchEvent(new Event('change'))); // sparas med arpens tempo
  syncSeqBpm(ui.arpBpm);
  renderSeq();
}
