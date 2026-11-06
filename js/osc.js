// OSC-utgång. Webbläsare får inte skicka UDP, så appen skickar riktiga OSC-paket över en
// WebSocket till en liten brygga på datorn (tools/osc-bridge.mjs), som skickar dem vidare som
// vanlig OSC/UDP till t.ex. Max, Pure Data, Ableton (via Max for Live), TouchDesigner eller QLab.
//
// Meddelanden (prefix /hoverpads kan ändras):
//   /hoverpads/note    i:ton (MIDI-nummer)  i:styrka (0 = släpp)
//   /hoverpads/pad     s:sida (notes|chords)  i:ruta (1–)  i:1 = på, 0 = av
//   /hoverpads/chord   s:ackordnamn  i:ruta  (när en ackordruta slås an)
//   /hoverpads/vibrato s:sida  i:ruta  f:djup i cent
//   /hoverpads/test    s:"hej"

const osc = { ws: null, url: '', retry: 0, open: false };

// ---------- OSC-kodning (OSC 1.0: strängar och typtaggar fylls ut till hela 4 byte) ----------
const oscText = new TextEncoder();
function oscString(s) {
  const b = oscText.encode(s);
  const out = new Uint8Array(Math.ceil((b.length + 1) / 4) * 4);
  out.set(b);
  return out;
}

// args: heltal blir i, decimaltal f, text s. { f: x } tvingar fram f (t.ex. 20 cent som 20.0).
function oscMessage(address, args = []) {
  const types = args.map((a) => (typeof a === 'string' ? 's' : typeof a === 'object' || !Number.isInteger(a) ? 'f' : 'i')).join('');
  args = args.map((a) => (typeof a === 'object' ? a.f : a));
  const parts = [oscString(address), oscString(`,${types}`)];
  args.forEach((a, k) => {
    if (types[k] === 's') { parts.push(oscString(a)); return; }
    const buf = new DataView(new ArrayBuffer(4)); // stor-endian enligt OSC
    if (types[k] === 'i') buf.setInt32(0, a);
    else buf.setFloat32(0, a);
    parts.push(new Uint8Array(buf.buffer));
  });
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}

function oscSend(path, ...args) {
  if (!ui.outOsc.checked || !osc.open) return;
  const prefix = (ui.oscPrefix.value.trim() || '/hoverpads').replace(/\/+$/, '');
  try { osc.ws.send(oscMessage(`${prefix.startsWith('/') ? '' : '/'}${prefix}/${path}`, args)); } catch {}
}

// ---------- Anslutning ----------
function oscStatus(text, ok = false) {
  const el = $('osc-status');
  el.textContent = text;
  el.classList.toggle('ok', ok);
}

function oscConnect() {
  clearTimeout(osc.retry);
  const url = ui.oscUrl.value.trim();
  if (osc.ws && (osc.url !== url || !ui.outOsc.checked)) { osc.ws.onclose = null; osc.ws.close(); osc.ws = null; osc.open = false; }
  if (!ui.outOsc.checked) { oscStatus('Av'); return; }
  if (osc.ws) return;
  osc.url = url;
  let ws;
  try { ws = new WebSocket(url); } catch { oscStatus('Ogiltig adress'); return; }
  ws.binaryType = 'arraybuffer';
  osc.ws = ws;
  oscStatus('Ansluter …');
  ws.onopen = () => { osc.open = true; oscStatus(`Ansluten till ${url}`, true); log(`OSC: ansluten till ${url}`); };
  ws.onclose = () => {
    osc.open = false;
    osc.ws = null;
    if (!ui.outOsc.checked) return;
    oscStatus('Ingen kontakt med bryggan – försöker igen …');
    osc.retry = setTimeout(oscConnect, 3000); // bryggan kanske inte startats än
  };
  ws.onerror = () => {}; // onclose sköter det
}

// Rutans sida och nummer (1–)
function padId(pad) {
  const chordIdx = chordPads.indexOf(pad);
  return chordIdx >= 0 ? ['chords', chordIdx + 1] : ['notes', notePads.indexOf(pad) + 1];
}

// Anropas från trigger(): skickar på-meddelanden och returnerar en stoppfunktion (med vibrato)
function oscNoteOn(pad, notes) {
  if (!ui.outOsc.checked || !osc.open) return null;
  const [page, index] = padId(pad);
  const vel = Number(ui.velocity.value) || 100;
  oscSend('pad', page, index, 1);
  if (pad.chord) oscSend('chord', pad.label(), index);
  notes.forEach((n) => oscSend('note', n, vel));
  const stop = () => {
    notes.forEach((n) => oscSend('note', n, 0));
    oscSend('pad', page, index, 0);
  };
  stop.vibrato = (cents) => oscSend('vibrato', page, index, { f: cents });
  return stop;
}

// Enstaka ton (harpan)
function oscPluck(note) {
  if (!ui.outOsc.checked || !osc.open) return null;
  oscSend('note', note, Number(ui.velocity.value) || 100);
  return () => oscSend('note', note, 0);
}

function setupOsc() {
  ui.outOsc.addEventListener('change', oscConnect);
  ui.oscUrl.addEventListener('change', oscConnect);
  $('osc-test').addEventListener('click', () => {
    if (!osc.open) { log('OSC: inte ansluten – starta bryggan och kryssa i OSC.'); return; }
    oscSend('test', 'hej');
    log('OSC: skickade /test');
  });
  oscConnect();
}
