// Sidan Toner.

// ---------- Sidan "Toner" ----------
function noteScale() {
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
  layoutPads();
}

function addNotePad(i) {
  const el = document.createElement('button');
  el.className = 'pad';
  el.type = 'button';
  const pad = {
    el, note: 0, sample: null, sampleName: '', release: null,
    notes: () => [pad.note],
    label: () => noteName(pad.note),
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
    log(`Ruta ${i + 1}: ljudfil borttagen`);
  });

  ui.pads.append(el);
}

function updateNotes() {
  notePads.forEach(release);
  noteScale().forEach((n, i) => { notePads[i].note = n; renderNotePad(notePads[i]); });
}

function renderNotePad(pad) {
  pad.el.classList.toggle('sample', !!pad.sample);
  pad.el.innerHTML = `${noteName(pad.note)}<small>${
    pad.sample ? pad.sampleName : `MIDI ${pad.note}`
  }</small>`;
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
    log(`Laddade "${file.name}" till ${noteName(pad.note)}`);
  } catch {
    log(`Kunde inte läsa "${file.name}" som ljud.`);
  }
}
