// Presetbibliotek: 500 färdiga ljud, 100 per ljudmotor (10 kategorier med 10 ljud var).
// Här finns oscillatormotorns 100; de andra motorernas ljud ligger i egna filer (se nedan).
// Väljer man ett av dem laddas inställningarna in i "Eget", så kan man fortsätta skruva därifrån.
// Varje kategori har en bas; varje ljud ändrar bara det som skiljer sig (ovanpå SYNTH_DEFAULTS).

const PRESET_CATEGORIES = [
  {
    name: 'Klaviatur',
    base: { attack: 0.003, decay: 1.4, sustain: 0.2, release: 0.5, reverbMix: 0.2, reverbSize: 1.8 },
    presets: {
      'Mjukt elpiano': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 0.9, lfoTarget: 'amp', lfoRate: 3.5, lfoDepth: 0.2, chorus: 0.3 },
      'Tine-piano': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 2.2, decay: 1.8, chorus: 0.2 },
      'Wurly': { osc1Wave: 'triangle', osc2Mode: 'fm', fmAmount: 1.4, drive: 0.3, lfoTarget: 'amp', lfoRate: 5, lfoDepth: 0.3 },
      'Clavinet': { osc1Wave: 'pulse', cutoff: 1200, q: 4, fEnv: 2.5, fDecay: 0.15, fSustain: 0.2, decay: 0.5, sustain: 0.1, release: 0.1, drive: 0.2, reverbMix: 0.1 },
      'Leksakspiano': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 3, osc2Semi: 12, decay: 0.7, sustain: 0, reverbMix: 0.25 },
      'Cembalo': { osc1Wave: 'sawtooth', osc2Wave: 'square', osc2Level: 0.3, osc2Semi: 12, cutoff: 3000, q: 1, fEnv: 1.5, fDecay: 0.3, fSustain: 0.2, decay: 1, sustain: 0, release: 0.3 },
      'Syntpiano': { osc1Wave: 'triangle', osc2Level: 0.5, osc2Semi: 12, cutoff: 2500, fEnv: 2, fDecay: 0.6, fSustain: 0.2, decay: 2.2, sustain: 0.05, release: 0.6, reverbMix: 0.25 },
      'Distade keys': { osc1Wave: 'sawtooth', cutoff: 1800, drive: 0.55, decay: 1, sustain: 0.3 },
      'Lo-fi keys': { osc1Wave: 'warm', cutoff: 1100, noise: 0.05, lfoTarget: 'pitch', lfoRate: 0.8, lfoDepth: 0.15, chorus: 0.4, reverbMix: 0.3 },
      'Glaspiano': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 1.2, osc2Semi: 12, chorus: 0.5, delayMix: 0.2, delayTime: 0.375, delayFeedback: 0.3, reverbMix: 0.35 },
    },
  },
  {
    name: 'Pad',
    base: { attack: 0.6, decay: 1.5, sustain: 0.85, release: 2, chorus: 0.5, reverbMix: 0.45, reverbSize: 4.5 },
    presets: {
      'Mjuk matta': { osc1Wave: 'warm', unison: 3, spread: 8, cutoff: 1500 },
      'Analog stråkmatta': { osc1Wave: 'sawtooth', unison: 5, spread: 15, cutoff: 1800, q: 1, lfoTarget: 'filter', lfoRate: 0.2, lfoDepth: 0.2 },
      'Körmatta': { osc1Wave: 'vox', unison: 3, spread: 9, cutoff: 2500, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.05 },
      'Glasmatta': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 1.5, osc2Semi: 12, attack: 1, delayMix: 0.25, delayTime: 0.5, delayFeedback: 0.5, reverbMix: 0.55, reverbSize: 6 },
      'Mörk drone': { osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc2Level: 0.6, osc2Semi: -12, cutoff: 400, q: 3, lfoTarget: 'filter', lfoRate: 0.08, lfoDepth: 0.5, attack: 1.5, release: 4, reverbMix: 0.5, reverbSize: 7 },
      'Svepande matta': { osc1Wave: 'sawtooth', unison: 4, spread: 18, cutoff: 600, q: 5, fEnv: 3, fAttack: 2.5, fDecay: 3, fSustain: 0.3 },
      'Varm mässingsmatta': { osc1Wave: 'sawtooth', unison: 3, spread: 10, cutoff: 1100, fEnv: 1.5, fAttack: 0.3, fDecay: 1, fSustain: 0.5, attack: 0.25 },
      'Shimmer': { osc1Wave: 'triangle', unison: 5, spread: 20, osc2Level: 0.4, osc2Semi: 19, filterType: 'highpass', cutoff: 300, delayMix: 0.35, delayTime: 0.45, delayFeedback: 0.55, reverbMix: 0.6, reverbSize: 8 },
      'Tremolomatta': { osc1Wave: 'warm', unison: 3, spread: 6, lfoTarget: 'amp', lfoRate: 6, lfoDepth: 0.45 },
      'Orgelmatta': { osc1Wave: 'organ', unison: 3, spread: 6, attack: 0.4, chorus: 0.7 },
    },
  },
  {
    name: 'Lead',
    base: { attack: 0.005, decay: 0.3, sustain: 0.8, release: 0.25, delayMix: 0.2, delayTime: 0.375, delayFeedback: 0.3, reverbMix: 0.2 },
    presets: {
      'Klassisk saw-lead': { osc1Wave: 'sawtooth', cutoff: 3000, q: 2, fEnv: 1.5, fDecay: 0.3, fSustain: 0.5, lfoTarget: 'pitch', lfoRate: 5.5, lfoDepth: 0.1 },
      'Fyrkantslead': { osc1Wave: 'square', cutoff: 2200, q: 3, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.1 },
      'Sinusflöjt': { osc1Wave: 'sine', noise: 0.06, attack: 0.06, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.12, reverbMix: 0.3 },
      'Kvintlead': { osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc2Level: 0.6, osc2Semi: 7, cutoff: 3500, q: 4, drive: 0.3 },
      'Distad lead': { osc1Wave: 'sawtooth', unison: 3, spread: 12, cutoff: 2600, drive: 0.7 },
      'Mjuk lead': { osc1Wave: 'triangle', osc2Level: 0.3, osc2Semi: 12, chorus: 0.3 },
      'FM-lead': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 3.5, lfoTarget: 'pitch', lfoRate: 6, lfoDepth: 0.1 },
      'Vissling': { osc1Wave: 'sine', noise: 0.04, attack: 0.05, lfoTarget: 'pitch', lfoRate: 6, lfoDepth: 0.2, reverbMix: 0.35 },
      'Acid-lead': { osc1Wave: 'sawtooth', cutoff: 500, q: 14, fEnv: 4, fDecay: 0.25, fSustain: 0.1, sustain: 0.5, drive: 0.4 },
      'Trance-supersaw': { osc1Wave: 'sawtooth', unison: 7, spread: 30, osc2Wave: 'sawtooth', osc2Level: 0.4, osc2Semi: 12, cutoff: 5000, delayMix: 0.3, delayFeedback: 0.45, reverbMix: 0.35, reverbSize: 3.5 },
    },
  },
  {
    name: 'Bas',
    base: { attack: 0.003, decay: 0.3, sustain: 0.8, release: 0.12, reverbMix: 0 },
    presets: {
      'Sub-bas': { osc1Wave: 'sine', osc2Level: 0.5, osc2Semi: -12, cutoff: 400 },
      'Analog bas': { osc1Wave: 'sawtooth', osc2Wave: 'square', osc2Level: 0.6, osc2Semi: -12, cutoff: 400, q: 5, fEnv: 2.5, fDecay: 0.2, fSustain: 0.2, drive: 0.3 },
      'Acid-bas': { osc1Wave: 'sawtooth', cutoff: 300, q: 15, fEnv: 4.5, fDecay: 0.2, fSustain: 0.05, sustain: 0.6, drive: 0.45 },
      'Fingerbas': { osc1Wave: 'triangle', osc2Level: 0.4, osc2Semi: 12, cutoff: 900, fEnv: 1.5, fDecay: 0.15, fSustain: 0.3, decay: 0.8, sustain: 0.3, release: 0.15 },
      'Wobble-bas': { osc1Wave: 'sawtooth', unison: 3, spread: 10, cutoff: 500, q: 6, lfoTarget: 'filter', lfoRate: 3, lfoDepth: 0.7, drive: 0.4 },
      'Reese-bas': { osc1Wave: 'sawtooth', unison: 4, spread: 25, cutoff: 700, q: 2, drive: 0.3, chorus: 0.2 },
      'FM-bas': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 4, decay: 0.35, sustain: 0.4 },
      'Knäppbas': { osc1Wave: 'square', cutoff: 300, q: 6, fEnv: 3.5, fDecay: 0.12, fSustain: 0, decay: 0.4, sustain: 0, release: 0.1 },
      'Distbas': { osc1Wave: 'square', osc2Wave: 'sawtooth', osc2Level: 0.5, osc2Semi: -12, cutoff: 1500, drive: 0.8 },
      'Bomb-bas': { osc1Wave: 'sine', osc2Level: 0.3, osc2Semi: -12, decay: 1.5, sustain: 0, release: 0.5, drive: 0.25 },
    },
  },
  {
    name: 'Pluck',
    base: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.4, delayMix: 0.25, delayTime: 0.3, delayFeedback: 0.4, reverbMix: 0.25 },
    presets: {
      'Klassisk pluck': { osc1Wave: 'sawtooth', cutoff: 400, q: 6, fEnv: 4, fDecay: 0.2, fSustain: 0 },
      'Kalimba': { osc1Wave: 'sine', osc2Level: 0.3, osc2Semi: 24, decay: 0.9, delayMix: 0.15, reverbMix: 0.3 },
      'Harpa': { osc1Wave: 'triangle', osc2Level: 0.4, osc2Semi: 12, cutoff: 2500, fEnv: 1.5, fDecay: 0.4, fSustain: 0, decay: 1.5, release: 1, delayMix: 0.1, reverbMix: 0.4, reverbSize: 3.5 },
      'Gitarrknäpp': { osc1Wave: 'sawtooth', osc2Wave: 'pulse', osc2Level: 0.3, osc2Fine: 8, cutoff: 1500, q: 2, fEnv: 2, fDecay: 0.3, fSustain: 0, decay: 1, release: 0.5 },
      'Koto': { osc1Wave: 'pulse', cutoff: 2000, q: 3, fEnv: 2, fDecay: 0.2, fSustain: 0, decay: 0.8, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.05 },
      'Pizzicato': { osc1Wave: 'sawtooth', unison: 3, spread: 8, cutoff: 2000, fEnv: 1.5, fDecay: 0.15, fSustain: 0, decay: 0.45, sustain: 0.05, release: 0.25, delayMix: 0, reverbMix: 0.4 },
      'Droppe': { osc1Wave: 'triangle', osc2Mode: 'fm', fmAmount: 2, osc2Semi: 7, decay: 0.4, sustain: 0.05, delayMix: 0.4, delayTime: 0.25, delayFeedback: 0.5 },
      'Syntarpeggio': { osc1Wave: 'square', cutoff: 800, q: 8, fEnv: 3, fDecay: 0.15, fSustain: 0, decay: 0.3, delayMix: 0.35, delayTime: 0.1875, delayFeedback: 0.55 },
      'Banjo': { osc1Wave: 'pulse', osc2Wave: 'sawtooth', osc2Level: 0.4, osc2Semi: 12, cutoff: 3000, fEnv: 1, fDecay: 0.1, fSustain: 0, decay: 0.4, release: 0.2, delayMix: 0.1 },
      'Glasknäpp': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 3, osc2Semi: 19, decay: 0.6, reverbMix: 0.45, reverbSize: 5 },
    },
  },
  {
    name: 'Klockor',
    base: { attack: 0.001, decay: 2, sustain: 0, release: 2, reverbMix: 0.4, reverbSize: 4 },
    presets: {
      'Kyrkklocka': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 3, osc2Semi: 19, osc2Fine: 14, decay: 4, release: 4, reverbMix: 0.55, reverbSize: 7 },
      'Klockspel': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 1.8, osc2Semi: 24, decay: 1.2 },
      'Vibrafon': { osc1Wave: 'sine', osc2Level: 0.3, osc2Semi: 24, decay: 2.5, lfoTarget: 'amp', lfoRate: 5, lfoDepth: 0.4 },
      'Marimba': { osc1Wave: 'sine', osc2Level: 0.4, osc2Semi: 24, decay: 0.6, release: 0.5, reverbMix: 0.25 },
      'Xylofon': { osc1Wave: 'triangle', osc2Level: 0.3, osc2Semi: 31, decay: 0.35, release: 0.3, reverbMix: 0.3 },
      'Speldosa': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 2, osc2Semi: 12, decay: 1.5, delayMix: 0.15, delayTime: 0.3 },
      'Rörklocka': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 4, osc2Semi: 7, decay: 4, release: 3 },
      'Steelpan': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 1.5, osc2Semi: 12, osc2Fine: 10, cutoff: 5000, attack: 0.003, decay: 1, sustain: 0.1 },
      'Kristall': { osc1Wave: 'triangle', osc2Mode: 'fm', fmAmount: 2.5, osc2Semi: 31, filterType: 'highpass', cutoff: 400, delayMix: 0.3, delayTime: 0.5, delayFeedback: 0.5, reverbMix: 0.6, reverbSize: 8 },
      'Celesta': { osc1Wave: 'sine', osc2Wave: 'triangle', osc2Level: 0.3, osc2Semi: 12, decay: 1, release: 1.2 },
    },
  },
  {
    name: 'Orgel',
    base: { osc1Wave: 'organ', attack: 0.008, decay: 0.1, sustain: 1, release: 0.12, chorus: 0.5, reverbMix: 0.3, reverbSize: 2.2 },
    presets: {
      'Jazzorgel': { lfoTarget: 'pitch', lfoRate: 6.5, lfoDepth: 0.08, drive: 0.15 },
      'Rockorgel': { drive: 0.55, chorus: 0.7, lfoTarget: 'pitch', lfoRate: 6.8, lfoDepth: 0.1 },
      'Kyrkorgel': { osc2Wave: 'organ', osc2Level: 0.5, osc2Semi: -12, attack: 0.05, release: 0.6, chorus: 0.2, reverbMix: 0.6, reverbSize: 7 },
      'Gospelorgel': { osc2Level: 0.4, osc2Semi: 12, lfoTarget: 'amp', lfoRate: 6, lfoDepth: 0.25, drive: 0.25 },
      'Flöjtstämma': { osc1Wave: 'sine', osc2Level: 0.3, osc2Semi: 12, noise: 0.03, attack: 0.04, release: 0.3, reverbMix: 0.5, reverbSize: 5 },
      'Kombo-orgel': { osc1Wave: 'square', osc2Wave: 'pulse', osc2Level: 0.4, osc2Semi: 12, cutoff: 3000, lfoTarget: 'pitch', lfoRate: 7, lfoDepth: 0.12, chorus: 0.2 },
      'Kammarorgel': { osc1Wave: 'triangle', osc2Wave: 'triangle', osc2Level: 0.5, osc2Semi: 12, reverbMix: 0.4 },
      'Harmonium': { osc1Wave: 'sawtooth', cutoff: 1600, q: 1, attack: 0.06, release: 0.25, lfoTarget: 'amp', lfoRate: 4, lfoDepth: 0.1 },
      'Mörk orgel': { cutoff: 900, q: 1 },
      'Ångorgel': { osc1Wave: 'sine', noise: 0.08, attack: 0.03, lfoTarget: 'pitch', lfoRate: 6, lfoDepth: 0.15 },
    },
  },
  {
    name: 'Stråk & blås',
    base: { attack: 0.1, decay: 0.5, sustain: 0.85, release: 0.5, reverbMix: 0.35, reverbSize: 3 },
    presets: {
      'Stråkensemble': { osc1Wave: 'sawtooth', unison: 5, spread: 14, cutoff: 2400, attack: 0.3, release: 0.9, chorus: 0.4 },
      'Solofiol': { osc1Wave: 'sawtooth', cutoff: 3000, q: 2, attack: 0.12, lfoTarget: 'pitch', lfoRate: 5.5, lfoDepth: 0.12 },
      'Cello': { osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc2Level: 0.4, osc2Semi: -12, cutoff: 1400, attack: 0.15, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.1 },
      'Mässing': { osc1Wave: 'sawtooth', unison: 3, spread: 8, cutoff: 900, q: 1.5, fEnv: 2, fAttack: 0.05, fDecay: 0.3, fSustain: 0.5, attack: 0.04 },
      'Trumpet': { osc1Wave: 'sawtooth', cutoff: 1200, q: 2, fEnv: 2.5, fAttack: 0.03, fDecay: 0.2, fSustain: 0.6, attack: 0.03, lfoTarget: 'pitch', lfoRate: 5.5, lfoDepth: 0.07 },
      'Flöjt': { osc1Wave: 'sine', noise: 0.1, cutoff: 4000, attack: 0.08, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.1 },
      'Klarinett': { osc1Wave: 'square', cutoff: 1800, q: 1, attack: 0.05, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.05 },
      'Oboe': { osc1Wave: 'pulse', cutoff: 2200, q: 3, attack: 0.05 },
      'Saxofon': { osc1Wave: 'sawtooth', osc2Wave: 'square', osc2Level: 0.3, cutoff: 1600, q: 3, fEnv: 1.5, fAttack: 0.05, fDecay: 0.3, fSustain: 0.6, attack: 0.04, drive: 0.3, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.08 },
      'Kör aah': { osc1Wave: 'vox', unison: 3, spread: 6, attack: 0.3, release: 1, chorus: 0.5, reverbMix: 0.5 },
    },
  },
  {
    name: 'Atmosfär',
    base: { attack: 0.8, decay: 2, sustain: 0.8, release: 3, delayMix: 0.35, delayTime: 0.6, delayFeedback: 0.55, reverbMix: 0.6, reverbSize: 8 },
    presets: {
      'Rymdvind': { osc1Wave: 'vox', noise: 0.3, filterType: 'bandpass', cutoff: 1200, q: 1.5, lfoTarget: 'filter', lfoRate: 0.1, lfoDepth: 0.6 },
      'Djuphav': { osc1Wave: 'sine', osc2Level: 0.5, osc2Semi: -12, cutoff: 500, lfoTarget: 'amp', lfoRate: 0.2, lfoDepth: 0.4 },
      'Norrsken': { osc1Wave: 'triangle', unison: 5, spread: 25, osc2Level: 0.3, osc2Semi: 19, filterType: 'highpass', cutoff: 300, lfoTarget: 'filter', lfoRate: 0.15, lfoDepth: 0.3 },
      'Spöke': { osc1Wave: 'sine', noise: 0.05, lfoTarget: 'pitch', lfoRate: 4, lfoDepth: 0.3 },
      'Ekokammare': { osc1Wave: 'square', cutoff: 1200, attack: 0.01, decay: 0.4, sustain: 0, delayMix: 0.5, delayTime: 0.45, delayFeedback: 0.7 },
      'Radiostörning': { osc1Wave: 'sawtooth', noise: 0.3, cutoff: 3000, q: 3, drive: 0.15, lfoTarget: 'amp', lfoRate: 9, lfoDepth: 0.35 },
      'Glitter': { osc1Wave: 'sine', osc2Mode: 'fm', fmAmount: 3, osc2Semi: 24, attack: 0.005, decay: 0.3, sustain: 0, delayMix: 0.5, delayTime: 0.125, delayFeedback: 0.65 },
      'Mörk portal': { osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc2Level: 0.7, osc2Semi: -24, cutoff: 300, q: 8, lfoTarget: 'filter', lfoRate: 0.05, lfoDepth: 0.8, drive: 0.3 },
      'Havsvågor': { osc1Level: 0.2, noise: 0.7, cutoff: 800, lfoTarget: 'filter', lfoRate: 0.1, lfoDepth: 0.8 },
      'Stjärnstoft': { osc1Wave: 'triangle', osc2Mode: 'fm', fmAmount: 1, osc2Semi: 12, attack: 0.01, decay: 1.5, sustain: 0.1, delayMix: 0.45, delayTime: 0.375, delayFeedback: 0.6, reverbMix: 0.7, reverbSize: 10 },
    },
  },
  {
    name: 'Retro & chip',
    base: { attack: 0.001, decay: 0.15, sustain: 0.6, release: 0.06, reverbMix: 0.08, reverbSize: 1 },
    presets: {
      '8-bit puls': { osc1Wave: 'pulse' },
      '8-bit fyrkant': { osc1Wave: 'square' },
      'Fickspel': { osc1Wave: 'pulse', cutoff: 4000, lfoTarget: 'pitch', lfoRate: 7, lfoDepth: 0.1 },
      'Drill': { osc1Wave: 'square', lfoTarget: 'pitch', lfoRate: 14, lfoDepth: 0.35 },
      'Laser': { osc1Wave: 'sawtooth', cutoff: 300, q: 8, fEnv: 5, fAttack: 0.001, fDecay: 0.15, fSustain: 0, decay: 0.4, sustain: 0.1 },
      'Hemdator': { osc1Wave: 'sawtooth', osc2Wave: 'pulse', osc2Level: 0.5, osc2Fine: 10, cutoff: 2500, q: 4 },
      'Triangelbas': { osc1Wave: 'triangle', sustain: 0.8 },
      'Bitklocka': { osc1Wave: 'square', osc2Wave: 'square', osc2Level: 0.4, osc2Semi: 12, decay: 0.3, sustain: 0 },
      'Pling': { osc1Wave: 'pulse', decay: 0.45, sustain: 0.1, delayMix: 0.3, delayTime: 0.15, delayFeedback: 0.4 },
      'Retrolead': { osc1Wave: 'pulse', unison: 2, spread: 8, lfoTarget: 'pitch', lfoRate: 6, lfoDepth: 0.12, delayMix: 0.25, delayTime: 0.2, delayFeedback: 0.35 },
    },
  },
];

// Ett bibliotek per motor, i samma ordning som motorvalet: Oscillatorer (kategorierna ovan),
// Sträng och Resonans (js/pm-library.js), FM (js/fm-library.js) och Vågtabell (js/wt-library.js).
PRESET_CATEGORIES.forEach((c) => { c.group = 'Oscillatorer'; });
[
  ['Sträng', STRING_CATEGORIES], ['Resonans', MODAL_CATEGORIES], ['FM', FM_CATEGORIES], ['Vågtabell', WT_CATEGORIES],
].forEach(([group, cats]) => cats.forEach((c) => PRESET_CATEGORIES.push({ ...c, group })));

// Platt lista: { group, cat, name, params } – params är kompletta (defaults + kategori + ljud)
const PRESET_LIBRARY = PRESET_CATEGORIES.flatMap(({ name: cat, group, base, presets }) =>
  Object.entries(presets).map(([name, p]) => ({ group, cat, name, params: { ...SYNTH_DEFAULTS, ...base, ...p } }))
);
const PRESET_GROUPS = [...new Set(PRESET_CATEGORIES.map((c) => c.group))];

// ---------- Snabbvalet (listan Ljud i spelraden) ----------
// Fem ljud från varje motor, i grupper. Biblioteksljud som står här blir egna snabbval.
const QUICK_SOUNDS = [
  ['Oscillatorer', ['Elpiano', 'Varm pad', 'Supersaw-lead', 'Bas', 'Orgel']],
  ['Sträng', ['Gitarr', 'Piano', 'Elgitarr', 'Kontrabas', 'Sitar']],
  ['Resonans', ['Marimbaträ', 'Vibrafonstav', 'Tumkalimba', 'Trinidadpan', 'Klangskål']],
  ['FM', ['Klassiskt FM-piano', 'FM-klocka', 'Slapbas FM', 'FM-brass', 'Jazz-FM']],
  ['Vågtabell', ['Morfmatta', 'Synklead', 'Reesebas', 'Vågpiano', 'Vokalsvep']],
];
QUICK_SOUNDS.forEach(([, names]) => names.forEach((name) => {
  if (!(name in SYNTH_PRESETS)) SYNTH_PRESETS[name] = { ...PRESET_LIBRARY.find((e) => e.name === name).params };
}));
const QUICK_NAMES = QUICK_SOUNDS.flatMap(([, names]) => names);

