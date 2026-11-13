// Ljudutgång (Web Audio + SynthEngine) och MIDI-utgång (Web MIDI).

// ---------- Ljud (Web Audio + ljudmotorn i synth.js) ----------
let audioCtx = null;
// Toner och Ackord har var sin ljudmotor (eget ljud, egna effekter), så att en ackordrunda och en
// melodi kan låta olika samtidigt. engine = motorn för sidan som visas eller vars ljud man ändrar.
let engine = null;
const engines = { notes: null, chords: null };
const padEngine = (pad) => (pad && pad.chord ? engines.chords : engines.notes);

function initAudio() {
  // iPhone: spela även när ljudlös-knappen är på (Safari 16.4+)
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // iOS: väck ljudet i samma tryck genom att spela en kort tyst buffert
  try {
    const silent = audioCtx.createBufferSource();
    silent.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    silent.connect(audioCtx.destination);
    silent.start(0);
    if (audioCtx.state !== 'running') audioCtx.resume();
  } catch {}
  for (const slot of ['notes', 'chords']) {
    const e = new SynthEngine(audioCtx, soundState(slot).params);
    // Läge på rutan: synten behöver veta om oscillator 2 styrs (då finns den med i varje ton)
    Object.defineProperty(e, 'posMode', { get: () => ui.posParam.value });
    e.setVolume(Number(ui.volume.value));
    engines[slot] = e;
  }
  engine = engines[soundSlot];
}

// Spelar en uppladdad ljudfil genom effekterna (spelar alltid klart).
// Spelar en uppladdad ljudfil. Returnerar en funktion som tonar ut och stoppar den
// (så att ljudfiler kan följa spelsättet: hållas, spelas hela eller i bestämd längd).
// when/rate (valfritt): starttid i ljudklockan och uppspelningshastighet (för arpeggiatorns oktaver)
function playSample(buffer, when = 0, rate = 1) {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = audioCtx.createGain();
  src.connect(g).connect(engines.notes.input); // ljudfiler finns bara på Toner
  // Vibrato även på ljudfiler (detune finns inte i alla äldre webbläsare)
  let vib = null;
  if (src.detune) {
    vib = audioCtx.createGain();
    vib.gain.value = 0;
    engines.notes.vibLfo.connect(vib).connect(src.detune);
  }
  const t0 = Math.max(audioCtx.currentTime, when);
  src.start(t0);
  src.onended = () => { if (vib) try { engines.notes.vibLfo.disconnect(vib); } catch {} };
  const stop = (at = 0) => {
    const t = Math.max(audioCtx.currentTime, at, t0 + 0.005);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.setTargetAtTime(0, t, 0.015); // kort uttoning, inget klick
    src.stop(t + 0.12);
  };
  stop.cancel = () => {
    if (audioCtx.currentTime >= t0) return false;
    try { g.disconnect(); src.stop(); } catch {}
    return true;
  };
  stop.vibrato = (cents, rate) => {
    if (!vib) return;
    const now = audioCtx.currentTime;
    vib.gain.setTargetAtTime(cents, now, cents > 0 ? 0.12 : 0.25);
    if (rate) engines.notes.vibLfo.frequency.setTargetAtTime(rate, now, 0.25);
  };
  return stop;
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

// when (valfritt): ljudklockans tid – räknas om till Web MIDI:s tidsstämpel (performance.now)
function sendMidi(bytes, when = 0) {
  const out = currentMidiOutput();
  if (!out) return;
  if (when && audioCtx) out.send(bytes, performance.now() + Math.max(0, when - audioCtx.currentTime) * 1000);
  else out.send(bytes);
  ui.midiStatus.classList.add('flash');
  setTimeout(() => ui.midiStatus.classList.remove('flash'), 60);
}

// Räknar hur många rutor som håller samma ton, så att en ruta som släpps
// inte stänger av en ton som en annan ruta (t.ex. ett annat ackord) fortfarande spelar.
const heldNotes = new Map(); // "kanal:ton" -> antal

const midiChannel = () => (Math.min(16, Math.max(1, Number(ui.midiCh.value) || 1)) - 1);

function noteOn(note, ch, when = 0) {
  const key = `${ch}:${note}`;
  heldNotes.set(key, (heldNotes.get(key) || 0) + 1);
  sendMidi([0x90 | ch, note, Number(ui.velocity.value)], when);
}

function noteOff(note, ch, when = 0) {
  const key = `${ch}:${note}`;
  const left = (heldNotes.get(key) || 1) - 1;
  if (left > 0) { heldNotes.set(key, left); return; }
  heldNotes.delete(key);
  sendMidi([0x80 | ch, note, 0], when);
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
