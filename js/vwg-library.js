// Bibliotek för Röst, Blås och Granulär: 20 ljud per motor (två kategorier med tio ljud var).
// Laddas före js/sound-library.js, som lägger kategorierna i presetbiblioteket.
//
// V(röstläge, vokal, { mv, mr, br, vib, n, sp, …övrigt })
//   vokal 0 = u, 0,25 = o, 0,5 = a, 0,75 = e, 1 = i · mv/mr = vokalglidning (djup/takt) · br = luft
//   vib = sångvibrato · n = antal röster (1 = solo) · sp = svävning mellan rösterna (cent)
// B(instrument, { p, nz, b, vib, at, …övrigt })  instrument: 'flute' eller 'reed'
//   p = blåstryck · nz = andning · b = ljushet · vib = vibrato · at = anblåsning (s)
// G(källa, { pos, scan, sp, size, d, j, w, …övrigt })
//   pos = var i källan · scan = vandring · sp = spridning · size = kornstorlek (s)
//   d = täthet (korn/s) · j = tonslump (cent) · w = stereobredd
// Övrigt = motorns vanliga reglage (volymkurva, filter, effekter).

function V(type, vowel, o = {}) {
  const { mv = 0, mr = 0.3, br = 0.15, vib = 0.4, n = 1, sp = 12, ...fx } = o;
  return {
    model: 'voice', voiceType: type, voiceVowel: vowel, voiceMove: mv, voiceMoveRate: mr, voiceBreath: br,
    voiceVib: vib, voiceChoir: n, voiceSpread: sp, ...fx,
  };
}

function B(kind, o = {}) {
  const { p = 0.5, nz = 0.3, b = 0.5, vib = 0.3, at = 0.06, ...fx } = o;
  return { model: 'wind', windKind: kind, windPressure: p, windNoise: nz, windBright: b, windVib: vib, windAttack: at, ...fx };
}

function G(source, o = {}) {
  const { pos = 0.5, scan = 0, sp = 0.15, size = 0.12, d = 30, j = 8, w = 0.7, ...fx } = o;
  return {
    model: 'grain', grainSource: source, grainPos: pos, grainScan: scan, grainSpread: sp, grainSize: size,
    grainDensity: d, grainJitter: j, grainWidth: w, ...fx,
  };
}

const VWG_ECHO = { delayMix: 0.25, delayTime: 0.375, delayFeedback: 0.4 };

const VOICE_CATEGORIES = [
  {
    name: 'Sångröster',
    base: { attack: 0.08, decay: 0.3, sustain: 1, release: 0.5, reverbMix: 0.35, reverbSize: 3 },
    presets: {
      'Altsolo': V('alto', 0.5, { vib: 0.5 }),
      'Tenorsolo': V('tenor', 0.5, { vib: 0.5 }),
      'Bassolo': V('bass', 0.38, { vib: 0.4 }),
      'Sopransolo': V('soprano', 0.5, { vib: 0.6, reverbMix: 0.4 }),
      'Barnröst': V('child', 0.55, { vib: 0.25, br: 0.2 }),
      'Blandad kör': V('alto', 0.5, { n: 5, sp: 14, vib: 0.45, attack: 0.25, release: 1, reverbMix: 0.45, reverbSize: 4 }),
      'Manskör': V('bass', 0.4, { n: 5, sp: 12, vib: 0.35, attack: 0.25, release: 1, reverbMix: 0.45, reverbSize: 4 }),
      'Damkör': V('soprano', 0.5, { n: 5, sp: 14, vib: 0.5, attack: 0.25, release: 1, reverbMix: 0.45, reverbSize: 4 }),
      'Barnkör': V('child', 0.55, { n: 5, sp: 16, vib: 0.25, br: 0.2, attack: 0.2, release: 0.8, reverbMix: 0.45, reverbSize: 3.5 }),
      'Gregoriansk kör': V('bass', 0.25, { n: 4, sp: 8, vib: 0.1, attack: 0.4, release: 2, reverbMix: 0.6, reverbSize: 7 }),
    },
  },
  {
    name: 'Röstsynt',
    base: { attack: 0.02, decay: 0.3, sustain: 1, release: 0.35, reverbMix: 0.25, reverbSize: 2.5 },
    presets: {
      'Vokalglid': V('alto', 0.5, { mv: 0.9, mr: 0.25, vib: 0.3 }),
      'Pratande synt': V('tenor', 0.5, { mv: 1, mr: 3.5, vib: 0, br: 0.05 }),
      'Wah-röst': V('tenor', 0.4, { mv: 0.7, mr: 1.2, vib: 0.2, drive: 0.15 }),
      'Nynnande': V('alto', 0, { vib: 0.3, br: 0.05, attack: 0.12 }),
      'Viskning': V('alto', 0.5, { br: 1, vib: 0, mv: 0.3, mr: 0.4 }),
      'Rymdkör': V('soprano', 0.5, { n: 6, sp: 25, vib: 0.3, mv: 0.3, mr: 0.1, attack: 0.8, release: 2.5, chorus: 0.3, reverbMix: 0.6, reverbSize: 7, ...VWG_ECHO }),
      'Röstmatta': V('alto', 0.35, { n: 6, sp: 18, vib: 0.3, attack: 0.6, release: 2, chorus: 0.4, reverbMix: 0.5, reverbSize: 5 }),
      'Röstplock': V('alto', 0.5, { vib: 0, decay: 0.35, sustain: 0, release: 0.3, ...VWG_ECHO }),
      'Ekoröst': V('tenor', 0.75, { vib: 0.4, ...VWG_ECHO, delayMix: 0.35, delayFeedback: 0.5 }),
      'Lekfull röst': V('child', 0.5, { mv: 0.7, mr: 2, vib: 0.2 }),
    },
  },
];

const WIND_CATEGORIES = [
  {
    name: 'Flöjter',
    base: { attack: 0.01, decay: 0.3, sustain: 1, release: 0.15, reverbMix: 0.3, reverbSize: 2.5 },
    presets: {
      'Tvärflöjt': B('flute', { p: 0.55, nz: 0.25, b: 0.55, vib: 0.5 }),
      'Panflöjt': B('flute', { p: 0.45, nz: 0.7, b: 0.3, vib: 0.2, at: 0.04, reverbMix: 0.4 }),
      'Blockflöjt': B('flute', { p: 0.5, nz: 0.15, b: 0.35, vib: 0, at: 0.03 }),
      'Ocarina': B('flute', { p: 0.4, nz: 0.2, b: 0.05, vib: 0.3 }),
      'Shakuhachi': B('flute', { p: 0.6, nz: 0.9, b: 0.5, vib: 0.6, at: 0.15, reverbMix: 0.4, reverbSize: 3.5 }),
      'Bambuflöjt': B('flute', { p: 0.5, nz: 0.5, b: 0.45, vib: 0.4 }),
      'Luftig flöjt': B('flute', { p: 0.3, nz: 1, b: 0.4, vib: 0.3, at: 0.1 }),
      'Skarp flöjt': B('flute', { p: 0.9, nz: 0.2, b: 1, vib: 0.4 }),
      'Flaskblås': B('flute', { p: 0.35, nz: 0.8, b: 0, vib: 0, at: 0.08, reverbMix: 0.2 }),
      'Flöjt i sal': B('flute', { p: 0.55, nz: 0.3, b: 0.5, vib: 0.5, reverbMix: 0.6, reverbSize: 5, ...VWG_ECHO, delayMix: 0.15 }),
    },
  },
  {
    name: 'Rörblad',
    base: { attack: 0.01, decay: 0.3, sustain: 1, release: 0.15, reverbMix: 0.25, reverbSize: 2.2 },
    presets: {
      'Konsertklarinett': B('reed', { p: 0.5, nz: 0.2, b: 0.5, vib: 0.2 }),
      'Mörk klarinett': B('reed', { p: 0.45, nz: 0.2, b: 0.1, vib: 0.2 }),
      'Ljus klarinett': B('reed', { p: 0.7, nz: 0.2, b: 0.95, vib: 0.2 }),
      'Mjuk klarinett': B('reed', { p: 0.15, nz: 0.3, b: 0.3, vib: 0.2, at: 0.12 }),
      'Jazzklarinett': B('reed', { p: 0.6, nz: 0.3, b: 0.7, vib: 0.7 }),
      'Chalumeau': B('reed', { p: 0.4, nz: 0.2, b: 0, vib: 0.1 }),
      'Skalmeja': B('reed', { p: 0.9, nz: 0.4, b: 1, vib: 0.1, drive: 0.2 }),
      'Klarinett i kyrka': B('reed', { p: 0.45, nz: 0.2, b: 0.4, vib: 0.2, reverbMix: 0.6, reverbSize: 6 }),
      'Drömklarinett': B('reed', { p: 0.4, nz: 0.25, b: 0.4, vib: 0.3, chorus: 0.5, ...VWG_ECHO, reverbMix: 0.45, reverbSize: 4 }),
      'Kraftig klarinett': B('reed', { p: 1, nz: 0.3, b: 0.8, vib: 0.2 }),
    },
  },
];

const GRAIN_CATEGORIES = [
  {
    name: 'Kornmoln',
    base: { attack: 0.25, decay: 0.5, sustain: 1, release: 1.2, reverbMix: 0.4, reverbSize: 4 },
    presets: {
      'Körmoln': G('choir', { pos: 0.5, sp: 0.2, size: 0.15, d: 35, j: 8 }),
      'Frusen kör': G('choir', { pos: 0.5, sp: 0.02, size: 0.25, d: 40, j: 3, attack: 0.4 }),
      'Vandrande kör': G('choir', { pos: 0.1, scan: 0.3, sp: 0.1, size: 0.2, d: 30, j: 5 }),
      'Viskande kör': G('choir', { pos: 0.5, sp: 0.8, size: 0.03, d: 60, j: 40, w: 1 }),
      'Stråkmoln': G('strings', { sp: 0.5, size: 0.2, d: 30, j: 6 }),
      'Stråkar som andas': G('strings', { scan: -0.2, sp: 0.3, size: 0.3, d: 20, j: 4, attack: 1, release: 2 }),
      'Stammande stråkar': G('strings', { sp: 0.3, size: 0.04, d: 12, j: 0, attack: 0.01, release: 0.4 }),
      'Korniga stråkar': G('strings', { sp: 0.6, size: 0.015, d: 90, j: 20 }),
      'Glasmoln': G('glass', { sp: 0.4, size: 0.15, d: 40, j: 15, w: 1 }),
      'Kristallstoft': G('glass', { sp: 0.8, size: 0.02, d: 80, j: 30, w: 1, ...VWG_ECHO }),
    },
  },
  {
    name: 'Natur & texturer',
    base: { attack: 0.3, decay: 0.5, sustain: 1, release: 1.5, reverbMix: 0.35, reverbSize: 3 },
    presets: {
      'Vind': G('wind', { sp: 1, size: 0.3, d: 20, j: 20, w: 1 }),
      'Storm': G('wind', { sp: 1, size: 0.15, d: 50, j: 60, w: 1, drive: 0.15, reverbMix: 0.5 }),
      'Regn': G('rain', { sp: 1, size: 0.2, d: 30, j: 10, w: 1 }),
      'Lätt regn': G('rain', { sp: 1, size: 0.08, d: 10, j: 10, w: 1 }),
      'Bäck': G('water', { sp: 1, size: 0.2, d: 30, j: 15, w: 1 }),
      'Bubblor': G('water', { sp: 1, size: 0.05, d: 15, j: 40, w: 1 }),
      'Fågelsång': G('birds', { sp: 1, size: 0.25, d: 12, j: 15, w: 1 }),
      'Skogsfåglar': G('birds', { sp: 1, size: 0.3, d: 6, j: 30, w: 1, reverbMix: 0.6, reverbSize: 4.5 }),
      'Glitterstoft': G('glitter', { sp: 1, size: 0.15, d: 25, j: 20, w: 1 }),
      'Stjärnstoft': G('glitter', { sp: 1, size: 0.05, d: 60, j: 100, w: 1, ...VWG_ECHO, reverbMix: 0.5, reverbSize: 5 }),
    },
  },
];
