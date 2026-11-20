// Sidan Toner.

// ---------- Sidan "Toner" ----------
function noteScale() {
  if (drumKitOn()) return notePads.map((_, i) => drumPiece(ui.drumKit.value, i).gm);
  const scale = SCALES[ui.scale.value];
  const base = 12 * (Number(ui.octave.value) + 1) + Number(ui.root.value); // C4 = 60
  return Array.from({ length: notePads.length }, (_, i) =>
    clampNote(base + 12 * Math.floor(i / scale.length) + scale[i % scale.length])
  );
}

// Lägger till eller tar bort rutor i slutet, så att uppladdade ljudfiler finns kvar.
function buildNotePads() {
  const count = Number(ui.noteCount.value);
  notePads.forEach(release);
  while (notePads.length > count) notePads.pop().el.remove();
  while (notePads.length < count) addNotePad(notePads.length);
  updateNotes();
  if (typeof padRestoreSamples === 'function') padRestoreSamples(); // sparade inspelningar och ljudfiler
  layoutPads();
}

function addNotePad(i) {
  const el = document.createElement('button');
  el.className = 'pad';
  el.type = 'button';
  const pad = {
    el, note: 0, sample: null, sampleName: '', release: null,
    notes: () => [pad.note],
    label: () => (pad.drum ? pad.drum.name : noteName(pad.note)),
  };
  notePads.push(pad);
  attachHover(pad, el);

  // Dra-och-släpp en ljudfil till en ruta
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', (e) => onDropSample(e, pad));
  // Högerklick tar bort ljudfilen
  el.addEventListener('contextmenu', (e) => {
    if (!pad.sample) return;
    e.preventDefault();
    pad.sample = null;
    renderNotePad(pad);
    micDelete(`pad${notePads.indexOf(pad)}`); // (sparad i webbläsaren)
    log(`Ruta ${i + 1}: ljudfil borttagen`);
  });

  ui.pads.append(el);
}

function updateNotes() {
  notePads.forEach(release);
  const kit = drumKitOn() ? ui.drumKit.value : '';
  document.body.classList.toggle('drums', !!kit);
  syncSoundSelect(); // listan Ljud visar trumsetet på sidan Toner
  noteScale().forEach((n, i) => {
    notePads[i].note = n;
    notePads[i].drum = kit ? drumPiece(kit, i) : null;
    renderNotePad(notePads[i]);
  });
  renderPadKeys(); // tonnamnen i listan över tangenter (Hjälpmedel → Tangentbord)
}

function renderNotePad(pad) {
  pad.el.classList.toggle('sample', !!pad.sample);
  // Grundtonen (i alla oktaver) får ljusare ruta – följer med när grundton, skala eller antal ändras
  pad.el.classList.toggle('root', !pad.drum && pad.note % 12 === Number(ui.root.value));
  pad.el.classList.toggle('drum', !!pad.drum);
  // Trummor med symbol: symbolen syns, namnet finns för skärmläsare och som verktygstips
  const icon = pad.drum && !pad.sample ? pad.drum.icon : '';
  pad.el.classList.toggle('drum-sym', !!icon);
  if (icon) {
    pad.el.setAttribute('aria-label', pad.drum.name);
    pad.el.title = pad.drum.name;
  } else {
    pad.el.removeAttribute('aria-label');
    pad.el.removeAttribute('title');
  }
  pad.el.innerHTML = `${icon || pad.label()}<small>${
    pad.sample ? `${padSampleSecs(pad)} s` : `MIDI ${pad.note}`
  }</small>${pad.sample ? padSampleMarks(pad) : ''}`;
  // En ruta med inspelning/ljudfil: det hörs också för skärmläsare och syns som verktygstips
  if (pad.sample) {
    const what = `${pad.label()}: ${pad.sampleName} (${padSampleSecs(pad)} s)`;
    pad.el.setAttribute('aria-label', what);
    pad.el.title = what;
  }
}

const padSampleSecs = (pad) => { const v = pad.sample.duration.toFixed(1); return LANG === 'en' ? v : v.replace('.', ','); };

// Rutans ljud syns: en röd prick (inspelning) eller en not (ljudfil) i hörnet och vågformen längst ned
function padSampleMarks(pad) {
  if (pad.samplePeaksOf !== pad.sample) {
    const d = pad.sample.getChannelData(0);
    const cols = 40;
    const per = d.length / cols;
    const peaks = [];
    let top = 1e-6;
    for (let c = 0; c < cols; c++) {
      let m = 0;
      for (let i = Math.floor(c * per), end = Math.min(d.length, Math.floor((c + 1) * per)); i < end; i += 4) m = Math.max(m, Math.abs(d[i]));
      peaks.push(m);
      top = Math.max(top, m);
    }
    pad.samplePeaks = peaks.map((m) => Math.max(0.06, m / top));
    pad.samplePeaksOf = pad.sample;
  }
  const bars = pad.samplePeaks.map((m, c) => `<rect x="${c + 0.15}" y="${(10 - m * 10).toFixed(2)}" width="0.7" height="${(m * 20).toFixed(2)}"/>`).join('');
  const rec = pad.sampleName === t('Inspelning');
  const badge = rec
    ? '<svg class="pad-sample-badge rec" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>'
    : '<svg class="pad-sample-badge" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M9 17.5a3 3 0 1 1-2-2.83V5l11-2v11.5a3 3 0 1 1-2-2.83V6.4l-7 1.27z"/></svg>';
  return `${badge}<svg class="pad-wave" viewBox="0 0 40 20" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}

async function onDropSample(e, pad) {
  e.preventDefault();
  pad.el.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!audioCtx) { log('Starta först, sedan kan du släppa ljudfiler.'); return; }
  try {
    pad.sample = await audioCtx.decodeAudioData(await file.arrayBuffer());
    pad.sampleName = file.name;
    renderNotePad(pad);
    padSaveSample(pad); // finns kvar efter omladdning
    log(`Laddade "${file.name}" till ${noteName(pad.note)}`);
  } catch {
    log(`Kunde inte läsa "${file.name}" som ljud.`);
  }
}
