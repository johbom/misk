// Inspelning från mikrofonen – gemensamt för XY (js/xyrec.js) och rutorna på Toner (js/padrec.js).
//
// micStart({ max, onTick, onDone }) öppnar mikrofonen och spelar in högst max sekunder; micStop() slutar.
// Mikrofonen stängs direkt när inspelningen är klar (på iPhone låter annars allt tystare medan den är öppen).
// onDone(data, sr) får ljudet som Float32Array (mono), med tystnaden i början och slutet bortklippt,
// normaliserat (toppen till 0,9) och med korta uttoningar – eller onDone(null, sr, felmeddelande).
// Sparas i webbläsaren med micSave/micLoad/micDelete (IndexedDB, databasen hoverPads, tabellen rec).

const mic = { on: false, stream: null, src: null, node: null, mute: null, chunks: [], timer: 0, tick: 0, started: 0, max: 10, onDone: null, onTick: null };
const micActive = () => mic.on;
const micLeft = () => Math.max(0, Math.ceil(mic.max - (performance.now() - mic.started) / 1000));

async function micStart({ max = 10, onTick = null, onDone }) {
  if (mic.on) return false;
  if (!navigator.mediaDevices?.getUserMedia) { log(t('Den här webbläsaren kan inte spela in från mikrofonen.')); return false; }
  if (!audioCtx) { try { initAudio(); } catch {} }
  if (!audioCtx) return false;
  if (audioCtx.state !== 'running') audioCtx.resume();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch {
    log(t('Mikrofonen gick inte att öppna. Tillåt mikrofonen för sidan och försök igen.'));
    return false;
  }
  // Ljudtrådens modul (laddas annars först när ett ljud behöver den)
  if (!audioCtx.pmModule) audioCtx.pmModule = audioCtx.audioWorklet.addModule(PM_WORKLET_URL);
  try { await audioCtx.pmModule; } catch {
    stream.getTracks().forEach((tr) => tr.stop());
    log(t('Mikrofonen gick inte att öppna. Tillåt mikrofonen för sidan och försök igen.'));
    return false;
  }
  Object.assign(mic, { on: true, stream, chunks: [], max, onDone, onTick, started: performance.now() });
  mic.src = audioCtx.createMediaStreamSource(stream);
  mic.node = new AudioWorkletNode(audioCtx, 'rec-capture', { numberOfOutputs: 1, outputChannelCount: [1] });
  mic.node.port.onmessage = (e) => {
    if (e.data === 'done') { micFinish(); return; }
    mic.chunks.push(e.data);
  };
  mic.mute = audioCtx.createGain();
  mic.mute.gain.value = 0; // (noden måste vara kopplad för att räknas, men ska inte höras)
  mic.src.connect(mic.node).connect(mic.mute).connect(audioCtx.destination);
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
  mic.node?.port.postMessage('stop'); // sista blocket kommer, sedan 'done'
  mic.stream?.getTracks().forEach((tr) => tr.stop()); // stäng mikrofonen direkt
  mic.onTick?.(0);
}

function micFinish() {
  try { mic.src?.disconnect(); mic.node?.disconnect(); mic.mute?.disconnect(); } catch {}
  mic.src = mic.node = mic.mute = mic.stream = null;
  const sr = audioCtx.sampleRate;
  const n = mic.chunks.reduce((a, c) => a + c.length, 0);
  const raw = new Float32Array(Math.min(n, Math.round(mic.max * sr)));
  let o = 0;
  for (const c of mic.chunks) { if (o >= raw.length) break; raw.set(c.subarray(0, raw.length - o), o); o += c.length; }
  mic.chunks = [];
  const done = mic.onDone;
  mic.onDone = null;
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
function micDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hoverPads', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('rec');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
