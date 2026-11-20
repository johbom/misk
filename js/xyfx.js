// XY-plattans effekter: en egen effektmotor av samma slag som rutornas (SynthEngine i js/synth.js:
// drive, chorus, delay med tempo-synk och reverb), men med egna inställningar för XY.
//
// Knappen Effekter i spelraden på XY öppnar reglagen (#xy-fx flyttas in i snabbrutan, js/quick.js);
// samma reglage står under Inställningar → Instrument → Effekter för XY.
// Reverben ligger kvar i #xy-reverb (som förr: guiden, presets och tidigare sparade inställningar använder
// den); övriga värden sparas som JSON i det dolda fältet #xy-fx-params (bara det som skiljer sig från
// förvalet). Motorn skapas i initAudio (engines.xy, js/audio.js) och XY:s buss spelar in i den (js/xy.js).

const XY_FX_DEFS = SYNTH_PARAMS.slice(SYNTH_PARAMS.findIndex((d) => d.group === 'Effekter'));
const XY_FX_DEFAULTS = { drive: 0, chorus: 0, delayMix: 0, delaySync: 'off', delayTime: 0.3, delayFeedback: 0.3, reverbSize: 2.8 };
const XY_REVERB_SCALE = 1 / 1.2; // (motorn förstärker reverben 1,2 gånger – så låter XY som förut)
const xyFxInputs = {}; // key -> { row, input, output, def }

// Sparade värden (utom reverben), rimliga och inom reglagens gränser
function xyFxStored() {
  let o = {};
  try { o = JSON.parse(ui.xyFxParams.value || '{}') || {}; } catch {}
  const res = {};
  for (const d of XY_FX_DEFS) {
    if (d.key === 'reverbMix' || !(d.key in o)) continue;
    if (d.options) { if (d.options.some(([v]) => v === o[d.key])) res[d.key] = o[d.key]; continue; }
    const v = Number(o[d.key]);
    if (Number.isFinite(v)) res[d.key] = Math.min(d.max, Math.max(d.min, v));
  }
  return res;
}

// Värdena som reglagen visar
const xyFxValues = () => ({ ...XY_FX_DEFAULTS, ...xyFxStored(), reverbMix: Number(ui.xyReverb.value) });
// Motorns parametrar
const xyFxParams = () => {
  const v = xyFxValues();
  return { ...SYNTH_DEFAULTS, ...v, reverbMix: v.reverbMix * XY_REVERB_SCALE };
};

function xyFxSet(key, value) {
  if (key === 'reverbMix') return; // (reverben har eget fält)
  const all = xyFxStored();
  if (value === XY_FX_DEFAULTS[key]) delete all[key]; else all[key] = value;
  ui.xyFxParams.value = Object.keys(all).length ? JSON.stringify(all) : '';
  saveSettings();
}

// Reglagen och motorn följer de sparade värdena (anropas efter ett laddat preset)
function xyFxSync() {
  const v = xyFxValues();
  for (const { input, output, def } of Object.values(xyFxInputs)) {
    input.value = def.options ? v[def.key] : toSlider(def, v[def.key]);
    if (!def.options) output.textContent = def.fmt(v[def.key]);
    if (input.segBox) syncSegment(input);
  }
  xyFxRefresh(v);
  engines.xy?.setParams(xyFxParams());
}

// Reglage som inte gör något just nu gråas ut (som bland rutornas effekter)
function xyFxRefresh(v = xyFxValues()) {
  for (const d of XY_FX_DEFS) {
    const row = d.key === 'reverbMix' ? null : xyFxInputs[d.key]?.row;
    row?.classList.toggle('off', !!SYNTH_DISABLED_WHEN[d.key]?.(v));
  }
}

function setupXyFx() {
  const box = $('xy-fx');
  const revRow = box.querySelector('[data-key="reverbMix"]');
  for (const d of XY_FX_DEFS) {
    if (d.key === 'reverbMix') { box.append(revRow); continue; } // (befintliga reglaget, på sin plats i ordningen)
    const row = document.createElement('label');
    row.className = 'knob';
    row.dataset.key = d.key;
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
    input.id = `xy-fx-${d.key}`;
    row.append(input);
    if (!d.options) row.append(output);
    box.append(row);
    xyFxInputs[d.key] = { row, input, output, def: d };
    input.addEventListener('input', () => {
      const v = d.options ? input.value : fromSlider(d, input.value);
      if (!d.options) output.textContent = d.fmt(v);
      engines.xy?.set(d.key, v);
      xyFxSet(d.key, v);
      xyFxRefresh();
    });
  }
  // Reverben: värdetexten sköts av js/access.js; här ljudet
  ui.xyReverb.addEventListener('input', () => {
    engines.xy?.set('reverbMix', Number(ui.xyReverb.value) * XY_REVERB_SCALE);
    xyFxRefresh();
  });
  $('xy-fx-toggle').addEventListener('click', () => toggleQuick('xyfx'));
  xyFxSync();
}
