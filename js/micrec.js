// Inspelning från mikrofonen – gemensamt för XY (js/xyrec.js) och rutorna på Toner (js/padrec.js).
//
// micStart({ max, onTick, onDone }) öppnar mikrofonen och spelar in högst max sekunder; micStop() slutar.
// Mikrofonen stängs direkt när inspelningen är klar (på iPhone låter annars allt tystare medan den är öppen).
// onDone(data, sr) får ljudet som Float32Array (mono), med tystnaden i början och slutet bortklippt,
// normaliserat (toppen till 0,9) och med korta uttoningar – eller onDone(null, sr, felmeddelande).
// Sparas i webbläsaren med micSave/micLoad/micDelete (IndexedDB, databasen hoverPads, tabellen rec).

const mic = { on: false, pending: false, stream: null, src: null, node: null, mute: null, stopCap: null, chunks: [], timer: 0, tick: 0, started: 0, max: 10, onDone: null, onTick: null };
const micActive = () => mic.on;
const micLeft = () => Math.max(0, Math.ceil(mic.max - (performance.now() - mic.started) / 1000));
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Öppna mikrofonen. Först utan webbläsarens ljudbehandling (ekosläckning m.m. förstör instrumentljud);
// går det inte, en gång till med webbläsarens vanliga inställningar.
// iPhone: appen ställer ljudet på "bara uppspelning" (js/audio.js, så att det hörs även med ljudet avstängt
// på sidoknappen). Då vägrar iOS att öppna mikrofonen ("Audiosession category is not compatible with audio
// capture"), så medan inspelningen pågår är det "uppspelning och inspelning" – sedan tillbaka.
function micSession(rec) {
  try { if (navigator.audioSession) navigator.audioSession.type = rec ? 'play-and-record' : 'playback'; } catch {}
}

async function micOpen() {
  micSession(true);
  try {
    return await micOpenStream();
  } catch (err) {
    micSession(false);
    throw err;
  }
}

async function micOpenStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (err) {
    if (['NotAllowedError', 'SecurityError', 'PermissionDeniedError'].includes(err?.name)) throw err;
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

// Vad gick fel? Felkoden (och webbläsarens egen förklaring) står inom parentes, så att den går att säga vidare.
const isStandalone = () => navigator.standalone === true || matchMedia?.('(display-mode: standalone)').matches;
function micErrorText(err) {
  const name = err?.name || 'Error';
  let msg;
  if (['NotAllowedError', 'SecurityError', 'PermissionDeniedError'].includes(name)) {
    if (isIos() && isStandalone()) msg = 'Mikrofonen är inte tillåten för appen. Öppna Inställningar → Appar → Safari → Mikrofon → Fråga eller Tillåt. Stäng sedan appen helt (svep bort den) och öppna den igen.';
    else if (isIos()) msg = 'Mikrofonen är inte tillåten för sidan. Tryck på aA i adressfältet → Webbplatsinställningar → Mikrofon → Fråga eller Tillåt, och ladda om sidan. Kolla också Inställningar → Safari → Mikrofon (Chrome och andra appar: Inställningar → Integritet och säkerhet → Mikrofon).';
    else msg = 'Mikrofonen är inte tillåten för sidan. Tillåt den med ikonen i adressfältet (webbplatsinställningar) och ladda om sidan.';
  } else if (['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(name)) {
    msg = 'Ingen mikrofon hittades.';
  } else if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name)) {
    msg = 'Mikrofonen används av något annat just nu (till exempel ett samtal eller en annan app). Stäng det och försök igen.';
  } else {
    msg = 'Mikrofonen startade inte. Ladda om sidan och försök igen.';
  }
  // Felkoden först (den syns även om raden kapas), webbläsarens förklaring sist
  return `${name}: ${t(msg)}${err?.message ? ` (${err.message})` : ''}`;
}

// Ta emot ljudet från mikrofonen: i ljudtråden (AudioWorklet) eller, om den inte går att använda,
// med den äldre ScriptProcessor. Ger { node, stop }.
async function micCapture() {
  if (audioCtx.audioWorklet && typeof AudioWorkletNode === 'function') {
    try {
      if (!audioCtx.pmModule) audioCtx.pmModule = audioCtx.audioWorklet.addModule(PM_WORKLET_URL);
      try { await audioCtx.pmModule; } catch (e) { audioCtx.pmModule = null; throw e; } // (nästa gång: försök igen)
      const node = new AudioWorkletNode(audioCtx, 'rec-capture', { numberOfOutputs: 1, outputChannelCount: [1] });
      node.port.onmessage = (e) => {
        if (e.data === 'done') { micFinish(); return; }
        mic.chunks.push(e.data);
      };
      return { node, stop: () => node.port.postMessage('stop') };
    } catch { /* reserv nedan */ }
  }
  if (!audioCtx.createScriptProcessor) return null;
  const node = audioCtx.createScriptProcessor(4096, 1, 1);
  let on = true;
  node.onaudioprocess = (e) => { if (on) mic.chunks.push(e.inputBuffer.getChannelData(0).slice()); };
  return { node, stop: () => { on = false; setTimeout(micFinish, 0); } };
}

async function micStart({ max = 10, onTick = null, onDone }) {
  if (mic.on || mic.pending) return false;
  if (!navigator.mediaDevices?.getUserMedia) {
    log(t(window.isSecureContext === false ? 'Mikrofonen fungerar bara när sidan öppnas med https.' : 'Den här webbläsaren kan inte spela in från mikrofonen.'));
    return false;
  }
  if (!audioCtx) { try { initAudio(); } catch {} }
  if (!audioCtx) return false;
  wakeAudio();
  let stream;
  try {
    stream = await micOpen();
  } catch (err) {
    log(micErrorText(err), 'error');
    return false;
  }
  const cap = await micCapture();
  if (!cap) {
    stream.getTracks().forEach((tr) => tr.stop());
    micSession(false);
    log(t('Den här webbläsaren kan inte spela in från mikrofonen.'));
    return false;
  }
  Object.assign(mic, { on: true, pending: true, stream, chunks: [], max, onDone, onTick, started: performance.now(), node: cap.node, stopCap: cap.stop });
  mic.src = audioCtx.createMediaStreamSource(stream);
  mic.mute = audioCtx.createGain();
  mic.mute.gain.value = 0; // (noden måste vara kopplad för att räknas, men ska inte höras)
  mic.src.connect(mic.node).connect(mic.mute).connect(audioCtx.destination);
  // iPhone kan pausa ljudet när mikrofonen öppnas: väck det igen (annars kommer inget ljud in)
  wakeAudio();
  mic.timer = setTimeout(micStop, max * 1000);
  mic.tick = setInterval(() => mic.onTick?.(micLeft()), 250);
  mic.onTick?.(micLeft());
  return true;
}

function micStop() {
  if (!mic.on) return;
  mic.on = false;
  clearTimeout(mic.timer);
  clearInterval(mic.tick);
  mic.stopCap?.(); // sista blocket kommer, sedan micFinish
  mic.stream?.getTracks().forEach((tr) => tr.stop()); // stäng mikrofonen direkt
  micSession(false); // (iPhone: tillbaka till bara uppspelning)
  mic.onTick?.(0);
  setTimeout(micFinish, 800); // (om ljudet var pausat kommer inget svar från ljudtråden)
  setTimeout(() => { wakeAudio(); }, 300); // (iPhone: ljudet tillbaka)
}

function micFinish() {
  if (!mic.pending || mic.on) return;
  mic.pending = false;
  try { mic.src?.disconnect(); mic.node?.disconnect(); mic.mute?.disconnect(); } catch {}
  if (mic.node) mic.node.onaudioprocess = null;
  mic.src = mic.node = mic.mute = mic.stream = mic.stopCap = null;
  const sr = audioCtx.sampleRate;
  const n = mic.chunks.reduce((a, c) => a + c.length, 0);
  const done = mic.onDone;
  mic.onDone = null;
  if (!n) { mic.chunks = []; done?.(null, sr, t('Inget ljud kom in från mikrofonen (ljudet var pausat). Försök igen.')); return; }
  const raw = new Float32Array(Math.min(n, Math.round(mic.max * sr)));
  let o = 0;
  for (const c of mic.chunks) { if (o >= raw.length) break; raw.set(c.subarray(0, raw.length - o), o); o += c.length; }
  mic.chunks = [];
  const res = micClean(raw, sr);
  if (typeof res === 'string') done?.(null, sr, res);
  else done?.(res, sr);
}

// Klipp bort tystnaden i början och slutet, normalisera och tona in/ut.
// Tyst = under 4 % av toppen (ca −28 dB) mätt i block om 10 ms. Lite marginal behålls: 15 ms före ljudet
// (så att anslaget inte kapas) och 80 ms efter (så att det klingar ut).
function micClean(data, sr) {
  if (data.length < sr * 0.05) return t('Inspelningen blev för kort. Försök igen.');
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 1e-4) return t('Det hördes inget i mikrofonen. Försök igen.');
  const win = Math.round(sr * 0.01);
  const thr = Math.max(peak * 0.04, 0.002);
  const loud = (a) => { let m = 0; for (let i = a; i < Math.min(data.length, a + win); i++) m = Math.max(m, Math.abs(data[i])); return m >= thr; };
  let first = 0;
  while (first < data.length && !loud(first)) first += win;
  let last = data.length - win;
  while (last > first && !loud(last)) last -= win;
  const a = Math.max(0, first - Math.round(sr * 0.015));
  const b = Math.min(data.length, last + win + Math.round(sr * 0.08));
  const out = data.slice(a, b);
  if (out.length < sr * 0.03) return t('Inspelningen blev för kort. Försök igen.');
  const k = 0.9 / peak;
  const fadeIn = Math.round(sr * 0.004);
  const fadeOut = Math.round(sr * 0.03);
  for (let i = 0; i < out.length; i++) out[i] *= k * Math.min(1, i / fadeIn, (out.length - 1 - i) / fadeOut);
  return out;
}

// ---------- Spara i webbläsaren (IndexedDB) ----------
// (en enda öppen anslutning, så att databasen går att radera – se micEraseAll)
let micDbOpen = null;
function micDb() {
  if (!micDbOpen) {
    micDbOpen = new Promise((resolve, reject) => {
      const req = indexedDB.open('hoverPads', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('rec');
      req.onsuccess = () => {
        req.result.onversionchange = () => { req.result.close(); micDbOpen = null; };
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
    micDbOpen.catch(() => { micDbOpen = null; });
  }
  return micDbOpen;
}

// Radera alla inspelningar och rutornas ljudfiler (Om → Radera sparade uppgifter)
async function micEraseAll() {
  try { if (micDbOpen) (await micDbOpen).close(); } catch {}
  micDbOpen = null;
  await new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase('hoverPads');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch { resolve(); }
    setTimeout(resolve, 1500);
  });
}
async function micSave(key, value) {
  try { (await micDb()).transaction('rec', 'readwrite').objectStore('rec').put(value, key); } catch { /* ingen lagring */ }
}
async function micDelete(key) {
  try { (await micDb()).transaction('rec', 'readwrite').objectStore('rec').delete(key); } catch { /* ingen lagring */ }
}
async function micLoad(key) {
  try {
    const db = await micDb();
    return await new Promise((resolve) => {
      const req = db.transaction('rec').objectStore('rec').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}
