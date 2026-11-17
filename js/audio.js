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
  // Android: lite större ljudbuffert (några ms mer fördröjning) – den minsta hackar lätt på telefoner
  const Ctx = window.AudioContext || window.webkitAudioContext;
  try { audioCtx = new Ctx(IS_ANDROID ? { latencyHint: 'balanced' } : undefined); } catch { audioCtx = new Ctx(); }
  // iOS: väck ljudet i samma tryck genom att spela en kort tyst buffert
  try {
    const silent = audioCtx.createBufferSource();
    silent.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    silent.connect(audioCtx.destination);
    silent.start(0);
    if (audioCtx.state !== 'running') audioCtx.resume();
  } catch {}
  const master = AUDIO_DIAG.has('nomaster') ? audioCtx.destination : makeMasterBus(audioCtx);
  if (AUDIO_DIAG.size) log(`Felsökning av ljudet: ${[...AUDIO_DIAG].join(', ')}`);
  for (const slot of ['notes', 'chords']) {
    if (slot === 'chords' && AUDIO_DIAG.has('one')) { engines.chords = engines.notes; continue; } // en motor, som förr
    const e = new SynthEngine(audioCtx, soundState(slot).params, master);
    // Läge på rutan: synten behöver veta om oscillator 2 styrs (då finns den med i varje ton)
    Object.defineProperty(e, 'posMode', { get: () => ui.posParam.value });
    // Vibrato genom att vicka (Instrument → Vibrato): av = rösterna behöver ingen vibratonod
    Object.defineProperty(e, 'vibOn', { get: () => Number(ui.vibrato.value) > 0 });
    e.setVolume(Number(ui.volume.value));
    engines[slot] = e;
  }
  engine = engines[soundSlot];
  startAudioGuard();
}

// Ljudvakten: märker när ljudet hackar och lättar då på lasten direkt. Ljudklockan går bara fram när
// ljudtråden hunnit räkna fram ljudet; halkar den efter klockan på väggen har ljudet hackat (det man
// hör som knaster). Då tonas släppta toner som klingar ut bort, och taket för antalet röster sänks
// tillfälligt (det går tillbaka, fyra röster var tredje sekund som ljudet är helt). Utan vakten blir det på en svag
// telefon allt tätare hack tills svansarna tonat ut, och man måste vänta innan det går att spela igen.
// ?diag=meter skriver också ut avbrotten i loggen.
const GUARD_LATE_MS = 12; // så mycket efter (utöver det vanliga) räknas som ett avbrott
function startAudioGuard() {
  let base = null; let lost = 0; let hacks = 0; let shown = ''; let calmSince = performance.now(); let exact = null;
  // Ljudklockan och väggklockan för samma ögonblick: getOutputTimestamp är exakt; currentTime går
  // fram i hela buffertar (på Android 10–20 ms åt gången), så då tas det minsta värdet som bas
  const behindNow = () => {
    const ts = audioCtx.getOutputTimestamp?.();
    const ok = !!ts && ts.performanceTime > 0;
    if (ok !== exact) { exact = ok; base = null; lost = 0; } // (annat sätt att mäta: börja om)
    return ok ? ts.performanceTime - ts.contextTime * 1000 : performance.now() - audioCtx.currentTime * 1000;
  };
  setInterval(() => {
    if (audioCtx.state !== 'running') { base = null; lost = 0; return; }
    const behind = behindNow();
    if (base === null || behind < base) { base = behind; return; }
    const late = behind - base - lost;
    const now = performance.now();
    if (late > GUARD_LATE_MS) {
      hacks++;
      lost += late;
      calmSince = now;
      // Lätta på lasten: svansarna bort, och färre röster ett tag
      voiceBudget.cap = Math.max(6, Math.min(voiceBudget.cap, Math.max(...Object.values(engines).filter(Boolean).map((e) => e.voices.size))) - 2);
      Object.values(engines).forEach((e) => e?.shedVoices());
    } else if (voiceBudget.cap < MAX_VOICES && now - calmSince > 3000) {
      voiceBudget.cap = Math.min(MAX_VOICES, voiceBudget.cap + 4);
      calmSince = now;
    }
    if (!AUDIO_DIAG.has('meter')) return;
    const msg = t(`Ljudmätare: ${hacks} avbrott (${Math.round(lost)} ms tappat ljud), högst ${voiceBudget.cap} röster`);
    if (msg !== shown) { log(msg); shown = msg; }
  }, 250);
}

// Slutmixen: allt ljud (båda ljudmotorerna, och via dem trumset, ljudfiler och XY) samlas här innan det
// går till högtalarna. Varje motor har redan egen kompressor och toppbegränsare, men två motorer som
// spelar samtidigt kan tillsammans gå över full nivå. Därför:
//  1. en gemensam limiter (−1 dBFS, snabb attack) som tar ner summan, och
//  2. ett mjukt tak sist (waveshaper): helt rakt upp till 0,9 och sedan en mjuk böj som aldrig når 1,0 –
//     så att inget någonsin klipper i ljudkortet, inte ens de första millisekunderna innan limitern hunnit
//     reagera. Vid normala nivåer påverkar ingen av dem ljudet.
const MASTER_CEILING = 0.98; // högsta möjliga nivå ut (ca −0,2 dBFS)
function makeMasterBus(ctx) {
  const input = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.12;
  const ceiling = ctx.createWaveShaper();
  const n = 4096;
  const curve = new Float32Array(n);
  const knee = 0.9;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    // Rakt upp till knee, sedan mjukt mot taket (tanh), utan hack i kurvan
    const y = a <= knee ? a : knee + (MASTER_CEILING - knee) * Math.tanh((a - knee) / (MASTER_CEILING - knee));
    curve[i] = Math.sign(x) * y;
  }
  ceiling.curve = curve;
  // Ingen översampling: dess filter kan ringa en aning över taket. Utan den kan utnivån aldrig
  // bli högre än kurvans slut (ca 0,97), oavsett vad som kommer in.
  ceiling.oversample = 'none';
  // Webbläsarens kompressor höjer nivån automatiskt (ca +0,6 dB vid de här värdena) – ta bort det,
  // så att vanligt spel låter precis som förut
  const makeup = ctx.createGain();
  makeup.gain.value = 0.936;
  input.connect(limiter).connect(makeup).connect(ceiling).connect(ctx.destination);
  Object.assign(input, { limiter, ceiling }); // (för mätning och felsökning)
  return input;
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
  // Motorn somnar inte medan ljudfilen spelar (se SynthEngine.wake)
  const holder = { released: 0, kill() {} };
  engines.notes.voices.add(holder);
  engines.notes.wake();
  // Vibrato även på ljudfiler (detune finns inte i alla äldre webbläsare)
  let vib = null;
  if (src.detune) {
    vib = audioCtx.createGain();
    vib.gain.value = 0;
    engines.notes.vibLfo.connect(vib).connect(src.detune);
  }
  const t0 = Math.max(audioCtx.currentTime, when);
  src.start(t0);
  src.onended = () => { engines.notes.voices.delete(holder); if (vib) try { engines.notes.vibLfo.disconnect(vib); } catch {} };
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
