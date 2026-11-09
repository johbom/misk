// Arpeggiator: tonerna i det man spelar spelas en i taget, i takt, i stället för samtidigt.
//
// Alla rutor som låter lägger sina toner i en gemensam pool (en ackordruta = hela ackordet, flera
// tonrutor = alla tillsammans). Spelsätten styr som vanligt hur länge en ruta "låter" – Håll så länge
// man är kvar, One-shot/Längd en viss tid, Ligg kvar tills nästa ruta – och lika länge ligger dess
// toner i poolen. Noterna planeras i ljudklockan en bit i förväg, så att takten blir stadig även om
// webbläsaren är upptagen en stund.

const ARP_LOOKAHEAD = 0.12; // s som planeras i förväg
const ARP_TICK_MS = 25;
const ARP_RATES = { 4: 1, 8: 0.5, '8t': 1 / 3, 16: 0.25 }; // andel av ett taktslag

const arp = { pool: [], timer: 0, nextTime: 0, step: 0, last: -1, emptySince: 0, pending: [] };
const arpOn = () => ui.arpOn.checked;
// Retrigg: varje ny ruta (eller nytt finger på XY) börjar om mönstret och takten från första tonen.
// Av: takten löper vidare och nya rutor hakar på i takt.
const arpRetrig = () => ui.arpRetrig.value === 'on';
// MIDI skickas så här långt före tonen (med tidsstämpel), så att den kan strykas vid retrigg ända till dess
const ARP_MIDI_AHEAD = 0.025;
const arpStepDur = () => (60 / (Number(ui.arpBpm.value) || 120)) * (ARP_RATES[ui.arpRate.value] || 0.5);

// En ruta börjar låta: lägg till dess toner
function arpAdd(pad, notes) {
  notes.forEach((note, i) => arp.pool.push({ note, pad, order: performance.now() + i * 1e-3 }));
  pad.arpVib = 0;
  pad.arpPos = null;
  if (!arp.timer) arpStart();
  else if (arpRetrig()) arpRestart();
}

// Börja om från första tonen, nu. Det som redan planerats men inte hörts än stryks.
function arpRestart() {
  arpCancelPending();
  arp.step = 0;
  arp.last = -1;
  // Som vid start: fingrar/tangenter som landar samtidigt hinner med på första slaget
  arp.nextTime = audioCtx.currentTime + NOTE_LOOKAHEAD + 0.03;
}

function arpCancelPending() {
  const now = audioCtx.currentTime;
  arp.pending.forEach((e) => { if (e.time > now) e.cancel(); });
  arp.pending = [];
}

// En ruta släpps: ta bort dess toner. Takten fortsätter ett steg till, så att ett ackordbyte
// (Ligg kvar) eller en snabb förflyttning till nästa ruta håller takten i stället för att börja om.
function arpRemove(pad) {
  arp.pool = arp.pool.filter((e) => e.pad !== pad);
  if (!arp.pool.length && arp.timer) arp.emptySince = audioCtx.currentTime;
}

function arpStart() {
  arp.step = 0;
  arp.last = -1;
  // Första steget planeras vid nästa runda (25 ms): fingrar/tangenter som landar samtidigt hinner med
  arp.nextTime = audioCtx.currentTime + NOTE_LOOKAHEAD + 0.03;
  arp.timer = setInterval(arpTick, ARP_TICK_MS);
}

function arpStop() {
  clearInterval(arp.timer);
  arp.timer = 0;
  arp.pending = [];
}

// Slår av arpeggiatorn helt (t.ex. när den stängs av eller fliken byts)
function arpReset() {
  arpStop();
  arp.pool = [];
}

// Tonföljden enligt mönster och oktaver
function arpSequence() {
  const seen = new Set();
  const base = [];
  for (const e of arp.pool) if (!seen.has(e.note)) { seen.add(e.note); base.push(e); }
  if (!base.length) return [];
  const pattern = ui.arpPattern.value;
  if (pattern !== 'order') base.sort((a, b) => a.note - b.note);
  else base.sort((a, b) => a.order - b.order);
  const octaves = Number(ui.arpOctaves.value) || 1;
  let seq = [];
  // Trummor byter inte tonhöjd: fler oktaver = fler slag på samma trumma
  for (let o = 0; o < octaves; o++) seq.push(...base.map((e) => ({ ...e, note: e.pad.drum ? e.note : clampNote(e.note + 12 * o) })));
  if (pattern === 'down') seq.reverse();
  else if (pattern === 'updown' && seq.length > 2) seq = seq.concat(seq.slice(1, -1).reverse());
  return seq;
}

function arpTick() {
  const now = audioCtx.currentTime;
  // Har webbläsaren varit upptagen (t.ex. flik i bakgrunden)? Hoppa över missade steg i stället för att
  // spela dem alla på en gång.
  if (arp.nextTime < now - 0.05) arp.nextTime = now + NOTE_LOOKAHEAD;
  // Tom pool längre än ett steg: stanna (nästa ruta börjar då om från början, direkt).
  // Kortare än så räknas takten vidare utan att spela, så att nästa ruta hamnar i takt.
  if (!arp.pool.length && now - arp.emptySince > arpStepDur()) { arpStop(); return; }
  while (arp.nextTime < now + ARP_LOOKAHEAD) {
    arpPlayStep(arp.nextTime);
    arp.nextTime += arpStepDur();
  }
}

function arpPlayStep(time) {
  const seq = arpSequence();
  if (!seq.length) return;
  let idx;
  if (ui.arpPattern.value === 'random') {
    idx = Math.floor(Math.random() * seq.length);
    if (seq.length > 1 && idx === arp.last) idx = (idx + 1) % seq.length;
  } else {
    idx = arp.step % seq.length;
  }
  arp.last = idx;
  arp.step++;
  const { note, pad } = seq[idx];
  const dur = arpStepDur() * Math.min(1, Math.max(0.05, Number(ui.arpGate.value) / 100));
  const off = time + dur;
  const timers = [];
  let audioStop = null;

  if (ui.outAudio.checked) {
    let stop;
    if (pad.sample) stop = playSample(pad.sample, time, Math.pow(2, (note - pad.note) / 12));
    else if (pad.drum) stop = drumHit(pad.drum, time, 0.9);
    else stop = engine.noteOn(note, 0.8, time);
    if (pad.arpVib && stop.vibrato) stop.vibrato(pad.arpVib);
    if (pad.arpPos != null && stop.pos) stop.pos(pad.arpPos, posParam(), true);
    stop(off);
    audioStop = stop;
    // Vibrato (vickning) når också toner som redan klingar
    (pad.arpStops || (pad.arpStops = new Set())).add(stop);
    setTimeout(() => pad.arpStops.delete(stop), (off - audioCtx.currentTime) * 1000 + 50);
  }
  const wait = Math.max(0, (time - audioCtx.currentTime) * 1000);
  if (ui.outMidi.checked) {
    // Skickas strax före tonen (med exakt tidsstämpel), så att retrigg hinner stryka den
    const ch = midiChannel();
    timers.push(setTimeout(() => {
      noteOn(note, ch, time);
      noteOff(note, ch, off);
    }, Math.max(0, wait - ARP_MIDI_AHEAD * 1000)));
  }
  // OSC och ljusblink på rutan, så nära tonen som möjligt
  timers.push(setTimeout(() => {
    oscSend('note', note, Number(ui.velocity.value) || 100);
    pad.el.classList.remove('arp-hit');
    void pad.el.offsetWidth;
    pad.el.classList.add('arp-hit');
    timers.push(setTimeout(() => oscSend('note', note, 0), dur * 1000));
  }, wait));

  // Planerad men inte hörd än: kan strykas vid retrigg
  const now = audioCtx.currentTime;
  arp.pending = arp.pending.filter((e) => e.time > now);
  arp.pending.push({
    time,
    cancel: () => {
      timers.forEach(clearTimeout);
      if (audioStop?.cancel) audioStop.cancel();
    },
  });
}

// Vibrato för en ruta som arpeggieras
// Läge på rutan (js/position.js): gäller toner som klingar och de som kommer
function arpPos(pad, x, first) {
  pad.arpPos = x;
  pad.arpStops?.forEach((s) => s.pos && s.pos(x, posParam(), first));
}

function arpVibrato(pad, cents, rate) {
  pad.arpVib = cents;
  pad.arpStops?.forEach((s) => s.vibrato && s.vibrato(cents, rate));
}

// Arp-knappen i spelraden visar om arpeggiatorn är på (anropas också när presets/profiler laddas)
function syncArpToggle() {
  $('arp-toggle').classList.toggle('on', arpOn());
  $('arp-toggle').setAttribute('aria-pressed', arpOn());
}

function setupArp() {
  const sync = syncArpToggle;
  // Byter man arpeggiator av/på mitt i spelet börjar man om från tyst läge
  ui.arpOn.addEventListener('change', () => { allPads().forEach(release); arpReset(); if (typeof xyStopAll === 'function') xyStopAll(); sync(); });
  $('arp-toggle').addEventListener('click', () => {
    ui.arpOn.checked = !ui.arpOn.checked;
    ui.arpOn.dispatchEvent(new Event('change'));
    log(`Arpeggiator ${arpOn() ? 'på' : 'av'}`);
  });
  sync();
  setupTapTempo();
  // Byte av mönster börjar om från första tonen
  ui.arpPattern.addEventListener('change', () => { arp.step = 0; });
}

// Tap-tempo: tryck i takt. Tempot räknas från de senaste trycken (upp till fem); en paus på mer än
// två sekunder börjar om. Ett tryck spelar in, två eller fler ställer tempot.
const TAP_RESET_MS = 2000;
const TAP_KEEP = 5;
let taps = [];

function tapTempo() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > TAP_RESET_MS) taps = [];
  taps.push(now);
  if (taps.length > TAP_KEEP) taps.shift();
  const btn = $('arp-tap');
  btn.classList.remove('tapped');
  void btn.offsetWidth;
  btn.classList.add('tapped');
  if (taps.length < 2) return;
  const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  const min = Number(ui.arpBpm.min);
  const max = Number(ui.arpBpm.max);
  const bpm = Math.round(Math.min(max, Math.max(min, 60000 / avg)));
  if (String(bpm) === ui.arpBpm.value) return;
  ui.arpBpm.value = bpm;
  ui.arpBpm.dispatchEvent(new Event('input', { bubbles: true }));
  ui.arpBpm.dispatchEvent(new Event('change', { bubbles: true }));
}

function setupTapTempo() {
  // pointerdown: trycket räknas när fingret/knappen går ned, inte när det släpps (stramare takt)
  const btn = $('arp-tap');
  btn.addEventListener('pointerdown', (e) => { if (e.button === 0) { btn.dataset.tapped = '1'; tapTempo(); } });
  btn.addEventListener('click', () => {
    // Tangentbord, kontakt eller blickklick ger bara click
    if (btn.dataset.tapped) { delete btn.dataset.tapped; return; }
    tapTempo();
  });
}
