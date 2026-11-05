// Mina presets: användaren sparar hela uppsättningen (ljud, ackord, färger, voicing, toner,
// formation, mellanrum, utgångar) under ett namn och kan ladda den igen. Sparas i webbläsaren
// och kan exporteras/importeras som JSON-fil.

const USER_PRESETS_KEY = 'hoverPadsUserPresets';
const USER_PRESET_ACTIVE_KEY = 'hoverPadsUserPresetActive';

function loadUserPresets() {
  try {
    const list = JSON.parse(localStorage.getItem(USER_PRESETS_KEY));
    return Array.isArray(list) ? list.filter((p) => p && p.name && p.data) : [];
  } catch {
    return [];
  }
}

const saveUserPresets = (list) => localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(list));

// Ögonblicksbild av allt som går att ställa in
function snapshot() {
  const settings = {};
  for (const k of SAVED) settings[k] = ui[k].type === 'checkbox' ? ui[k].checked : ui[k].value;
  return {
    v: 1,
    settings,
    chords: chords.map((c) => ({ ...c })),
    synth: { preset: synthPreset, params: { ...synthParams }, lib: { ...synthLib } },
  };
}

function applySnapshot(data) {
  allPads().forEach(release);
  closeChordPicker();

  // Inställningar (bara kända nycklar)
  for (const [k, v] of Object.entries(data.settings || {})) {
    if (!SAVED.includes(k)) continue;
    if (ui[k].type === 'checkbox') ui[k].checked = !!v;
    else ui[k].value = v;
  }
  saveSettings();

  // Ackord
  if (Array.isArray(data.chords) && data.chords.length === MAX_CHORDS) {
    chords = data.chords.map(normalizeChord);
    saveChords();
  }

  // Ljud
  if (data.synth && data.synth.params) {
    const preset = data.synth.preset in SYNTH_PRESETS ? data.synth.preset : CUSTOM;
    synthLib = preset === CUSTOM && data.synth.lib ? { ...data.synth.lib } : { name: '', edited: false };
    applySynth({ ...SYNTH_DEFAULTS, ...data.synth.params }, preset);
  }
  if (engine) engine.setVolume(Number(ui.volume.value));

  // Rita om allt
  syncFormationButtons();
  document.body.classList.toggle('advanced', isAdvanced());
  applyGap();
  applyFormationOpts();
  buildNotePads();
  buildChordPads();
}

function describe(data) {
  const s = data.settings || {};
  const n = Number(s.chordCount) || 4;
  const chordList = (data.chords || []).slice(0, n).map(chordName).join(' ');
  const sound = data.synth?.preset in SYNTH_PRESETS ? data.synth.preset
    : data.synth?.lib?.name || 'eget ljud';
  return `${chordList} · ${FORMATIONS[s.formation] || ''} · ${sound}`;
}

function renderUserPresets() {
  const box = $('up-list');
  const list = loadUserPresets();
  const active = localStorage.getItem(USER_PRESET_ACTIVE_KEY);
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<p class="up-empty">Inga sparade presets än. Ställ in allt som du vill ha det, skriv ett namn och tryck Spara.</p>';
    return;
  }
  list.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'up-item';
    row.classList.toggle('on', p.name === active);
    const n = Number(p.data.settings?.chordCount) || 4;
    const swatches = (p.data.chords || []).slice(0, n)
      .map((c) => `<i style="background:${c.color || '#3a3f55'}"></i>`).join('');
    row.innerHTML = `<span class="swatches">${swatches}</span>
      <div><strong></strong><br><small></small></div>
      <button type="button" class="up-load">Ladda</button>
      <button type="button" class="up-over" title="Spara nuvarande inställningar under det här namnet">Skriv över</button>
      <button type="button" class="up-del" title="Ta bort">✕</button>`;
    row.querySelector('strong').textContent = p.name;
    row.querySelector('small').textContent = describe(p.data);
    row.querySelector('.up-load').addEventListener('click', () => {
      applySnapshot(p.data);
      localStorage.setItem(USER_PRESET_ACTIVE_KEY, p.name);
      renderUserPresets();
      log(`Laddade presetet "${p.name}"`);
    });
    row.querySelector('.up-over').addEventListener('click', () => {
      if (!confirm(`Skriva över "${p.name}" med nuvarande inställningar?`)) return;
      storeUserPreset(p.name);
    });
    row.querySelector('.up-del').addEventListener('click', () => {
      if (!confirm(`Ta bort presetet "${p.name}"?`)) return;
      saveUserPresets(loadUserPresets().filter((q) => q.name !== p.name));
      renderUserPresets();
      log(`Tog bort presetet "${p.name}"`);
    });
    box.append(row);
  });
}

function storeUserPreset(name) {
  const list = loadUserPresets();
  const entry = { name, saved: new Date().toISOString(), data: snapshot() };
  const i = list.findIndex((p) => p.name === name);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  saveUserPresets(list);
  localStorage.setItem(USER_PRESET_ACTIVE_KEY, name);
  renderUserPresets();
  log(`Sparade presetet "${name}"`);
}

function exportUserPresets() {
  const list = loadUserPresets();
  if (!list.length) { log('Det finns inga presets att exportera.'); return; }
  const blob = new Blob([JSON.stringify({ app: 'hover-pads', v: 1, presets: list }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hover-pads-presets.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importUserPresets(file) {
  try {
    const json = JSON.parse(await file.text());
    const incoming = (Array.isArray(json) ? json : json.presets || []).filter((p) => p && p.name && p.data);
    if (!incoming.length) throw new Error('inga presets');
    const list = loadUserPresets();
    for (const p of incoming) {
      const i = list.findIndex((q) => q.name === p.name);
      if (i >= 0) list[i] = p;
      else list.push(p);
    }
    saveUserPresets(list);
    renderUserPresets();
    log(`Importerade ${incoming.length} preset${incoming.length === 1 ? '' : 's'} från ${file.name}`);
  } catch {
    log(`Kunde inte läsa presets från ${file.name}`);
  }
}

function setupUserPresets() {
  $('up-save').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('up-name').value.trim();
    if (!name) { $('up-name').focus(); return; }
    if (loadUserPresets().some((p) => p.name === name)
      && !confirm(`Det finns redan ett preset som heter "${name}". Skriva över det?`)) return;
    storeUserPreset(name);
    $('up-name').value = '';
  });
  $('up-export').addEventListener('click', exportUserPresets);
  $('up-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importUserPresets(file);
    e.target.value = '';
  });
  renderUserPresets();
}
