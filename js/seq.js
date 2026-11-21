// Stegsequencer på sidorna Toner och Ackord.
//
// En rad med 4–16 steg (#seq-bar) ligger mellan spelraden och rutorna när sequencern är på. Varje steg
// minns vilka rutor som ska spela där (index bland rutorna på sidan), så Toner och Ackord har var sitt
// mönster: på Toner en melodi eller ett trumkomp, på Ackord en ackordföljd.
//
// Skriva: välj ett steg och spela en ruta – med mus, blick, finger eller kontakt, precis som vanligt.
// Paus skrivs in på samma sätt, som en tyst ruta: steget töms. Samma regler för båda (seqWrite):
//  - Ett tryck till på ett markerat, ifyllt steg tömmer det (och ett tredje avmarkerar).
//  - Gå vidare på: rutan (eller pausen) ersätter steget och markeringen flyttar till nästa.
//    Ett ifyllt steg man klickat på ändras på plats: markeringen stannar kvar.
//  - Gå vidare av: markeringen stannar, och rutor läggs till eller tas bort (flera per steg, t.ex.
//    bastrumma och hihat). Paus tömmer steget.
//  - Medan sidans slinga går, utan markerat steg: rutor hamnar på närmaste steg med Spela in, och Paus
//    tömmer alltid närmaste steg (man trycker där det ska vara tyst).
//
// Varje ruta i ett steg minns också sitt läge på rutan (0..1, js/position.js) – så filter eller det andra
// som Läge på rutan styr spelas som när rutan skrevs in. Läget följer pekaren så länge rutan låter efter
// inskrivningen (annars skulle en mus som glider in från kanten alltid få kantens värde).
//
// Tempot är detsamma som arpeggiatorns. Noterna planeras i ljudklockan en bit i förväg, som i js/arp.js.
//
// Toner och Ackord har var sitt antal steg, notvärde och tonlängd (seq.cfg) och var sin klocka (seq.clk),
// så en ackordslinga i halvnoter kan gå samtidigt som en melodi i sextondelar. Reglagen under
// Stegsequencer visar sidan man spelar på (på Inställningar: den man senast spelade på). Slingorna delar
// tempo och taktslag: en slinga som startas medan den andra går hakar på i samma takt.

const SEQ_MAX = 16;
const SEQ_KEY = 'hoverPadsSeq';
// Taktslag per steg för varje notvärde
const SEQ_RATES = { 1: 4, 2: 2, 4: 1, 8: 0.5, 16: 0.25 };

const seqClock = () => ({ nextTime: 0, step: 0, beat: 0, sched: [], now: -1 });
const SEQ_CFG_DEFAULT = { steps: 8, rate: '8', gate: 80 };
const seq = {
  pat: { notes: [], chords: [] },
  play: { notes: false, chords: false }, // vilka sidors slingor som spelar (samma tempo)
  cfg: { notes: { ...SEQ_CFG_DEFAULT }, chords: { ...SEQ_CFG_DEFAULT } }, // steg, notvärde, tonlängd per sida
  clk: { notes: seqClock(), chords: seqClock() }, // nextTime, step, beat (taktslag sedan start), sched, now
  cfgPage: '', // sidan vars inställningar reglagen visar just nu
  timer: 0,
  sel: -1, // markerat steg som det man spelar skrivs in i (-1 = inget)
  fix: -1, // ifyllt steg som man klickat på för att ändra: Gå vidare gäller inte där
  rec: false, // spela in medan sequencern går
  edit: null, // { pad, entry }: senast inskrivna rutan, vars läge följer pekaren medan den låter
  pending: [], // planerade toner som kan strykas när sequencern stoppas
  tr: 0, // Följ tonen: hur många steg i skalan slingan på Toner är flyttad
  key: null, // rutan som slingan följer just nu
};

const seqOn = () => ui.seqOn.checked;
const seqTab = () => ['notes', 'chords'].includes(document.body.dataset.tab);
const seqPage = () => (document.body.dataset.tab === 'chords' ? 'chords' : 'notes');
const seqOther = (page) => (page === 'chords' ? 'notes' : 'chords');
// Reglagens sida: den man spelar på, annars den man senast spelade på (samma som ljudet, js/sound.js)
const seqCfgPage = () => (seqTab() ? seqPage() : soundSlot === 'chords' ? 'chords' : 'notes');
const seqSteps = (page = seqPage()) => Math.min(SEQ_MAX, Number(seq.cfg[page].steps) || 8);
const seqBeats = (page) => SEQ_RATES[seq.cfg[page].rate] || 0.5; // taktslag per steg
const seqBeatDur = () => 60 / (Number(ui.arpBpm.value) || 120);
const seqStepDur = (page) => seqBeatDur() * seqBeats(page);
const seqGateDur = (page) => seqStepDur(page) * Math.min(1, Math.max(0.05, Number(seq.cfg[page].gate) / 100));
const seqPadsOf = (page) => (page === 'chords' ? chordPads : notePads);
const seqEmpty = () => Array.from({ length: SEQ_MAX }, () => []);

// ---------- Spara (egen nyckel i localStorage, och i Mina presets) ----------
// Ett steg = lista med { p: rutans index, x: läge på rutan 0..1 eller null }
function seqData() {
  const copy = (steps) => steps.map((st) => st.map((e) => ({ p: e.p, x: e.x })));
  return {
    notes: copy(seq.pat.notes), chords: copy(seq.pat.chords),
    cfg: { notes: { ...seq.cfg.notes }, chords: { ...seq.cfg.chords } },
  };
}

// Steg, notvärde och tonlängd för en sida: sparade värden, annars reglagens (äldre mönster hade gemensamma)
const seqCfgFromUi = () => ({
  steps: Number(ui.seqSteps.value) || 8, rate: ui.seqRate.value in SEQ_RATES ? ui.seqRate.value : '8', gate: Number(ui.seqGate.value) || 80,
});
function seqCfg(c) {
  const ui0 = seqCfgFromUi();
  if (!c || typeof c !== 'object') return ui0;
  const steps = [4, 8, 12, 16].includes(Number(c.steps)) ? Number(c.steps) : ui0.steps;
  const rate = String(c.rate) in SEQ_RATES ? String(c.rate) : ui0.rate;
  const gate = Number.isFinite(Number(c.gate)) ? Math.max(10, Math.min(100, Number(c.gate))) : ui0.gate;
  return { steps, rate, gate };
}
// Båda sidorna får reglagens värden (äldre presets utan egna värden per sida)
function seqCfgFromControls() {
  seq.cfg = { notes: seqCfgFromUi(), chords: seqCfgFromUi() };
  seq.cfgPage = '';
}

// Äldre mönster sparade bara rutans index (ett tal)
function seqEntry(e) {
  const p = typeof e === 'number' ? e : e?.p;
  if (!Number.isInteger(p) || p < 0) return null;
  const x = typeof e === 'object' && Number.isFinite(e.x) ? Math.max(0, Math.min(1, e.x)) : null;
  return { p, x };
}

function applySeqData(d) {
  for (const page of ['notes', 'chords']) {
    const src = Array.isArray(d?.[page]) ? d[page] : [];
    seq.pat[page] = seqEmpty().map((_, i) => (Array.isArray(src[i]) ? src[i].map(seqEntry).filter(Boolean) : []));
    seq.cfg[page] = seqCfg(d?.cfg?.[page]);
  }
  seq.cfgPage = ''; // reglagen visar de nya värdena vid nästa renderSeq
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
// Toner och Ackord har var sin slinga med egen ▶, men samma takt: en ackordrunda och ett trumkomp kan gå
// samtidigt. Slingorna fortsätter när man byter sida, så man kan spela till dem – på den andra sidan,
// på XY eller på samma sida (det man spelar skrivs bara in med Spela in, eller i ett steg man valt).
const seqPlaying = (page) => seq.play[page];
const seqAny = () => seq.play.notes || seq.play.chords;
const SEQ_PAGE_NAME = { notes: 'Toner', chords: 'Ackord' };

function seqStart(page = seqPage()) {
  if (seq.play[page] || !audioCtx) return; // (ljudet startas av startrutan)
  if (audioCtx.state !== 'running') audioCtx.resume();
  // Under uppspelning skrivs inget in steg för steg (bara med Spela in, eller om man själv väljer ett steg)
  if (page === seqPage()) seq.sel = -1;
  const c = seq.clk[page];
  const o = seq.clk[seqOther(page)];
  c.sched = [];
  c.now = -1;
  if (seq.play[seqOther(page)]) {
    // Den andra slingan går: haka på i samma takt, på närmaste slag i det här notvärdet – och på det steg
    // man skulle ha varit på om båda startat samtidigt.
    const pb = seqBeats(page);
    const bd = seqBeatDur();
    const earliest = o.beat - (o.nextTime - (audioCtx.currentTime + NOTE_LOOKAHEAD + 0.03)) / bd; // taktslag
    c.beat = Math.ceil(earliest / pb - 1e-6) * pb;
    c.nextTime = o.nextTime + (c.beat - o.beat) * bd;
    c.step = Math.round(c.beat / pb);
  } else {
    // Takten börjar: första steget direkt
    c.beat = 0;
    c.step = 0;
    c.nextTime = audioCtx.currentTime + NOTE_LOOKAHEAD + 0.03;
  }
  seq.play[page] = true;
  if (!seq.timer) seq.timer = setInterval(seqTick, ARP_TICK_MS);
  renderSeq();
  log(`▶ Sequencer: ${t(SEQ_PAGE_NAME[page])}`);
}

function seqStop(page = seqPage()) {
  if (!seq.play[page]) return;
  seq.play[page] = false;
  if (page === seqPage()) seq.rec = false; // stopp avslutar också inspelningen
  if (page === 'notes') seqFollowReset(); // (nästa start: mönstret som det skrevs)
  const now = audioCtx.currentTime;
  seq.pending = seq.pending.filter((e) => {
    if (e.page !== page) return true;
    if (e.time > now) e.cancel();
    return false;
  });
  seq.clk[page].now = -1;
  if (!seqAny()) {
    clearInterval(seq.timer);
    seq.timer = 0;
    seq.pending.forEach((e) => { if (e.time > now) e.cancel(); });
    seq.pending = [];
  }
  renderSeq();
  log(`■ Sequencer: ${t(SEQ_PAGE_NAME[page])}`);
}

function seqStopAll() {
  seqStop('notes');
  seqStop('chords');
  seq.rec = false;
}

function seqTick() {
  const now = audioCtx.currentTime;
  seq.pending = seq.pending.filter((e) => e.time > now); // det som redan börjat behöver inte kunna strykas
  for (const page of ['notes', 'chords']) {
    if (!seq.play[page]) continue;
    const c = seq.clk[page];
    // Har webbläsaren varit upptagen? Hoppa över missade steg (i takt) i stället för att spela dem på en gång.
    if (c.nextTime < now - 0.05) {
      const skip = Math.ceil((now + NOTE_LOOKAHEAD - c.nextTime) / seqStepDur(page));
      c.nextTime += skip * seqStepDur(page);
      c.beat += skip * seqBeats(page);
      c.step += skip;
    }
    while (c.nextTime < now + ARP_LOOKAHEAD) {
      const i = c.step % seqSteps(page);
      const time = c.nextTime;
      seqPlayStep(page, i, time);
      c.sched.push({ t: time, i });
      if (c.sched.length > 4) c.sched.shift();
      const wait = Math.max(0, (time - audioCtx.currentTime) * 1000);
      const tm = setTimeout(() => { c.now = i; if (page === seqPage()) markSeqNow(); }, wait);
      seq.pending.push({ time, page, cancel: () => clearTimeout(tm) });
      c.nextTime += seqStepDur(page);
      c.beat += seqBeats(page);
      c.step = i + 1;
    }
  }
}

function seqPlayStep(page, i, time) {
  const pads = seqPadsOf(page);
  const tr = page === 'notes' ? seqTransposeNow() : 0;
  const list = seq.pat[page][i].map((e) => ({ pad: tr ? seqShifted(e.p + tr) : pads[e.p], x: e.x })).filter((e) => e.pad);
  const off = time + seqGateDur(page);
  // Flera rutor i samma steg: lite svagare var, som när man spelar flera rutor samtidigt
  const count = list.reduce((n, e) => n + (e.pad.drum ? 1 : e.pad.notes().length), 0);
  const level = 0.8 / Math.sqrt(Math.max(1, count));
  list.forEach((e) => seqPlayPad(e.pad, time, off, level, e.x, page));
}

// En ruta i ett steg: från time till off (ljudklockans tid). x = sparat läge på rutan (eller null).
function seqPlayPad(pad, time, off, level, x, page) {
  const notes = pad.notes();
  const timers = [];
  const stops = [];
  const pos = posOn() && x != null;
  if (ui.outAudio.checked) {
    if (pad.sample) stops.push(playSample(pad.sample, time));
    else if (pad.drum) stops.push(drumHit(pad.drum, time, 0.9));
    else notes.forEach((n) => stops.push(padEngine(pad).noteOn(n, level, time)));
    // Läge på rutan: sätts direkt vid anslaget (ljudfiler och trumset påverkas inte)
    if (pos) stops.forEach((s) => s.pos?.(x, posParam(), true));
    stops.forEach((s) => s(off));
  }
  const wait = Math.max(0, (time - audioCtx.currentTime) * 1000);
  if (ui.outMidi.checked) {
    const ch = midiChannel();
    timers.push(setTimeout(() => {
      if (pos) posMidi(x); // CC eller pitch bend strax före tonen
      notes.forEach((n) => { noteOn(n, ch, time); noteOff(n, ch, off); });
    }, Math.max(0, wait - ARP_MIDI_AHEAD * 1000)));
  }
  // OSC och ljusblink på rutan, så nära tonen som möjligt
  timers.push(setTimeout(() => {
    notes.forEach((n) => oscSend('note', n, Number(ui.velocity.value) || 100));
    if (pad.el) flashPad(pad.el); // (en ton utanför rutorna, Följ tonen: ingen ruta att blinka)
    timers.push(setTimeout(() => notes.forEach((n) => oscSend('note', n, 0)), (off - time) * 1000));
  }, wait));
  seq.pending.push({
    time,
    page,
    cancel: () => {
      timers.forEach(clearTimeout);
      stops.forEach((s) => s.cancel?.());
    },
  });
}

// ---------- Följ tonen (sidan Toner) ----------
// Med Följ tonen på (Inställningar → Stegsequencer) och slingan på Toner igång: en ruta man spelar låter
// inte själv, utan flyttar mönstret i skalan så att det börjar på den tonen. Mönstrets första ton (lägsta
// rutan i första ifyllda steget) är referensen: spelar man den rutan går mönstret som det skrevs, två rutor
// högre = två steg högre i skalan. Det gäller tills man spelar en annan ruta eller stoppar slingan.
// Medan man skriver in (markerat steg eller Spela in) och med trumset gäller det inte.
const seqFollowOn = () => ui.seqFollow.checked && !drumKitOn();

// Tonen på ruta k, även utanför rutorna (skalan fortsätter uppåt och nedåt)
function seqScaleNote(k) {
  const scale = SCALES[ui.scale.value] || SCALES.major;
  const base = 12 * (Number(ui.octave.value) + 1) + Number(ui.root.value);
  const o = Math.floor(k / scale.length);
  return clampNote(base + 12 * o + scale[k - o * scale.length]);
}

// Ruta k i det flyttade mönstret: rutan om den finns, annars en ton utan ruta
function seqShifted(k) {
  if (k >= 0 && k < notePads.length) return notePads[k];
  const note = seqScaleNote(k);
  return { el: null, sample: null, drum: null, note, notes: () => [note], label: () => noteName(note) };
}

// Mönstrets första ton (rutans index), eller -1 om mönstret är tomt
function seqFirstNote() {
  for (const st of seq.pat.notes.slice(0, seqSteps('notes'))) {
    if (st.length) return Math.min(...st.map((e) => e.p));
  }
  return -1;
}

const seqTransposeNow = () => (seqFollowOn() ? seq.tr : 0);

function seqSetKey(pad) {
  seq.key?.el.classList.remove('seq-key');
  seq.key = pad;
  pad?.el.classList.add('seq-key');
}

function seqFollowReset() {
  seq.tr = 0;
  seqSetKey(null);
}

// Anropas av trigger() (js/pads.js) först: true = rutan flyttade mönstret och ska inte spela själv
function seqFollow(pad) {
  if (!seqFollowOn() || !seqOn() || seqPage() !== 'notes' || !seq.play.notes) return false;
  if (seq.rec || (seq.sel >= 0 && seq.sel < seqSteps('notes'))) return false; // (skriver in)
  const k = notePads.indexOf(pad);
  const ref = seqFirstNote();
  if (k < 0 || ref < 0) return false;
  seq.tr = k - ref;
  seqSetKey(pad);
  log(t(`Slingan följer ${noteName(pad.note)}`) + (seq.tr ? ` (${seq.tr > 0 ? '+' : '−'}${Math.abs(seq.tr)})` : ''));
  renderSeq();
  return true;
}

// ---------- Skriva in (anropas av trigger() i js/pads.js när en ruta spelas) ----------
// Var det man spelar (eller Paus) skrivs in: det markerade steget, annars – medan sidans slinga går –
// närmaste steg i tid (det som just hörts eller kommer strax). Rutor bara med Spela in; Paus alltid.
function seqTarget(page, isRest) {
  if (seq.sel >= 0 && seq.sel < seqSteps(page)) return { i: seq.sel, live: false };
  if (!seq.play[page] || !(isRest || seq.rec)) return null;
  const now = audioCtx.currentTime;
  const sched = seq.clk[page].sched;
  const near = sched.reduce((a, b) => (Math.abs(b.t - now) < Math.abs(a.t - now) ? b : a), sched[0]);
  return near ? { i: near.i, live: true } : null;
}

// Skriv in en ruta (entry = { p, x }) eller en paus (entry = null) enligt reglerna överst
function seqWrite(page, entry) {
  const tg = seqTarget(page, !entry);
  if (!tg) return null;
  const { i } = tg;
  const steps = seq.pat[page];
  let kept = entry; // rutan som ligger kvar i steget (vars läge följer pekaren)
  if (tg.live) {
    if (!entry) steps[i] = [];
    else {
      const old = steps[i].find((e) => e.p === entry.p);
      if (old) { old.x = entry.x; kept = old; } else steps[i].push(entry);
    }
  } else if (ui.seqAdvance.checked) {
    steps[i] = entry ? [entry] : []; // ett per steg: skriv över
    if (seq.fix !== i) { // (ett ifyllt steg man klickat på ändras på plats)
      seq.sel = i + 1 < seqSteps(page) ? i + 1 : -1;
      if (seq.sel < 0) log(t('Sista steget är ifyllt.'));
    }
  } else if (!entry) {
    steps[i] = [];
  } else {
    const at = steps[i].findIndex((e) => e.p === entry.p);
    if (at >= 0) { steps[i].splice(at, 1); kept = null; } // samma ruta igen: ta bort
    else steps[i].push(entry);
  }
  saveSeq();
  renderSeq();
  return { i, kept };
}

function seqInput(pad) {
  seq.edit = null; // en ny ruta: det som skrevs in förut följer inte längre pekaren
  if (!seqOn() || !seqTab()) return;
  const page = seqPage();
  const k = seqPadsOf(page).indexOf(pad);
  if (k < 0) return;
  const done = seqWrite(page, { p: k, x: seqPosNow(pad) });
  if (done?.kept) seq.edit = { pad, entry: done.kept }; // läget följer pekaren medan rutan låter (seqPosMove)
}

function seqRest() {
  if (!seqOn() || !seqTab()) return;
  seq.edit = null;
  const done = seqWrite(seqPage(), null);
  if (done) log(t(`Paus i steg ${done.i + 1}`));
}

// Läget på rutan just nu: från pekaren som ligger över den (null om ingen gör det, t.ex. kontakt)
function seqPosNow(pad) {
  for (const { x, y } of pointerXY.values()) {
    if (padAt(x, y) === pad) { const v = padPos(pad, x, y); return v == null ? null : Math.round(v * 1000) / 1000; }
  }
  return null;
}

// Anropas av posApply (js/position.js) när läget på en ruta som låter ändras
let seqSaveTimer = 0;
function seqPosMove(pad, x) {
  const ed = seq.edit;
  if (!ed || ed.pad !== pad || !pad.release) return;
  ed.entry.x = Math.round(x * 1000) / 1000;
  clearTimeout(seqSaveTimer);
  seqSaveTimer = setTimeout(() => { saveSeq(); renderSeq(); }, 250);
}

// ---------- Raden med stegen ----------
function stepText(page, i) {
  const pads = seqPadsOf(page);
  // Följ tonen: stegen visar tonerna som hörs (det flyttade mönstret)
  const tr = page === 'notes' ? seqTransposeNow() : 0;
  return seq.pat[page][i].map((e) => (tr ? seqShifted(e.p + tr) : pads[e.p])).filter(Boolean).map((p) => t(p.label()));
}

// ---------- Håll in ett steg: ändra läget på rutan ----------
// Håll ett ifyllt steg en stund, dra sedan uppåt/åt höger (mer) eller nedåt/åt vänster (mindre). Alla rutor i
// steget får samma läge. Släpper man hörs steget med det nya läget. (Bara när Läge på rutan används.)
const SEQ_HOLD_MS = 400;
const SEQ_HOLD_RANGE = 160; // px för hela vägen 0–100 %
function seqHoldSetup(b, i) {
  let timer = 0;
  let start = null; // { x, y, v, id }
  let adjusting = false;
  const value = (e) => clamp01(start.v + ((e.clientX - start.x) - (e.clientY - start.y)) / SEQ_HOLD_RANGE);
  const show = (v) => {
    b.style.setProperty('--pos', v);
    b.classList.add('has-pos');
    b.dataset.posLabel = `${Math.round(v * 100)} %`;
  };
  const end = (e, cancel) => {
    clearTimeout(timer);
    timer = 0;
    if (adjusting) {
      adjusting = false;
      b.classList.remove('adjusting');
      b.dataset.held = '1'; // klicket som följer ska inte välja eller tömma steget
      setTimeout(() => { delete b.dataset.held; }, 400);
      if (!cancel) {
        const page = seqPage();
        const v = Math.round(value(e) * 1000) / 1000;
        seq.pat[page][i].forEach((en) => { en.x = v; });
        saveSeq();
        log(t(`Steg ${i + 1}: läge ${Math.round(v * 100)} %`));
        // Hör hur det blev (om slingan inte redan spelar)
        if (audioCtx && !seq.play[page]) {
          if (audioCtx.state !== 'running') audioCtx.resume();
          seqPlayStep(page, i, audioCtx.currentTime + 0.03);
        }
      }
      renderSeq();
    }
    start = null;
  };
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const entries = seq.pat[seqPage()][i];
    if (!entries.length) return;
    const first = entries.find((en) => en.x != null);
    start = { x: e.clientX, y: e.clientY, v: first ? first.x : 0.5, id: e.pointerId };
    timer = setTimeout(() => {
      timer = 0;
      if (!posOn()) { log(t('Välj vad läget ska styra under Inställningar → Instrument → Läge på rutan.')); return; }
      adjusting = true;
      try { b.setPointerCapture(start.id); } catch {}
      b.classList.add('adjusting');
      show(start.v);
    }, SEQ_HOLD_MS);
  });
  b.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!adjusting) {
      // Rör man sig innan hållningen börjat är det ingen hållning
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) { clearTimeout(timer); timer = 0; start = null; }
      return;
    }
    e.preventDefault();
    show(value(e));
  });
  b.addEventListener('pointerup', (e) => { if (start && e.pointerId === start.id) end(e, false); });
  b.addEventListener('pointercancel', (e) => { if (start && e.pointerId === start.id) end(e, true); });
  b.addEventListener('contextmenu', (e) => e.preventDefault()); // långt tryck på telefon: ingen meny
}

// Reglagen Steg, Notvärde och Tonlängd visar sidans egna värden
let seqCfgSyncing = false;
function seqShowCfg() {
  const page = seqCfgPage();
  if (seq.cfgPage === page) return;
  seq.cfgPage = page;
  const c = seq.cfg[page];
  seqCfgSyncing = true;
  ui.seqSteps.value = String(c.steps);
  ui.seqRate.value = String(c.rate);
  ui.seqGate.value = String(c.gate);
  $('seq-gate-value').textContent = `${c.gate} %`;
  [ui.seqSteps, ui.seqRate].forEach((el) => { if (el.segBox) syncSegment(el); }); // (knapparna byggs efter setupSeq)
  seqCfgSyncing = false;
  $('seq-cfg-page').textContent = t(`Steg, notvärde och tonlängd för ${SEQ_PAGE_NAME[page]} – ${SEQ_PAGE_NAME[seqOther(page)]} har egna.`);
}

// Ett reglage ändrat: gäller sidan som visas
function seqCfgChanged() {
  if (seqCfgSyncing) return;
  const page = seq.cfgPage || seqCfgPage();
  seq.cfg[page] = { steps: Number(ui.seqSteps.value) || 8, rate: ui.seqRate.value, gate: Number(ui.seqGate.value) || 80 };
  saveSeq();
}

function renderSeq() {
  seqShowCfg();
  if (!seqOn() && seqAny()) { seqStopAll(); return; } // (seqStop ritar om)
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
      seqHoldSetup(b, i);
      b.addEventListener('click', () => {
        if (b.dataset.held) { delete b.dataset.held; return; } // det var en hållning (läget ändrades)
        // Tryck på ett markerat, ifyllt steg: töm det (markeringen stannar kvar). Ett markerat tomt steg:
        // avmarkera. Alltså: välj → töm → avmarkera.
        const pg = seqPage();
        if (seq.sel === i && seq.pat[pg][i].length) {
          seq.pat[pg][i] = [];
          seq.fix = i;
          seq.edit = null;
          saveSeq();
          log(t(`Steg ${i + 1} tömt`));
          renderSeq();
          return;
        }
        seq.sel = seq.sel === i ? -1 : i;
        // Ett ifyllt steg man klickar på ändras på plats: markeringen stannar kvar (inget Gå vidare)
        seq.fix = seq.sel >= 0 && seq.pat[seqPage()][i].length ? i : -1;
        renderSeq();
      });
      return b;
    }));
  }
  [...box.children].forEach((b, i) => {
    const names = stepText(page, i);
    const firstE = seq.pat[page][i].find((e) => pads[e.p]);
    const first = firstE && pads[firstE.p];
    // Läge på rutan: en liten stapel på stegets vänsterkant (när Läge på rutan används)
    const x = posOn() && firstE?.x != null ? firstE.x : null;
    b.classList.toggle('has-pos', x != null);
    if (x != null) b.style.setProperty('--pos', x);
    b.querySelector('small').textContent = i + 1;
    b.querySelector('span').textContent = names.join(' ');
    b.classList.toggle('filled', names.length > 0);
    b.classList.toggle('sel', seq.sel === i);
    b.setAttribute('aria-pressed', seq.sel === i);
    b.setAttribute('aria-label', t(`Steg ${i + 1}: ${names.length ? names.join(', ') : 'tomt'}`) + (x != null ? ` · ${Math.round(x * 100)} %` : ''));
    // Ackordets färg på steget (sidan Ackord)
    const hex = page === 'chords' && first?.chord?.color;
    if (hex) b.style.setProperty('--c', hex);
    else b.style.removeProperty('--c');
    b.classList.toggle('colored', !!hex);
  });
  markSeqNow();
  const play = $('seq-play');
  const playing = seq.play[page];
  play.classList.toggle('on', playing);
  play.setAttribute('aria-pressed', playing);
  play.querySelector('span').textContent = t(playing ? 'Stopp' : 'Start');
  play.querySelector('b').textContent = playing ? '■' : '▶';
  // Den andra sidans slinga: ■ stoppar den när den går, ▶ startar den igen (i takt) när den har steg.
  // Knappen står kvar när man stoppat, så att man kan starta den igen utan att byta sida.
  const other = seqOther(page);
  const otherOn = seq.play[other];
  const ob = $('seq-other');
  ob.hidden = !otherOn && !seq.pat[other].slice(0, seqSteps(other)).some((st) => st.length);
  ob.classList.toggle('stopped', !otherOn);
  ob.setAttribute('aria-pressed', otherOn);
  ob.querySelector('b').textContent = otherOn ? '■' : '▶';
  ob.querySelector('span').textContent = t(SEQ_PAGE_NAME[other]);
  ob.title = t(`${otherOn ? 'Stoppa' : 'Starta'} slingan på ${SEQ_PAGE_NAME[other]}`);
  $('seq-rec').classList.toggle('on', seq.rec);
  $('seq-rec').setAttribute('aria-pressed', seq.rec);
  // Paus går att trycka på när det finns ett steg att skriva i (markerat, eller slingan går)
  const canRest = (seq.sel >= 0 && seq.sel < n) || playing;
  $('seq-rest').disabled = !canRest;
  $('seq-rest').title = t(!canRest ? 'Välj först ett steg – då blir det en paus där'
    : seq.sel >= 0 ? `Paus i steg ${seq.sel + 1}` : 'Paus i steget som spelas nu');
  $('seq-clear').disabled = !seq.pat[page].slice(0, n).some((s) => s.length);
  const selFilled = seq.sel >= 0 && seq.sel < n && seq.pat[page][seq.sel].length > 0;
  $('seq-hint').textContent = t(selFilled && seq.fix === seq.sel && ui.seqAdvance.checked ? `Spela en ruta eller Paus så byts steg ${seq.sel + 1} ut. Tryck på steget igen för att tömma det.`
    : selFilled ? `Spela en ruta eller Paus så hamnar den i steg ${seq.sel + 1}. Tryck på steget igen för att tömma det.`
    : seq.sel >= 0 ? `Spela en ruta eller Paus så hamnar den i steg ${seq.sel + 1}.`
    : playing && seq.rec ? 'Spela in: det du spelar hamnar på närmaste steg. Paus tystar steget som spelas.'
    : playing && page === 'notes' && seqFollowOn() ? (seq.key ? `Slingan följer ${noteName(seq.key.note)}. Spela en annan ruta för att flytta den.` : 'Spela en ruta så flyttas slingan dit i skalan.')
    : playing ? 'Paus tystar steget som spelas. Välj ett steg, eller Spela in, för att skriva in rutor.'
    : 'Välj ett steg och spela en ruta eller Paus för att skriva in den.');
}

// Bara det förra och det nya steget ändras (inte hela raden vid varje steg)
function markSeqNow() {
  const el = seq.play[seqPage()] ? $('seq-steps').children[seq.clk[seqPage()].now] || null : null;
  if (el === seq.nowEl && el?.classList.contains('now')) return;
  seq.nowEl?.classList.remove('now');
  el?.classList.add('now');
  seq.nowEl = el;
}

// Sekv-knappen i spelraden visar om sequencern är på
function syncSeqToggle() {
  $('seq-toggle').classList.toggle('on', seqOn());
  $('seq-toggle').classList.toggle('running', seqAny()); // en slinga går (även på XY, där raden inte syns)
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
    if (!seqOn()) { seqStopAll(); seq.sel = -1; }
    else if (!seq.pat[seqPage()].some((s) => s.length)) { seq.sel = 0; seq.fix = -1; } // tomt: börja skriva i steg 1
    renderSeq();
  });
  $('seq-toggle').addEventListener('click', () => {
    // På XY syns knappen bara medan en slinga går: där stoppar den slingorna
    if (document.body.dataset.tab === 'xy') { seqStopAll(); return; }
    if (quick.open === 'seq') { closeQuick(); return; }
    ui.seqOn.checked = !seqOn();
    ui.seqOn.dispatchEvent(new Event('change'));
    log(t(`Stegsequencer ${seqOn() ? 'på' : 'av'}`));
    if (seqOn()) openQuick('seq');
    else closeQuick();
  });
  $('seq-settings').addEventListener('click', () => toggleQuick('seq'));
  $('seq-play').addEventListener('click', () => (seq.play[seqPage()] ? seqStop() : seqStart()));
  $('seq-other').addEventListener('click', () => { const o = seqOther(seqPage()); if (seq.play[o]) seqStop(o); else seqStart(o); });
  // Spela in: startar sequencern (om den inte går) – ett tryck till slutar spela in, och sequencern fortsätter
  $('seq-rec').addEventListener('click', () => {
    seq.rec = !seq.rec;
    if (seq.rec) { seq.sel = -1; seqStart(); }
    renderSeq();
  });
  $('seq-rest').addEventListener('click', seqRest);
  $('seq-clear').addEventListener('click', async () => {
    // Fråga först (går att stänga av under Stegsequencer)
    if (ui.seqAskClear.checked && !await askConfirm(t('Tömma alla steg på den här sidan?'), t('Rensa'))) return;
    seq.pat[seqPage()] = seqEmpty();
    seq.sel = 0;
    seq.fix = -1;
    saveSeq();
    renderSeq();
    log(t('Stegen är tömda.'));
  });
  [ui.seqSteps, ui.seqRate].forEach((el) => el.addEventListener('change', seqCfgChanged));
  ui.seqGate.addEventListener('input', seqCfgChanged);
  [ui.seqSteps, ui.seqAdvance].forEach((el) => el.addEventListener('change', () => {
    if (seq.sel >= seqSteps()) seq.sel = -1;
    renderSeq();
  }));
  ui.seqFollow.addEventListener('change', () => { seqFollowReset(); renderSeq(); });
  [ui.seqBpm, ui.arpBpm].forEach((el) => el.addEventListener('input', () => syncSeqBpm(el)));
  ui.seqBpm.addEventListener('change', () => ui.arpBpm.dispatchEvent(new Event('change'))); // sparas med arpens tempo
  syncSeqBpm(ui.arpBpm);
  renderSeq();
}
