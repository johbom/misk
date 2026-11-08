// Ljudmotorns reglage, de tio snabbpreseten och presetbiblioteket.

// ---------- Ljudmotor: presets och reglage ----------
const CUSTOM = '__custom';
let synthParams;
let synthPreset;
const synthInputs = {}; // key -> { row, input, output, def }
// Ljud från presetbiblioteket laddas in i "Eget": namn + om man har skruvat efteråt
let synthLib = { name: '', edited: false };

(function loadSynth() {
  try {
    const saved = JSON.parse(localStorage.getItem('hoverPadsSynth'));
    if (saved && saved.params) {
      synthPreset = saved.preset in SYNTH_PRESETS || saved.preset === CUSTOM ? saved.preset : CUSTOM;
      synthParams = { ...SYNTH_DEFAULTS, ...saved.params };
      if (saved.lib && synthPreset === CUSTOM) synthLib = saved.lib;
      return;
    }
  } catch {}
  synthPreset = DEFAULT_PRESET;
  synthParams = presetParams(DEFAULT_PRESET);
})();

const saveSynth = () =>
  localStorage.setItem('hoverPadsSynth', JSON.stringify({ preset: synthPreset, params: synthParams, lib: synthLib }));

// Logaritmiska reglage går 0..1000 och räknas om till t.ex. 40 Hz..18 kHz.
const toSlider = (d, v) => (d.log ? Math.round(1000 * Math.log(v / d.min) / Math.log(d.max / d.min)) : v);
const fromSlider = (d, s) => {
  if (!d.log) return Number(s);
  const v = d.min * Math.pow(d.max / d.min, Number(s) / 1000);
  return v < 1 ? Number(v.toFixed(3)) : v < 100 ? Number(v.toFixed(2)) : Math.round(v);
};

function buildSynthPanel() {
  const root = $('synth-groups');
  let box;
  for (const d of SYNTH_PARAMS) {
    if (d.group) {
      box = document.createElement('fieldset');
      box.innerHTML = `<legend>${d.group}</legend>`;
      if (d.op) box.dataset.op = d.op;
      root.append(box);
    }
    const row = document.createElement('label');
    row.className = 'knob';
    row.append(d.label);
    let input;
    const output = document.createElement('output');
    if (d.options) {
      input = document.createElement('select');
      d.options.forEach(([v, text]) => input.append(new Option(text, v)));
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.min = d.log ? 0 : d.min;
      input.max = d.log ? 1000 : d.max;
      input.step = d.log ? 1 : d.step;
    }
    row.append(input);
    if (!d.options) row.append(output);
    box.append(row);
    synthInputs[d.key] = { row, input, output, def: d };

    input.addEventListener('input', () => {
      const v = d.options ? input.value : fromSlider(d, input.value);
      synthParams[d.key] = v;
      if (!d.options) output.textContent = d.fmt(v);
      engine && engine.set(d.key, v);
      if (synthPreset === CUSTOM && synthLib.name) synthLib.edited = true;
      else if (synthPreset !== CUSTOM) synthLib = { name: synthPreset, edited: true }; // "Piano (ändrat)"
      synthPreset = CUSTOM;
      updateCustomLabel();
      ui.preset.value = CUSTOM;
      refreshSynthDisabled();
      saveSynth();
    });
  }
}

function syncSynthPanel() {
  for (const { input, output, def } of Object.values(synthInputs)) {
    const v = synthParams[def.key];
    input.value = def.options ? v : toSlider(def, v);
    if (!def.options) output.textContent = def.fmt(v);
    if (input.segBox) syncSegment(input);
  }
  refreshSynthDisabled();
}

// Döljer reglage för en annan motor och gråar ut sådana som inte gör något just nu
function refreshSynthDisabled() {
  for (const [key, { row }] of Object.entries(synthInputs)) {
    const hide = !!SYNTH_HIDDEN_WHEN[key]?.(synthParams);
    row.classList.toggle('hide', hide);
    row.classList.toggle('off', !hide && !!SYNTH_DISABLED_WHEN[key]?.(synthParams));
  }
  document.querySelectorAll('#synth-groups > fieldset').forEach((fs) => {
    fs.hidden = !fs.querySelector('.knob:not(.hide)');
  });
  // FM: rubriken visar vad varje operator gör i den valda algoritmen
  const algo = FM_ALGOS[synthParams.fmAlgo] || FM_ALGOS[1];
  document.querySelectorAll('#synth-groups > fieldset[data-op]').forEach((fs) => {
    const k = Number(fs.dataset.op) - 1;
    const targets = algo.mods.map((m, i) => (m.includes(k) ? i + 1 : 0)).filter(Boolean);
    const role = algo.car.includes(k) ? 'hörs' : `→ modulerar ${targets.join(' och ')}`;
    fs.querySelector('legend').textContent = `Operator ${k + 1} · ${role}${k === 3 && synthParams.fmFb > 0 ? ' (återkoppling)' : ''}`;
    fs.classList.toggle('fm-carrier', algo.car.includes(k));
  });
}

function applySynth(params, preset) {
  allPads().forEach(release);
  synthParams = { ...params };
  synthPreset = preset;
  updateCustomLabel();
  ui.preset.value = preset;
  syncSynthPanel();
  engine && engine.setParams(synthParams);
  saveSynth();
}

function randomSynth() {
  const p = { ...SYNTH_DEFAULTS };
  for (const d of SYNTH_PARAMS) {
    if (d.options) p[d.key] = d.options[Math.floor(Math.random() * d.options.length)][0];
    else p[d.key] = fromSlider(d, d.log ? Math.random() * 1000
      : Math.round((d.min + Math.random() * (d.max - d.min)) / d.step) * d.step);
  }
  // Håll slumpen spelbar: hörbar nivå, inte för lång attack, inte för mycket effekter.
  Object.assign(p, {
    osc1Level: Math.max(p.osc1Level, 0.6),
    attack: Math.min(p.attack, 0.5),
    sustain: Math.max(p.sustain, 0.3),
    cutoff: Math.max(p.cutoff, 300),
    q: Math.min(p.q, 10),
    delayFeedback: Math.min(p.delayFeedback, 0.6),
    reverbMix: Math.min(p.reverbMix, 0.6),
    drive: Math.min(p.drive, 0.6),
    unison: Math.min(p.unison, 5),
    vol: 1,
  });
  synthLib = { name: '', edited: false };
  applySynth(p, CUSTOM);
  log('Slumpade ett nytt ljud');
}

// "Eget" i presetmenyn visar vilket biblioteksljud som är inladdat
function updateCustomLabel() {
  const opt = [...ui.preset.options].find((o) => o.value === CUSTOM);
  if (opt) {
    opt.textContent = !synthLib.name ? 'Eget (ändrat)'
      : `Eget: ${synthLib.name}${synthLib.edited ? ' (ändrat)' : ''}`;
  }
  const now = $('sound-now-name');
  if (now) {
    now.textContent = synthPreset !== CUSTOM ? synthPreset
      : synthLib.name ? `${synthLib.name}${synthLib.edited ? ' (ändrat)' : ''}` : 'Eget ljud';
  }
  const current = synthPreset === CUSTOM ? synthLib.name : '';
  document.querySelectorAll('.lib-preset').forEach((b) =>
    b.classList.toggle('on', b.dataset.name === current));
}

// ---------- Presetbibliotek (js/sound-library.js och js/fm-library.js) ----------
// Grupp (Alla eller en motor) -> kategori -> ljud, plus sökning på namn och kategori.
let libGroup = 'Alla';
let libCategory = 'Alla';
let libQuery = '';

function buildPresetLibrary() {
  $('lib-count').textContent = PRESET_LIBRARY.length;
  const groups = $('lib-groups');
  ['Alla', ...PRESET_GROUPS].forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lib-group';
    b.dataset.group = g;
    const n = g === 'Alla' ? PRESET_LIBRARY.length : PRESET_LIBRARY.filter((e) => e.group === g).length;
    b.innerHTML = `${g} <small>${n}</small>`;
    b.addEventListener('click', () => { libGroup = g; libCategory = 'Alla'; renderPresetLibrary(); });
    groups.append(b);
  });
  const cats = $('lib-cats');
  ['Alla', ...PRESET_CATEGORIES.map((c) => c.name)].forEach((cat) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lib-cat';
    b.dataset.cat = cat;
    b.dataset.group = PRESET_CATEGORIES.find((c) => c.name === cat)?.group || '';
    // Inom FM-gruppen behövs inte "FM-" framför varje kategori
    const label = b.dataset.group === 'FM' ? cat.replace(/^FM-/, '') : cat;
    b.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    b.addEventListener('click', () => { libCategory = cat; renderPresetLibrary(); });
    cats.append(b);
  });
  const list = $('lib-list');
  PRESET_LIBRARY.forEach((entry) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lib-preset';
    b.dataset.name = entry.name;
    b.dataset.cat = entry.cat;
    b.dataset.group = entry.group;
    b.innerHTML = `<span>${entry.name}</span><small>${entry.cat}</small>`;
    b.addEventListener('click', () => loadLibraryPreset(entry, true));
    list.append(b);
  });
  $('lib-search').addEventListener('input', (e) => { libQuery = e.target.value.trim().toLowerCase(); renderPresetLibrary(); });
  // Visa kategorin för ljudet som är inladdat, annars alla
  const cur = PRESET_LIBRARY.find((e) => e.name === synthLib.name);
  if (cur && synthPreset === CUSTOM) { libGroup = cur.group; libCategory = cur.cat; }
  renderPresetLibrary();
}

function renderPresetLibrary() {
  document.querySelectorAll('.lib-group').forEach((b) => b.classList.toggle('on', b.dataset.group === libGroup));
  // Kategorierna visas när man valt en grupp (alla 28 på en gång blir för många)
  $('lib-cats').hidden = libGroup === 'Alla';
  document.querySelectorAll('.lib-cat').forEach((b) => {
    b.hidden = b.dataset.group && b.dataset.group !== libGroup;
    b.classList.toggle('on', b.dataset.cat === libCategory);
  });
  let shown = 0;
  document.querySelectorAll('.lib-preset').forEach((b) => {
    // Sökning gäller alla ljud; annars grupp och kategori
    const hit = libQuery
      ? b.dataset.name.toLowerCase().includes(libQuery) || b.dataset.cat.toLowerCase().includes(libQuery)
      : (libGroup === 'Alla' || b.dataset.group === libGroup) && (libCategory === 'Alla' || b.dataset.cat === libCategory);
    b.hidden = !hit;
    if (hit) shown++;
  });
  $('lib-empty').hidden = shown > 0;
}

function loadLibraryPreset(entry, preview) {
  synthLib = { name: entry.name, edited: false };
  applySynth(entry.params, CUSTOM);
  log(`Eget: ${entry.name} (${entry.cat})`);
  // Provlyssna: en kort ton (C4) om ljudet är igång
  if (preview && audioCtx && ui.outAudio.checked) {
    const stop = engine.noteOn(60, 0.7);
    setTimeout(stop, 450);
  }
}

function setupSynthUi() {
  Object.keys(SYNTH_PRESETS).forEach((name) => ui.preset.append(new Option(name, name)));
  ui.preset.append(new Option('Eget (ändrat)', CUSTOM));
  buildSynthPanel();
  buildPresetLibrary();
  updateCustomLabel();
  ui.preset.value = synthPreset;
  syncSynthPanel();

  ui.preset.addEventListener('change', () => {
    if (ui.preset.value === CUSTOM) return;
    synthLib = { name: '', edited: false };
    applySynth(presetParams(ui.preset.value), ui.preset.value);
    log(`Preset: ${ui.preset.value}`);
  });

  // "Återställ" går tillbaka till senast valda preset (eller standard om ljudet är eget)
  let lastPreset = synthPreset === CUSTOM ? DEFAULT_PRESET : synthPreset;
  ui.preset.addEventListener('change', () => { if (ui.preset.value !== CUSTOM) lastPreset = ui.preset.value; });
  $('synth-reset').addEventListener('click', () => {
    // Laddat från biblioteket? Då går "Återställ" tillbaka till det biblioteksljudet.
    const lib = synthPreset === CUSTOM && PRESET_LIBRARY.find((e) => e.name === synthLib.name);
    if (lib) loadLibraryPreset(lib, false);
    else { synthLib = { name: '', edited: false }; applySynth(presetParams(lastPreset), lastPreset); }
  });
  $('synth-random').addEventListener('click', randomSynth);
}
