// Ljudmotor för Hover Pads (Web Audio).
//
// Per ton (röst):  osc 1 (unison) + osc 2 (mix eller FM) + brus
//                  -> filter (med envelope + LFO) -> tremolo -> volymkurva (ADSR)
// Gemensamt:       drive -> chorus -> delay -> reverb -> volym -> kompressor -> högtalare

// ---------- Vågformer ----------
const WAVES = [
  ['sine', 'Sinus'],
  ['triangle', 'Triangel'],
  ['square', 'Fyrkant'],
  ['sawtooth', 'Sågtand'],
  ['pulse', 'Puls (25 %)'],
  ['warm', 'Varm'],
  ['organ', 'Orgel'],
  ['vox', 'Röst'],
];
const BUILTIN_WAVES = new Set(['sine', 'triangle', 'square', 'sawtooth']);

// Egna vågformer byggs av övertoner (Fourier-serier).
function harmonicsFor(wave, N = 64) {
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    switch (wave) {
      case 'pulse': // pulsvåg med 25 % pulsbredd
        real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
        break;
      case 'warm': // sågtand med mjukare diskant
        imag[n] = Math.pow(n, -1.7);
        break;
      case 'organ': // ungefär som dragstänger på en tonhjulsorgel
        imag[n] = { 1: 1, 2: 0.65, 3: 0.5, 4: 0.4, 6: 0.25, 8: 0.2, 10: 0.1, 12: 0.08 }[n] || 0;
        break;
      case 'vox': // två "formanter" ger en vokalliknande klang
        imag[n] = Math.exp(-((n - 3) ** 2) / 3) + 0.6 * Math.exp(-((n - 9) ** 2) / 6) + (n === 1 ? 0.5 : 0);
        break;
    }
  }
  return [real, imag];
}

// ---------- Reglage ----------
// fmt: hur värdet visas. log: logaritmiskt reglage (för frekvenser och tider).
const pct = (v) => `${Math.round(v * 100)} %`;
const sec = (v) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`);
const hz = (v) => (v < 1000 ? `${Math.round(v)} Hz` : `${(v / 1000).toFixed(1)} kHz`);
const signed = (unit) => (v) => `${v > 0 ? '+' : ''}${v} ${unit}`;

// Fysisk modellering: resonanskroppar med verkliga deltonsförhållanden (från mätningar/litteratur).
// ratios = deltonernas frekvens i förhållande till grundtonen, amps = styrka, damp = hur mycket
// fortare de högre deltonerna klingar av.
const PM_BODIES = {
  marimba: { name: 'Marimba', ratios: [1, 3.99, 10.65], amps: [1, 0.45, 0.2], damp: 0.9 },
  vibes: { name: 'Vibrafon', ratios: [1, 3.93, 9.24], amps: [1, 0.5, 0.25], damp: 0.6 },
  glass: { name: 'Glas', ratios: [1, 2.32, 4.25, 6.63, 9.38], amps: [1, 0.55, 0.35, 0.2, 0.12], damp: 0.4 },
  bell: { name: 'Klocka', ratios: [0.5, 1, 1.19, 1.5, 2, 2.66, 3.01], amps: [0.15, 1, 0.55, 0.35, 0.6, 0.25, 0.2], damp: 0.5 },
  drum: { name: 'Trumma', ratios: [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.16], amps: [1, 0.8, 0.6, 0.5, 0.4, 0.35, 0.3], damp: 0.8 },
  bar: { name: 'Metallstav', ratios: [1, 2.76, 5.4, 8.93], amps: [1, 0.4, 0.22, 0.1], damp: 0.7 },
};

// FM-motorn: fyra sinusoperatorer (som klassiska FM-syntar). Algoritmen bestämmer vilka som hörs
// (bärare) och vilka som i stället moduler­ar andra. mods[k] = operatorerna som modulerar operator k
// (index 0 = operator 1). Operator 4 kan dessutom återkoppla till sig själv.
const FM_ALGOS = {
  1: { name: '1 · 4→3→2→1', mods: [[1], [2], [3], []], car: [0] },
  2: { name: '2 · (3+4)→2→1', mods: [[1], [2, 3], [], []], car: [0] },
  3: { name: '3 · 3→2→1 och 4→1', mods: [[1, 3], [2], [], []], car: [0] },
  4: { name: '4 · 4→3→1 och 2→1', mods: [[1, 2], [], [3], []], car: [0] },
  5: { name: '5 · Två par: 2→1, 4→3', mods: [[1], [], [3], []], car: [0, 2] },
  6: { name: '6 · 4→1, 2 och 3', mods: [[3], [3], [3], []], car: [0, 1, 2] },
  7: { name: '7 · 4→3, 1 och 2 hörs', mods: [[], [], [3], []], car: [0, 1, 2] },
  8: { name: '8 · Alla fyra hörs (orgel)', mods: [[], [], [], []], car: [0, 1, 2, 3] },
};
const ratioFmt = (v) => `${Number(v.toFixed(2))}×`;
const FM_OP_PARAMS = [1, 2, 3, 4].flatMap((k) => [
  { group: `Operator ${k}`, op: k, key: `op${k}Ratio`, label: 'Förhållande', min: 0.5, max: 16, log: true, fmt: ratioFmt },
  { key: `op${k}Level`, label: 'Nivå', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: `op${k}Attack`, label: 'Attack', min: 0.001, max: 4, log: true, fmt: sec },
  { key: `op${k}Decay`, label: 'Decay', min: 0.01, max: 12, log: true, fmt: sec },
  { key: `op${k}Sustain`, label: 'Sustain', min: 0, max: 1, step: 0.01, fmt: pct },
]);

const SYNTH_PARAMS = [
  { group: 'Motor', key: 'model', label: 'Motor', options: [['osc', 'Oscillatorer'], ['string', 'Sträng'], ['modal', 'Resonans'], ['fm', 'FM']] },
  { key: 'pmExciter', label: 'Anslag', options: [['pluck', 'Knäppt'], ['hammer', 'Slagen'], ['bow', 'Stråke']] },
  { key: 'pmBody', label: 'Kropp', options: Object.entries(PM_BODIES).map(([k, b]) => [k, b.name]) },
  { key: 'pmDecay', label: 'Klingtid', min: 0.05, max: 12, log: true, fmt: sec },
  { key: 'pmBright', label: 'Ljushet', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'pmPos', label: 'Anslagspunkt', min: 0.02, max: 0.5, step: 0.01, fmt: (v) => (v < 0.1 ? 'Vid kanten' : v > 0.4 ? 'Mitten' : pct(v)) },

  { group: 'FM', key: 'fmAlgo', label: 'Algoritm', options: Object.entries(FM_ALGOS).map(([k, a]) => [k, a.name]) },
  { key: 'fmFb', label: 'Återkoppling', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'fmDetune', label: 'Svävning', min: 0, max: 30, step: 1, fmt: (v) => `${v} cent` },
  ...FM_OP_PARAMS,

  { group: 'Oscillator 1', key: 'osc1Wave', label: 'Vågform', options: WAVES },
  { key: 'osc1Level', label: 'Nivå', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'unison', label: 'Unison', min: 1, max: 7, step: 1, fmt: (v) => `${v} röster` },
  { key: 'spread', label: 'Detune', min: 0, max: 50, step: 1, fmt: (v) => `${v} cent` },

  { group: 'Oscillator 2', key: 'osc2Mode', label: 'Läge', options: [['mix', 'Mix'], ['fm', 'FM → osc 1']] },
  { key: 'osc2Wave', label: 'Vågform', options: WAVES },
  { key: 'osc2Level', label: 'Nivå', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'fmAmount', label: 'FM-djup', min: 0, max: 10, step: 0.1, fmt: (v) => v.toFixed(1) },
  { key: 'osc2Semi', label: 'Transp.', min: -24, max: 24, step: 1, fmt: signed('halvt.') },
  { key: 'osc2Fine', label: 'Fin', min: -50, max: 50, step: 1, fmt: signed('cent') },
  { key: 'noise', label: 'Brus', min: 0, max: 1, step: 0.01, fmt: pct },

  { group: 'Filter', key: 'filterType', label: 'Typ', options: [['lowpass', 'Lågpass'], ['highpass', 'Högpass'], ['bandpass', 'Bandpass']] },
  { key: 'cutoff', label: 'Cutoff', min: 40, max: 18000, log: true, fmt: hz },
  { key: 'q', label: 'Resonans', min: 0, max: 20, step: 0.1, fmt: (v) => v.toFixed(1) },
  { key: 'fEnv', label: 'Env-mängd', min: 0, max: 6, step: 0.1, fmt: (v) => `${v.toFixed(1)} okt` },
  { key: 'fAttack', label: 'Attack', min: 0.001, max: 4, log: true, fmt: sec },
  { key: 'fDecay', label: 'Decay', min: 0.01, max: 6, log: true, fmt: sec },
  { key: 'fSustain', label: 'Sustain', min: 0, max: 1, step: 0.01, fmt: pct },

  { group: 'Volymkurva', key: 'attack', label: 'Attack', min: 0.001, max: 4, log: true, fmt: sec },
  { key: 'decay', label: 'Decay', min: 0.01, max: 6, log: true, fmt: sec },
  { key: 'sustain', label: 'Sustain', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'release', label: 'Release', min: 0.01, max: 8, log: true, fmt: sec },

  { group: 'LFO', key: 'lfoTarget', label: 'Styr', options: [['off', 'Av'], ['pitch', 'Tonhöjd (vibrato)'], ['filter', 'Filter (wah)'], ['amp', 'Volym (tremolo)']] },
  { key: 'lfoRate', label: 'Hastighet', min: 0.05, max: 20, log: true, fmt: (v) => `${v.toFixed(2)} Hz` },
  { key: 'lfoDepth', label: 'Djup', min: 0, max: 1, step: 0.01, fmt: pct },

  { group: 'Effekter', key: 'drive', label: 'Drive', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'chorus', label: 'Chorus', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'delayMix', label: 'Delay', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'delayTime', label: 'Delaytid', min: 0.05, max: 1.5, log: true, fmt: sec },
  { key: 'delayFeedback', label: 'Återkoppling', min: 0, max: 0.9, step: 0.01, fmt: pct },
  { key: 'reverbMix', label: 'Reverb', min: 0, max: 1, step: 0.01, fmt: pct },
  { key: 'reverbSize', label: 'Rumsstorlek', min: 0.3, max: 10, log: true, fmt: sec },
];

// Reglage som inte gör något i vissa lägen gråas ut.
const notOsc = (p) => p.model && p.model !== 'osc';
const notPm = (p) => p.model !== 'string' && p.model !== 'modal';
const notFm = (p) => p.model !== 'fm';
// Reglage som hör till en annan motor döljs helt (en grupp utan synliga reglage döljs också)
const SYNTH_HIDDEN_WHEN = {
  pmExciter: (p) => p.model !== 'string',
  pmBody: (p) => p.model !== 'modal',
  pmDecay: notPm,
  pmBright: notPm,
  pmPos: notPm,
  ...Object.fromEntries(['osc1Wave', 'osc1Level', 'unison', 'spread', 'osc2Mode', 'osc2Wave', 'osc2Level',
    'fmAmount', 'osc2Semi', 'osc2Fine', 'noise'].map((k) => [k, notOsc])),
  ...Object.fromEntries(['fmAlgo', 'fmFb', 'fmDetune', ...FM_OP_PARAMS.map((d) => d.key)].map((k) => [k, notFm])),
};
const SYNTH_DISABLED_WHEN = {
  pmExciter: (p) => p.model !== 'string',
  pmBody: (p) => p.model !== 'modal',
  pmDecay: (p) => !notOsc(p),
  pmBright: (p) => !notOsc(p),
  pmPos: (p) => !notOsc(p),
  osc1Wave: notOsc,
  osc1Level: notOsc,
  unison: notOsc,
  spread: notOsc,
  osc2Mode: notOsc,
  osc2Wave: notOsc,
  osc2Semi: notOsc,
  osc2Fine: notOsc,
  noise: notOsc,
  osc2Level: (p) => notOsc(p) || p.osc2Mode === 'fm',
  fmAmount: (p) => notOsc(p) || p.osc2Mode !== 'fm',
  fAttack: (p) => p.fEnv === 0,
  fDecay: (p) => p.fEnv === 0,
  fSustain: (p) => p.fEnv === 0,
  lfoRate: (p) => p.lfoTarget === 'off',
  lfoDepth: (p) => p.lfoTarget === 'off',
  delayTime: (p) => p.delayMix === 0,
  delayFeedback: (p) => p.delayMix === 0,
  reverbSize: (p) => p.reverbMix === 0,
};

// ---------- Presets ----------
const SYNTH_DEFAULTS = {
  model: 'osc', pmExciter: 'pluck', pmBody: 'marimba', pmDecay: 3, pmBright: 0.6, pmPos: 0.2,
  osc1Wave: 'triangle', osc1Level: 1, unison: 1, spread: 0,
  osc2Mode: 'mix', osc2Wave: 'sine', osc2Level: 0, fmAmount: 0, osc2Semi: 0, osc2Fine: 0, noise: 0,
  // FM-motorn (ett enkelt elpiano som utgångsläge)
  fmAlgo: '5', fmFb: 0, fmDetune: 3,
  op1Ratio: 1, op1Level: 1, op1Attack: 0.002, op1Decay: 2.5, op1Sustain: 0.15,
  op2Ratio: 1, op2Level: 0.3, op2Attack: 0.002, op2Decay: 0.8, op2Sustain: 0.15,
  op3Ratio: 1, op3Level: 0.45, op3Attack: 0.002, op3Decay: 1.5, op3Sustain: 0.05,
  op4Ratio: 14, op4Level: 0.2, op4Attack: 0.002, op4Decay: 0.12, op4Sustain: 0,
  filterType: 'lowpass', cutoff: 18000, q: 0.7, fEnv: 0, fAttack: 0.01, fDecay: 0.3, fSustain: 1,
  attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.25,
  lfoTarget: 'off', lfoRate: 5, lfoDepth: 0,
  drive: 0, chorus: 0, delayMix: 0, delayTime: 0.3, delayFeedback: 0.3, reverbMix: 0.1, reverbSize: 2,
};

// Varje preset ändrar bara det som skiljer sig från SYNTH_DEFAULTS.
const SYNTH_PRESETS = {
  'Elpiano': {
    osc1Wave: 'sine', osc2Mode: 'fm', osc2Wave: 'sine', fmAmount: 1.6,
    attack: 0.003, decay: 1.4, sustain: 0.25, release: 0.6,
    lfoTarget: 'amp', lfoRate: 4, lfoDepth: 0.25,
    chorus: 0.35, reverbMix: 0.22, reverbSize: 1.8,
  },
  'Varm pad': {
    osc1Wave: 'sawtooth', unison: 5, spread: 14,
    osc2Wave: 'warm', osc2Level: 0.5, osc2Semi: -12,
    cutoff: 900, q: 1.5, fEnv: 1.5, fAttack: 0.6, fDecay: 1.5, fSustain: 0.4,
    attack: 0.35, decay: 1, sustain: 0.8, release: 1.6,
    lfoTarget: 'filter', lfoRate: 0.25, lfoDepth: 0.2,
    chorus: 0.6, reverbMix: 0.45, reverbSize: 4.5,
  },
  'Supersaw-lead': {
    osc1Wave: 'sawtooth', unison: 7, spread: 22,
    osc2Wave: 'sawtooth', osc2Level: 0.4, osc2Semi: 12,
    cutoff: 2500, q: 3, fEnv: 2, fAttack: 0.005, fDecay: 0.35, fSustain: 0.5,
    attack: 0.005, decay: 0.2, sustain: 0.85, release: 0.3,
    lfoTarget: 'pitch', lfoRate: 5.5, lfoDepth: 0.12,
    drive: 0.25, delayMix: 0.22, delayTime: 0.375, delayFeedback: 0.35, reverbMix: 0.2, reverbSize: 2.5,
  },
  'Pluck': {
    osc1Wave: 'sawtooth', osc2Wave: 'square', osc2Level: 0.35, osc2Semi: 12, osc2Fine: 6,
    cutoff: 350, q: 7, fEnv: 4.5, fAttack: 0.001, fDecay: 0.22, fSustain: 0,
    attack: 0.002, decay: 0.6, sustain: 0, release: 0.4,
    delayMix: 0.3, delayTime: 0.28, delayFeedback: 0.45, reverbMix: 0.25, reverbSize: 2.2,
  },
  'Bas': {
    osc1Wave: 'square', osc2Wave: 'sine', osc2Level: 0.9, osc2Semi: -12,
    cutoff: 500, q: 4, fEnv: 2.2, fAttack: 0.002, fDecay: 0.18, fSustain: 0.15,
    attack: 0.004, decay: 0.3, sustain: 0.8, release: 0.12,
    drive: 0.35, reverbMix: 0,
  },
  'Klocka': {
    // FM-djup 1,5: grundtonen hörs i anslaget (vid 2,4–2,5 försvinner den helt och örat hör en
    // ton en oktav under), deltonerna på 2,5× och 4,5× ger klockklangen.
    osc1Wave: 'sine', osc2Mode: 'fm', osc2Wave: 'sine', fmAmount: 1.5, osc2Semi: 22, osc2Fine: -31,
    attack: 0.001, decay: 2.5, sustain: 0, release: 2.5,
    delayMix: 0.18, delayTime: 0.5, delayFeedback: 0.3, reverbMix: 0.45, reverbSize: 5,
  },
  'Orgel': {
    osc1Wave: 'organ',
    attack: 0.008, decay: 0.1, sustain: 1, release: 0.12,
    lfoTarget: 'pitch', lfoRate: 6.2, lfoDepth: 0.07,
    drive: 0.15, chorus: 0.55, reverbMix: 0.3, reverbSize: 2.2,
  },
  'Rymd': {
    osc1Wave: 'vox', unison: 3, spread: 10, noise: 0.12,
    cutoff: 1400, q: 6,
    attack: 0.5, decay: 2, sustain: 0.8, release: 3,
    lfoTarget: 'filter', lfoRate: 0.12, lfoDepth: 0.55,
    delayMix: 0.35, delayTime: 0.6, delayFeedback: 0.6, reverbMix: 0.6, reverbSize: 8,
  },
  'Chip': {
    osc1Wave: 'pulse',
    attack: 0.001, decay: 0.12, sustain: 0.6, release: 0.06,
    lfoTarget: 'pitch', lfoRate: 7, lfoDepth: 0.1,
    delayMix: 0.2, delayTime: 0.16, delayFeedback: 0.3, reverbMix: 0.08, reverbSize: 1,
  },
  // Vanliga instrument (fysisk modell för de som slås eller knäpps, oscillatorer för resten)
  'Piano': {
    model: 'string', pmExciter: 'hammer', pmDecay: 4.5, pmBright: 0.6, pmPos: 0.12,
    release: 0.5, chorus: 0.1, reverbMix: 0.25, reverbSize: 2.5,
  },
  'Gitarr': {
    model: 'string', pmExciter: 'pluck', pmDecay: 3.5, pmBright: 0.55, pmPos: 0.18,
    release: 0.4, reverbMix: 0.2, reverbSize: 2,
  },
  'Elgitarr': {
    model: 'string', pmExciter: 'pluck', pmDecay: 6, pmBright: 0.75, pmPos: 0.1,
    cutoff: 4500, release: 0.3,
    drive: 0.6, chorus: 0.2, delayMix: 0.2, delayTime: 0.33, delayFeedback: 0.3, reverbMix: 0.2,
  },
  'Kontrabas': {
    model: 'string', pmExciter: 'pluck', pmDecay: 2, pmBright: 0.25, pmPos: 0.25,
    release: 0.25, reverbMix: 0.1,
  },
  'Stråkar': {
    osc1Wave: 'sawtooth', unison: 5, spread: 12,
    cutoff: 2600, q: 0.8, fEnv: 0.8, fAttack: 0.3, fDecay: 1, fSustain: 0.7,
    attack: 0.28, decay: 0.5, sustain: 0.9, release: 0.9,
    lfoTarget: 'pitch', lfoRate: 5.2, lfoDepth: 0.06,
    chorus: 0.4, reverbMix: 0.4, reverbSize: 3.5,
  },
  'Blås': {
    osc1Wave: 'sawtooth', unison: 2, spread: 6,
    cutoff: 650, q: 1.2, fEnv: 2.4, fAttack: 0.06, fDecay: 0.4, fSustain: 0.55,
    attack: 0.04, decay: 0.3, sustain: 0.85, release: 0.2,
    lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.04,
    drive: 0.15, reverbMix: 0.25, reverbSize: 2.2,
  },
  'Panflöjt': {
    osc1Wave: 'sine', osc2Wave: 'triangle', osc2Level: 0.2, osc2Semi: 12, noise: 0.08,
    cutoff: 3500, attack: 0.07, decay: 0.3, sustain: 0.85, release: 0.3,
    lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.05,
    reverbMix: 0.4, reverbSize: 3.5,
  },
  'Dragspel': {
    // Två lätt ostämda röster som svävar mot varandra (musette)
    osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc2Level: 0.8, osc2Fine: 12,
    cutoff: 2200, q: 1, attack: 0.05, decay: 0.2, sustain: 0.9, release: 0.12,
    lfoTarget: 'amp', lfoRate: 5.5, lfoDepth: 0.08,
    reverbMix: 0.2, reverbSize: 2,
  },
  'Kör': {
    osc1Wave: 'vox', unison: 4, spread: 10,
    cutoff: 3000, attack: 0.3, decay: 0.6, sustain: 0.85, release: 1,
    lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.04,
    chorus: 0.4, reverbMix: 0.5, reverbSize: 4,
  },
  'Sitar': {
    model: 'string', pmExciter: 'pluck', pmDecay: 4, pmBright: 0.95, pmPos: 0.05,
    release: 0.5, delayMix: 0.15, delayTime: 0.4, delayFeedback: 0.3, reverbMix: 0.3, reverbSize: 3,
  },
  'Enkel': {},
};
const DEFAULT_PRESET = 'Elpiano';
const presetParams = (name) => ({ ...SYNTH_DEFAULTS, ...SYNTH_PRESETS[name] });

// ---------- Motorn ----------
const NOTE_LOOKAHEAD = 0.015; // s, se noteOn
const FM_MOD_SCALE = 6; // en modulator på full nivå = moduleringsindex 6 (mycket ljust)
// Strängmodellen (AudioWorklet). Samma ?v= som den här filen, så att nya versioner hämtas.
const PM_WORKLET_URL = `js/pm-worklet.js${document.currentScript ? new URL(document.currentScript.src).search : ''}`;

class SynthEngine {
  constructor(ctx, params) {
    this.ctx = ctx;
    this.p = { ...params };
    this.waveCache = {};

    // Ingång för alla röster (och uppladdade ljudfiler)
    this.input = ctx.createGain();

    // Drive (mjuk distorsion)
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';
    this.driveOut = ctx.createGain();
    this.input.connect(this.shaper).connect(this.driveOut);

    // Bus = torr signal + chorus
    this.bus = ctx.createGain();
    this.driveOut.connect(this.bus);

    // Chorus: två korta, svajande delays panorerade vänster/höger
    this.chorusMix = ctx.createGain();
    this.chorusDepth = [];
    for (const [rate, pan] of [[0.31, -0.7], [0.43, 0.7]]) {
      const d = ctx.createDelay(0.1);
      d.delayTime.value = 0.015;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const depth = ctx.createGain();
      lfo.connect(depth).connect(d.delayTime);
      lfo.start();
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      this.driveOut.connect(d).connect(p).connect(this.chorusMix);
      this.chorusDepth.push(depth);
    }
    this.chorusMix.connect(this.bus);

    // Delay med mörkare repetitioner (lågpass i återkopplingen)
    this.delay = ctx.createDelay(2);
    this.delayFb = ctx.createGain();
    const fbTone = ctx.createBiquadFilter();
    fbTone.frequency.value = 3500;
    this.delayMix = ctx.createGain();
    this.bus.connect(this.delay);
    this.delay.connect(fbTone).connect(this.delayFb).connect(this.delay);
    this.delay.connect(this.delayMix);

    // Reverb (konvolution med en genererad rumsklang)
    this.convolver = ctx.createConvolver();
    this.reverbMix = ctx.createGain();
    this.bus.connect(this.convolver);
    this.delayMix.connect(this.convolver); // ekon får också rumsklang
    this.convolver.connect(this.reverbMix);

    // Ut: volym -> kompressor (håller nere toppar när många toner spelas)
    this.volume = ctx.createGain();
    this.bus.connect(this.volume);
    this.delayMix.connect(this.volume);
    this.reverbMix.connect(this.volume);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    // Toppbegränsare sist: när många toner klingar samtidigt (snabba ackordbyten, lång release)
    // får summan aldrig gå över 0 dB – annars klipper ljudkortet hårt och det "blippar".
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    // Kompressorn höjer automatiskt nivån (ca +1,7 dB vid de här värdena) – ta bort det igen
    const makeup = ctx.createGain();
    makeup.gain.value = 0.82;
    this.volume.connect(comp).connect(limiter).connect(makeup).connect(ctx.destination);
    Object.assign(this, { comp, limiter, makeup }); // (för mätning och felsökning)

    // Brus (en sekund som loopas)
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // Vibrato-LFO som alla röster delar. Varje röst har ett eget djup (0 = inget vibrato),
    // som styrs av hur man vickar pekaren över rutan (js/vibrato.js).
    this.vibLfo = ctx.createOscillator();
    this.vibLfo.frequency.value = 5.5;
    this.vibLfo.start();

    // Fysisk modell: strängen räknas i ljudtråden. Tills den laddats spelas en resonanskropp i stället.
    this.pmReady = false;
    this.ready = ctx.audioWorklet
      ? ctx.audioWorklet.addModule(PM_WORKLET_URL).then(() => { this.pmReady = true; }).catch(() => {})
      : Promise.resolve();

    this.reverbBuiltSize = null;
    this.updateEffects();
  }

  setVolume(v) {
    this.volume.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setParams(params) {
    this.p = { ...params };
    this.updateEffects();
  }

  set(key, value) {
    this.p[key] = value;
    this.updateEffects();
  }

  // Effekterna ändras direkt, även medan toner spelar.
  updateEffects() {
    const { ctx, p } = this;
    const t = ctx.currentTime;
    const smooth = (param, v) => param.setTargetAtTime(v, t, 0.03);

    // Drive: tanh-kurva. Kurvan förstärker svaga signaler ungefär k gånger,
    // så nivån sänks efteråt för att drive ska ge mer distorsion, inte bara mer volym.
    const k = 1 + p.drive * 30;
    if (p.drive > 0) {
      if (this.shaperDrive !== p.drive) {
        const curve = new Float32Array(1024);
        for (let i = 0; i < curve.length; i++) {
          const x = (i / (curve.length - 1)) * 2 - 1;
          curve[i] = Math.tanh(k * x) / Math.tanh(k);
        }
        this.shaper.curve = curve;
        this.shaperDrive = p.drive;
      }
      smooth(this.driveOut.gain, Math.pow(k, -0.85));
    } else {
      this.shaper.curve = null;
      this.shaperDrive = 0;
      smooth(this.driveOut.gain, 1);
    }

    smooth(this.chorusMix.gain, p.chorus * 0.8);
    this.chorusDepth.forEach((g) => smooth(g.gain, 0.001 + p.chorus * 0.004));

    smooth(this.delay.delayTime, p.delayTime);
    smooth(this.delayFb.gain, p.delayFeedback);
    smooth(this.delayMix.gain, p.delayMix * 0.7);

    smooth(this.reverbMix.gain, p.reverbMix * 1.2);
    if (this.reverbBuiltSize !== p.reverbSize) {
      // Att bygga om rumsklangen tar lite tid – vänta tills reglaget står still.
      clearTimeout(this.reverbTimer);
      const build = () => {
        this.convolver.buffer = this.makeImpulse(this.p.reverbSize);
        this.reverbBuiltSize = this.p.reverbSize;
      };
      if (this.reverbBuiltSize === null) build();
      else this.reverbTimer = setTimeout(build, 150);
    }
  }

  // Stereo-brus som klingar av = en enkel men fin rumsklang.
  makeImpulse(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const fadeIn = Math.min(1, i / (rate * 0.004));
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * fadeIn;
      }
    }
    return buf;
  }

  makeOsc(wave, freq) {
    const o = this.ctx.createOscillator();
    if (BUILTIN_WAVES.has(wave)) o.type = wave;
    else {
      if (!this.waveCache[wave]) {
        const [real, imag] = harmonicsFor(wave);
        this.waveCache[wave] = this.ctx.createPeriodicWave(real, imag);
      }
      o.setPeriodicWave(this.waveCache[wave]);
    }
    o.frequency.value = freq;
    return o;
  }

  // Fysisk modell: en sträng (AudioWorklet) eller en resonanskropp (bandpassfilter som ringer).
  addModelVoice(p, freq, t, out, detunes, onRelease, onEnd, level = 1) {
    const { ctx } = this;
    if (p.model === 'fm') { this.addFmVoice(p, freq, t, out, detunes, onRelease, onEnd, level); return; }
    if (p.model === 'string' && this.pmReady) {
      const node = new AudioWorkletNode(ctx, 'pm-string', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { start: t, decay: p.pmDecay, bright: p.pmBright, pos: p.pmPos, exciter: p.pmExciter },
      });
      node.parameters.get('frequency').value = freq;
      detunes.push(node.parameters.get('detune'));
      node.connect(out);
      onRelease.push((r, end) => node.port.postMessage({ release: r, end }));
      onEnd.push(() => node.disconnect());
      return;
    }
    // Resonanskropp (också reserv för strängen om ljudtråden inte hunnit laddas)
    const body = PM_BODIES[p.model === 'modal' ? p.pmBody : 'bar'] || PM_BODIES.marimba;
    const sr = ctx.sampleRate;
    // Anslaget: en kort puls – hårdare klubba (ljusare) = kortare puls = fler höga deltoner
    const len = Math.max(2, Math.round(sr * (0.0004 + 0.008 * (1 - p.pmBright) ** 2)));
    // Deltonens styrka: kroppens egen, anslagspunkten och hur hård klubban är
    const weight = (k) => body.amps[k] * (0.3 + 0.7 * Math.abs(Math.sin(Math.PI * (k + 1) * p.pmPos)))
      * (k === 0 ? 1 : 0.3 + 0.7 * p.pmBright);
    const t60 = (ratio) => Math.max(0.03, p.pmDecay * Math.pow(ratio, -body.damp));
    if (this.pmReady) {
      const node = new AudioWorkletNode(ctx, 'pm-modal', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: {
          start: t,
          ratios: body.ratios,
          // Normaliserat med summan, så att kroppar med många deltoner inte blir starkare
          amps: body.ratios.map((_, k) => (weight(k) / body.ratios.reduce((sum, __, j) => sum + weight(j), 0)) * 2.25),
          t60s: body.ratios.map(t60),
          pulseLen: len,
          noise: 0.25 * p.pmBright,
        },
      });
      node.parameters.get('frequency').value = freq;
      detunes.push(node.parameters.get('detune'));
      node.connect(out);
      onRelease.push((r, end) => node.port.postMessage({ end }));
      onEnd.push(() => node.disconnect());
      return;
    }
    // Reserv med inbyggda filter (bara de första ögonblicken innan ljudtråden laddats)
    const buf = ctx.createBuffer(1, len + 8, sr);
    const d = buf.getChannelData(0);
    let area = 0;
    for (let i = 0; i < len; i++) {
      d[i] = Math.sin((Math.PI * i) / len) ** 2 * (1 + 0.25 * p.pmBright * (Math.random() * 2 - 1));
      area += d[i];
    }
    const hit = ctx.createBufferSource();
    hit.buffer = buf;
    hit.start(t);
    body.ratios.forEach((ratio, k) => {
      const fk = freq * ratio;
      if (fk > sr * 0.45) return; // över halva samplingsfrekvensen går inte
      const bw = 6.91 / (Math.PI * t60(ratio)); // bandbredd (Hz) som ger klingtiden
      const bq = ctx.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.value = fk;
      bq.Q.value = fk / bw;
      const w = weight(k);
      const g = ctx.createGain();
      g.gain.value = (w / ((2 * Math.PI * bw / sr) * area)) * 0.5; // ringningens styrka = w
      hit.connect(bq).connect(g).connect(out);
      detunes.push(bq.detune);
    });
    onEnd.push(() => hit.disconnect());
  }

  // FM-motorn: fyra operatorer i ljudtråden (pm-worklet.js, 'fm4'). Moduleringsdjupet minskar en
  // aning uppåt i registret (som på riktiga FM-syntar) så att höga toner inte blir vassa, och ökar
  // med anslagets styrka.
  addFmVoice(p, freq, t, out, detunes, onRelease, onEnd, level) {
    const { ctx } = this;
    const algo = FM_ALGOS[p.fmAlgo] || FM_ALGOS[1];
    const ops = [1, 2, 3, 4].map((k) => ({
      ratio: p[`op${k}Ratio`], level: p[`op${k}Level`], attack: p[`op${k}Attack`],
      decay: p[`op${k}Decay`], sustain: p[`op${k}Sustain`],
    }));
    if (!this.pmReady) {
      // Reserv de första ögonblicken innan ljudtråden laddats: operator 1 med sin närmaste modulator
      const car = this.makeOsc('sine', freq * ops[0].ratio);
      const m = algo.mods[0][0];
      if (m !== undefined) {
        const mod = this.makeOsc('sine', freq * ops[m].ratio);
        const g = ctx.createGain();
        g.gain.value = ops[m].level * FM_MOD_SCALE * freq * ops[m].ratio * 0.6;
        mod.connect(g).connect(car.frequency);
        mod.start(t);
        onRelease.push((r, end) => mod.stop(end));
      }
      const g = ctx.createGain();
      g.gain.value = 0.7;
      car.connect(g).connect(out);
      car.start(t);
      detunes.push(car.detune);
      onRelease.push((r, end) => car.stop(end));
      return;
    }
    const keyScale = Math.min(1.25, Math.max(0.35, Math.sqrt(330 / freq)));
    const node = new AudioWorkletNode(ctx, 'fm4', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        start: t, ops, mods: algo.mods, car: algo.car, fb: p.fmFb, detune: p.fmDetune,
        index: FM_MOD_SCALE * keyScale * (0.7 + 0.3 * Math.min(1, level)),
      },
    });
    node.parameters.get('frequency').value = freq;
    detunes.push(node.parameters.get('detune'));
    node.connect(out);
    onRelease.push((r, end) => node.port.postMessage({ end }));
    onEnd.push(() => node.disconnect());
  }

  // Startar en ton. Returnerar en funktion som släpper den.
  // when (valfritt): ljudklockans tid då tonen ska börja (arpeggiatorn planerar i förväg).
  noteOn(note, level = 1, when = 0) {
    const { ctx } = this;
    const p = { ...this.p }; // tonen behåller sina inställningar även om reglagen ändras
    // Tonen planeras en aning framåt. ctx.currentTime kan ligga efter ljudtråden (särskilt Safari
    // på iPhone/iPad); hamnar starten i det förflutna kan webbläsaren hoppa över de korta förloppen
    // i början (FM-djup, filterkurva) och tonen låter "tom".
    const t = Math.max(ctx.currentTime + NOTE_LOOKAHEAD, when);
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    const sources = [];
    const mixer = ctx.createGain();
    const carriers = [];
    const pitched = []; // alla oscillatorer som ska få vibrato
    const detunes = []; // tonhöjd (cent) för fysiska modeller – för LFO och vibrato
    const onRelease = []; // (r) => … när tonen släpps
    const onEnd = []; // städning när rösten tystnat

    // Håller reda på när rösten är slut (även när den inte har några oscillatorer)
    const life = ctx.createConstantSource();
    life.offset.value = 0;
    life.connect(mixer);
    sources.push(life);

    if (p.model === 'string' || p.model === 'modal' || p.model === 'fm') {
      this.addModelVoice(p, freq, t, mixer, detunes, onRelease, onEnd, level);
    } else {
    // Oscillator 1, med unison (flera lätt ostämda kopior spridda i stereo)
    const osc1Gain = ctx.createGain();
    osc1Gain.gain.value = p.osc1Level / Math.sqrt(p.unison);
    for (let i = 0; i < p.unison; i++) {
      const o = this.makeOsc(p.osc1Wave, freq);
      if (p.unison > 1) {
        const pos = (i / (p.unison - 1)) * 2 - 1; // -1 .. 1
        o.detune.value = pos * p.spread;
        const pan = ctx.createStereoPanner();
        pan.pan.value = pos * 0.6;
        o.connect(pan).connect(osc1Gain);
      } else {
        o.connect(osc1Gain);
      }
      carriers.push(o);
      sources.push(o);
    }
    osc1Gain.connect(mixer);

    // Oscillator 2: blandas in, eller frekvensmodulerar osc 1 (FM)
    const freq2 = freq * Math.pow(2, (p.osc2Semi + p.osc2Fine / 100) / 12);
    if (p.osc2Mode === 'fm' && p.fmAmount > 0) {
      const mod = this.makeOsc(p.osc2Wave, freq2);
      pitched.push(mod);
      const fm = ctx.createGain();
      const full = p.fmAmount * freq2;
      // FM-djupet klingar av med volymkurvan -> ljust anslag, mjukare ton (piano, klocka)
      fm.gain.value = full; // startvärde direkt, även om förloppet nedan skulle hoppas över
      fm.gain.setValueAtTime(full, t);
      fm.gain.setTargetAtTime(full * Math.max(p.sustain, 0.2), t + p.attack, p.decay / 3);
      mod.connect(fm);
      carriers.forEach((c) => fm.connect(c.frequency));
      sources.push(mod);
    } else if (p.osc2Mode === 'mix' && p.osc2Level > 0) {
      const o2 = this.makeOsc(p.osc2Wave, freq2);
      pitched.push(o2);
      const g = ctx.createGain();
      g.gain.value = p.osc2Level;
      o2.connect(g).connect(mixer);
      sources.push(o2);
    }

    // Brus
    if (p.noise > 0) {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      n.loop = true;
      const g = ctx.createGain();
      g.gain.value = p.noise * 0.6;
      n.connect(g).connect(mixer);
      sources.push(n);
    }
    } // slut på oscillatorerna

    // Filter med egen envelope (styr filtrets "detune" i cent ovanför cutoff)
    const filter = ctx.createBiquadFilter();
    filter.type = p.filterType;
    filter.frequency.value = p.cutoff;
    filter.Q.value = p.q;
    if (p.fEnv > 0) {
      const top = p.fEnv * 1200;
      filter.detune.value = top; // startvärde: öppet filter (oscillatorerna startar först vid t)
      filter.detune.setValueAtTime(0, t);
      filter.detune.linearRampToValueAtTime(top, t + p.fAttack);
      filter.detune.setTargetAtTime(top * p.fSustain, t + p.fAttack, p.fDecay / 3);
    }

    // Tremolo-steg (används bara när LFO styr volymen)
    const trem = ctx.createGain();

    // Volymkurva (ADSR). Minst 3 ms attack, annars knäpper det i anslaget.
    const amp = ctx.createGain();
    const peak = 0.32 * level;
    const attack = Math.max(0.003, p.attack);
    const decayTau = p.decay / 3;
    amp.gain.value = 0;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + attack);
    amp.gain.setTargetAtTime(peak * p.sustain, t + attack, decayTau);
    // Kurvans värde vid tiden r. Webbläsare utan cancelAndHoldAtTime (Safari, Firefox) kan inte
    // "hålla" volymen mitt i en ramp, och att fråga efter gain.value kan ge fel värde = hårt klick.
    const envAt = (r) => {
      const dt = r - t;
      if (dt <= 0) return 0;
      if (dt < attack) return (peak * dt) / attack;
      const s = peak * p.sustain;
      return s + (peak - s) * Math.exp(-(dt - attack) / decayTau);
    };

    mixer.connect(filter).connect(trem).connect(amp).connect(this.input);

    // LFO
    if (p.lfoTarget !== 'off' && p.lfoDepth > 0) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = p.lfoRate;
      const depth = ctx.createGain();
      lfo.connect(depth);
      if (p.lfoTarget === 'pitch') {
        depth.gain.value = p.lfoDepth * 100; // upp till en halvton
        carriers.forEach((c) => depth.connect(c.detune));
        detunes.forEach((d) => depth.connect(d));
      } else if (p.lfoTarget === 'filter') {
        depth.gain.value = p.lfoDepth * 3600; // upp till tre oktaver
        depth.connect(filter.detune);
      } else {
        trem.gain.value = 1 - p.lfoDepth / 2;
        depth.gain.value = p.lfoDepth / 2;
        depth.connect(trem.gain);
      }
      sources.push(lfo);
    }

    // Vibrato: delad LFO -> rösten egen djupkontroll (cent) -> tonhöjden
    const vib = ctx.createGain();
    vib.gain.value = 0;
    this.vibLfo.connect(vib);
    [...carriers, ...pitched].forEach((o) => vib.connect(o.detune));
    detunes.forEach((d) => vib.connect(d));

    sources.forEach((s) => s.start(t));

    // at (valfritt): ljudklockans tid då tonen ska släppas
    const stop = (at = 0) => {
      // Släpp mjukt från exakt där kurvan är just nu (även mitt i anslaget)
      // Släppet planeras lika långt framåt som starten: tonen låter exakt så länge den hölls,
      // och inget av förloppen hamnar i det förflutna
      const r = Math.max(ctx.currentTime + NOTE_LOOKAHEAD, at, t + 0.003);
      if (amp.gain.cancelAndHoldAtTime) amp.gain.cancelAndHoldAtTime(r); // Chrome: exakt
      else {
        amp.gain.cancelScheduledValues(r);
        // Mitt i anslaget: lägg tillbaka samma ramp fram till nu (att bara sätta ett värde
        // ger ett hack på en sampling). Annars: fortsätt från kurvans värde.
        if (r - t < attack) amp.gain.linearRampToValueAtTime(envAt(r), r);
        else amp.gain.setValueAtTime(envAt(r), r);
      }
      amp.gain.setTargetAtTime(0, r, Math.max(0.005, p.release / 4));
      const end = r + Math.max(0.005, p.release / 4) * 9 + 0.05; // nästan helt tyst innan stopp
      sources.forEach((s) => s.stop(end));
      onRelease.forEach((f) => f(r, end));
      sources[0].onended = () => {
        amp.disconnect();
        onEnd.forEach((f) => f());
        try { this.vibLfo.disconnect(vib); } catch {}
      };
    };
    // Djup i cent (mjukt in/ut) och takt i Hz
    stop.vibrato = (cents, rate) => {
      const now = ctx.currentTime;
      vib.gain.setTargetAtTime(cents, now, cents > 0 ? 0.12 : 0.25);
      if (rate) this.vibLfo.frequency.setTargetAtTime(rate, now, 0.25);
    };
    return stop;
  }
}
