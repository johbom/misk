// Toner: spela in en egen inspelning per ruta (från mikrofonen), och spara rutornas ljud i webbläsaren.
//
// ● Spela in i spelraden (sidan Toner) slår på inspelningsläget. Då spelar rutorna inte (varken när man
// svävar över dem eller trycker); i stället:
//  - tryck på en ruta (mus, finger, tangent, kontakt, joystick) = börja spela in till den rutan,
//    tryck igen (eller på knappen) = sluta. Högst 10 sekunder. Tystnaden i början och slutet klipps bort.
//  - ✕ Ta bort, sedan en ruta = rutan får tillbaka sin ton (eller sin trumma).
//  - Klar (samma knapp) = tillbaka till att spela.
// Inspelningen blir rutans ljudfil – samma som en fil man dragit dit – och spelas när rutan spelas.
// Rutornas ljudfiler (inspelade och dragna) sparas i webbläsaren och finns kvar efter omladdning.

const PADREC_MAX_S = 10;
const padRec = { on: false, del: false, pad: null, pending: new Map() }; // pending: index -> sparat ljud
const padRecOn = () => padRec.on && document.body.dataset.tab === 'notes';

function padRecSetMode(on) {
  if (!on && padRec.pad) micStop();
  padRec.on = on;
  padRec.del = false;
  if (on) { notePads.forEach(release); allPads().forEach((p) => p.el.classList.remove('active')); }
  padRecSync();
  log(t(on ? 'Inspelningsläge: tryck på rutan som ska få en inspelning. Tryck igen för att sluta (högst 10 s).' : 'Inspelningsläget är av.'));
}

// En ruta valdes i inspelningsläget (anropas av klick, tangenter, kontakt och joystick)
function padRecPick(pad) {
  const i = notePads.indexOf(pad);
  if (i < 0) return;
  if (padRec.pad) { if (padRec.pad === pad) micStop(); return; } // en inspelning pågår: samma ruta = stopp
  if (padRec.del) {
    padRec.del = false;
    if (pad.sample) {
      pad.sample = null;
      pad.sampleName = '';
      renderNotePad(pad);
      micDelete(`pad${i}`);
      log(t(`Ruta ${i + 1}: inspelningen borttagen`));
    } else log(t(`Ruta ${i + 1} har ingen inspelning.`));
    padRecSync();
    return;
  }
  padRecStart(pad);
}

async function padRecStart(pad) {
  padRec.pad = pad;
  padRecSync();
  const ok = await micStart({
    max: PADREC_MAX_S,
    onTick: () => padRecSync(),
    onDone: (data, sr, err) => padRecDone(pad, data, sr, err),
  });
  if (!ok) { padRec.pad = null; padRecSync(); return; }
  log(t(`Spelar in till ruta ${notePads.indexOf(pad) + 1} … tryck på rutan igen för att sluta.`));
}

function padRecDone(pad, data, sr, err) {
  padRec.pad = null;
  padRecSync();
  if (!data) { log(err); return; }
  const i = notePads.indexOf(pad);
  const name = t('Inspelning');
  padSetSample(pad, [data], sr, name);
  micSave(`pad${i}`, { sr, chans: [data], name });
  log(t(`Ruta ${i + 1}: inspelning ${(data.length / sr).toFixed(1).replace('.', ',')} s`));
}

// Rutans ljud från kanaldata
function padSetSample(pad, chans, sr, name) {
  const buf = audioCtx.createBuffer(chans.length, chans[0].length, sr);
  chans.forEach((c, k) => buf.copyToChannel(c, k));
  pad.sample = buf;
  pad.sampleName = name;
  renderNotePad(pad);
}

// Spara en dragen ljudfil (js/notes.js) så att den finns kvar efter omladdning
function padSaveSample(pad) {
  const i = notePads.indexOf(pad);
  if (i < 0 || !pad.sample) return;
  const chans = Array.from({ length: Math.min(2, pad.sample.numberOfChannels) }, (_, k) => pad.sample.getChannelData(k).slice());
  micSave(`pad${i}`, { sr: pad.sample.sampleRate, chans, name: pad.sampleName });
}

// Sparade ljud läses in direkt men blir ljudbuffertar först när ljudet startats och rutan finns
function padRestoreSamples() {
  if (!audioCtx) return;
  for (const [i, v] of padRec.pending) {
    const pad = notePads[i];
    if (!pad) continue;
    padSetSample(pad, v.chans, v.sr, v.name || t('Inspelning'));
    padRec.pending.delete(i);
  }
}

async function padLoadSamples() {
  for (let i = 0; i < 24; i++) {
    const v = await micLoad(`pad${i}`);
    if (v?.chans?.length && v.chans[0]?.length) padRec.pending.set(i, v);
  }
  padRestoreSamples();
}

// Knapparna och rutornas utseende
function padRecSync() {
  const b = $('pad-rec');
  const del = $('pad-rec-del');
  if (!b) return;
  const rec = !!padRec.pad;
  document.body.classList.toggle('pad-rec', padRec.on);
  document.body.classList.toggle('pad-rec-del', padRec.on && padRec.del);
  b.classList.toggle('on', padRec.on && !rec);
  b.classList.toggle('recording', rec);
  b.setAttribute('aria-pressed', padRec.on);
  b.querySelector('span').textContent = rec ? `${micLeft()} s` : t(padRec.on ? 'Klar' : 'Spela in');
  b.title = t(rec ? 'Sluta spela in' : padRec.on ? 'Tillbaka till att spela' : 'Spela in en egen inspelning till en ruta (från mikrofonen)');
  b.querySelector('svg').innerHTML = rec ? '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>'
    : padRec.on ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>' : XYREC_DOT;
  del.hidden = !padRec.on || rec;
  del.classList.toggle('on', padRec.del);
  del.setAttribute('aria-pressed', padRec.del);
  notePads.forEach((p) => p.el.classList.toggle('pad-recording', p === padRec.pad));
  if (rec) padRec.pad.el.dataset.recLeft = `${micLeft()} s`;
}

function setupPadRec() {
  $('pad-rec').addEventListener('click', () => {
    if (padRec.pad) { micStop(); return; }
    padRecSetMode(!padRec.on);
  });
  $('pad-rec-del').addEventListener('click', () => {
    padRec.del = !padRec.del;
    padRecSync();
    log(t(padRec.del ? 'Tryck på rutan vars inspelning ska tas bort.' : 'Inspelningsläge: tryck på rutan som ska få en inspelning. Tryck igen för att sluta (högst 10 s).'));
  });
  // Klick eller tryck på en ruta i inspelningsläget (svävning räknas inte – det skulle starta av misstag)
  $('pads').addEventListener('click', (e) => {
    if (!padRecOn()) return;
    const pad = notePads.find((p) => p.el === e.target.closest('.pad'));
    if (pad) padRecPick(pad);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && padRec.on && !padRec.pad) padRecSetMode(false);
  });
  padRecSync();
  padLoadSamples();
}
