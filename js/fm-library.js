// FM-biblioteket: 256 färdiga ljud för FM-motorn, 16 kategorier med 16 ljud i varje.
//
// Varje kategori bygger på ett eller flera "recept" (klassiska FM-knep: elpiano med två par, klockor
// med ojämna förhållanden, mässing med långsam modulator, orgel med fyra bärare …) som varieras.
// Volymkurvan i motorn står öppen (sustain 100 %) – det är operatorernas egna kurvor som formar
// ljudet. Laddas före js/sound-library.js, som lägger kategorierna sist i presetbiblioteket.

// En operator: [förhållande, nivå, attack, decay, sustain]
// x: fb = återkoppling, det = svävning (cent), rel = släpptid, resten = motorns vanliga reglage
function FM(algo, ops, x = {}) {
  const { fb = 0, det = 0, rel = 0.4, ...fx } = x;
  const p = { model: 'fm', fmAlgo: String(algo), fmFb: fb, fmDetune: det, attack: 0.003, decay: 0.1, sustain: 1, release: rel };
  ops.forEach(([r, l, a = 0.002, d = 1, s = 0], i) => {
    const k = i + 1;
    Object.assign(p, { [`op${k}Ratio`]: r, [`op${k}Level`]: l, [`op${k}Attack`]: a, [`op${k}Decay`]: d, [`op${k}Sustain`]: s });
  });
  return Object.assign(p, fx);
}

// ---------- Recept ----------
// Elpiano: två par (2→1 kroppen, 4→3 det metalliska "tine"-anslaget)
const fmEp = (v = {}) => FM(5, [
  [1, 1, 0.002, v.dec ?? 3, v.sus ?? 0.12],
  [v.r2 ?? 1, v.mod ?? 0.3, 0.002, v.mdec ?? 0.9, v.msus ?? 0.12],
  [v.r3 ?? 1, v.tl ?? 0.45, 0.002, (v.dec ?? 3) * 0.5, 0.03],
  [v.r4 ?? 14, v.tine ?? 0.2, 0.002, v.tdec ?? 0.12, 0],
], { det: v.det ?? 3, rel: v.rel ?? 0.5, ...v.fx });

// Klocka: två par med ojämna förhållanden, lång klingtid
const fmBell = (v = {}) => FM(5, [
  [1, 1, 0.001, v.dec ?? 5, 0],
  [v.r2 ?? 3.5, v.mod ?? 0.45, 0.001, v.mdec ?? 3, 0],
  [v.r3 ?? 2, v.l3 ?? 0.4, 0.001, (v.dec ?? 5) * 0.6, 0],
  [v.r4 ?? 7.1, v.m4 ?? 0.3, 0.001, (v.mdec ?? 3) * 0.5, 0],
], { det: v.det ?? 2, rel: v.rel ?? 3, ...v.fx });

// Slagna stavar: kort, ljust anslag som snabbt mjuknar
const fmMallet = (v = {}) => FM(5, [
  [1, 1, 0.001, v.dec ?? 0.8, 0],
  [v.r2 ?? 4, v.mod ?? 0.3, 0.001, v.mdec ?? 0.06, 0],
  [v.r3 ?? 3, v.l3 ?? 0.25, 0.001, (v.dec ?? 0.8) * 0.4, 0],
  [v.r4 ?? 1, v.m4 ?? 0.2, 0.001, 0.05, 0],
], { det: v.det ?? 0, rel: v.rel ?? 0.5, ...v.fx });

// Bas: 3→2→1 och 4→1, med lite återkoppling för knorr
const fmBass = (v = {}) => FM(3, [
  [1, 1, 0.002, v.dec ?? 1.5, v.sus ?? 0.6],
  [v.r2 ?? 1, v.mod ?? 0.4, 0.002, v.mdec ?? 0.25, v.msus ?? 0.1],
  [v.r3 ?? 1, v.m3 ?? 0.15, 0.002, 0.15, 0],
  [v.r4 ?? 0.5, v.m4 ?? 0.15, 0.002, v.m4dec ?? 0.4, v.m4sus ?? 0.1],
], { fb: v.fb ?? 0.1, rel: v.rel ?? 0.12, ...v.fx });

// Mässing: modulatorn sväller in lite efter bäraren (klassiskt FM-brass)
const fmBrass = (v = {}) => FM(2, [
  [1, 1, v.att ?? 0.04, 1, 0.9],
  [1, v.mod ?? 0.5, v.matt ?? 0.09, v.mdec ?? 0.4, v.msus ?? 0.55],
  [v.r3 ?? 1, v.m3 ?? 0.15, 0.05, 0.5, 0.4],
  [v.r4 ?? 1, v.m4 ?? 0.1, 0.03, 0.3, 0.3],
], { fb: v.fb ?? 0.25, det: v.det ?? 3, rel: v.rel ?? 0.2, ...v.fx });

// Matta: tre bärare som svävar mot varandra, en långsam modulator
const fmPad = (v = {}) => FM(v.algo ?? 6, [
  [1, 1, v.att ?? 0.8, 2, 0.9],
  [v.r2 ?? 2, v.l2 ?? 0.6, v.att ?? 0.8, 2, 0.9],
  [v.r3 ?? 3, v.l3 ?? 0.3, v.att ?? 0.8, 2, 0.8],
  [v.r4 ?? 1, v.mod ?? 0.25, v.matt ?? 1.5, v.mdec ?? 3, v.msus ?? 0.5],
], { det: v.det ?? 8, rel: v.rel ?? 2, fb: v.fb ?? 0, ...v.fx });

// Lead: kedja med återkoppling (sågtandslikt) och vibrato
const fmLead = (v = {}) => FM(1, [
  [1, 1, 0.005, 1, 0.9],
  [v.r2 ?? 1, v.mod ?? 0.35, 0.005, v.mdec ?? 0.5, v.msus ?? 0.4],
  [v.r3 ?? 1, v.m3 ?? 0.2, 0.005, 0.5, 0.3],
  [v.r4 ?? 1, v.m4 ?? 0.15, 0.005, 0.5, 0.3],
], { fb: v.fb ?? 0.5, det: v.det ?? 0, rel: v.rel ?? 0.2, lfoTarget: 'pitch', lfoRate: 5.5, lfoDepth: 0.06, ...v.fx });

// Orgel: fyra bärare som dragstänger (perc = ett kort klick på den fjärde)
const fmOrgan = (v = {}) => {
  const r = v.r ?? [0.5, 1, 2, 3];
  const l = v.l ?? [0.6, 1, 0.6, 0.4];
  return FM(v.algo ?? 8, r.map((ratio, i) => (i === 3 && v.perc ? [ratio, l[i], 0.002, 0.25, 0] : [ratio, l[i], 0.005, 0.1, 1])),
    { det: v.det ?? 2, fb: v.fb ?? 0, rel: 0.1, lfoTarget: 'pitch', lfoRate: 6.2, lfoDepth: 0.04, ...v.fx });
};

// Knäppt: 3→2→1 och 4→1, allt klingar av
const fmPluck = (v = {}) => FM(3, [
  [1, 1, 0.001, v.dec ?? 1.5, 0],
  [v.r2 ?? 1, v.mod ?? 0.4, 0.001, v.mdec ?? 0.25, 0],
  [v.r3 ?? 3, v.m3 ?? 0.15, 0.001, 0.1, 0],
  [v.r4 ?? 2, v.m4 ?? 0.1, 0.001, v.m4dec ?? 0.5, 0],
], { fb: v.fb ?? 0, det: v.det ?? 2, rel: v.rel ?? 0.4, ...v.fx });

// Träblås: bärare + mjuk modulator + andning (operator 4 med full återkoppling = brus)
const fmWind = (v = {}) => FM(3, [
  [1, 1, v.att ?? 0.06, 1, 0.95],
  [v.r2 ?? 1, v.mod ?? 0.15, v.matt ?? 0.08, 0.5, v.msus ?? 0.12],
  [v.r3 ?? 2, v.m3 ?? 0, 0.05, 0.5, 0.5],
  [v.r4 ?? 1, v.br ?? 0.05, 0.02, 0.3, v.brs ?? 0.03],
], { fb: v.fb ?? 0.9, det: v.det ?? 0, rel: v.rel ?? 0.2, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: v.vib ?? 0.04, ...v.fx });

// Atmosfär: långsamma kurvor, ojämna förhållanden, mycket rum
const fmAtmo = (v = {}) => FM(v.algo ?? 2, [
  [1, 1, v.att ?? 1.5, 3, 0.8],
  [v.r2 ?? 1.41, v.mod ?? 0.35, v.matt ?? 3, v.mdec ?? 5, v.msus ?? 0.3],
  [v.r3 ?? 3.5, v.m3 ?? 0.15, 2, 5, 0.3],
  [v.r4 ?? 0.5, v.m4 ?? 0.1, 3, 5, 0.3],
], { fb: v.fb ?? 0.2, det: v.det ?? 10, rel: v.rel ?? 4, lfoTarget: 'filter', lfoRate: 0.1, lfoDepth: 0.3, ...v.fx });

// Röst: bärare på grundton och två "formanter", en modulator som ger liv
const fmVoice = (v = {}) => FM(6, [
  [1, 1, v.att ?? 0.25, 1, 0.9],
  [v.f1 ?? 3, v.l1 ?? 0.4, v.att ?? 0.25, 1, 0.9],
  [v.f2 ?? 6, v.l2 ?? 0.15, (v.att ?? 0.25) * 1.2, 1, 0.9],
  [1, v.mod ?? 0.12, 0.3, 1, 0.8],
], { fb: v.fb ?? 0, det: v.det ?? 8, rel: v.rel ?? 0.8, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.05, ...v.fx });

// Glas: höga, ojämna förhållanden
const fmGlass = (v = {}) => FM(5, [
  [1, 1, v.att ?? 0.001, v.dec ?? 3, v.sus ?? 0],
  [v.r2 ?? 7, v.mod ?? 0.2, 0.001, v.mdec ?? 0.5, 0],
  [v.r3 ?? 4, v.l3 ?? 0.35, v.att ?? 0.001, (v.dec ?? 3) * 0.5, v.sus ?? 0],
  [v.r4 ?? 11, v.m4 ?? 0.15, 0.001, 0.3, 0],
], { det: v.det ?? 3, rel: v.rel ?? 2, ...v.fx });

// ---------- Kategorierna ----------
const FM_CATEGORIES = [
  {
    name: 'FM-piano',
    base: { reverbMix: 0.2, reverbSize: 1.8, chorus: 0.25 },
    presets: {
      'Klassiskt FM-piano': fmEp(),
      'Mjukt FM-piano': fmEp({ mod: 0.18, tine: 0.1, fx: { chorus: 0.35 } }),
      'Ljust FM-piano': fmEp({ mod: 0.42, tine: 0.3 }),
      'Tine-klang': fmEp({ tine: 0.38, tl: 0.6, tdec: 0.2 }),
      'Ballad-EP': fmEp({ mod: 0.22, dec: 4.5, fx: { reverbMix: 0.35, chorus: 0.4 } }),
      'Funky EP': fmEp({ mod: 0.5, mdec: 0.35, dec: 1.6, rel: 0.25, fx: { drive: 0.25, chorus: 0.1 } }),
      'Glas-EP': fmEp({ r2: 2, mod: 0.25, r4: 7, tine: 0.3, fx: { reverbMix: 0.35 } }),
      'Mörkt EP': fmEp({ mod: 0.15, tine: 0.05, fx: { cutoff: 2500 } }),
      'Tremolo-EP': fmEp({ fx: { lfoTarget: 'amp', lfoRate: 4.5, lfoDepth: 0.45 } }),
      'Chorus-EP': fmEp({ det: 7, fx: { chorus: 0.7 } }),
      'Vintage-EP': fmEp({ mod: 0.35, msus: 0.25, fx: { drive: 0.2, cutoff: 5000, lfoTarget: 'amp', lfoRate: 3.5, lfoDepth: 0.2 } }),
      'Hårt anslag': fmEp({ mod: 0.6, mdec: 0.25, tine: 0.35 }),
      'Kammar-EP': fmEp({ mod: 0.25, dec: 2, fx: { reverbMix: 0.15, reverbSize: 1 } }),
      'Kvälls-EP': fmEp({ mod: 0.2, dec: 5, det: 5, fx: { delayMix: 0.2, delayTime: 0.45, delayFeedback: 0.35, reverbMix: 0.35 } }),
      'Neon-EP': fmEp({ mod: 0.35, r4: 3, tine: 0.25, det: 8, fx: { chorus: 0.5, delayMix: 0.15, delayTime: 0.33 } }),
      'Konsert-FM': fmEp({ mod: 0.38, msus: 0.05, mdec: 1.5, r4: 3, tine: 0.12, tl: 0.7, dec: 5, sus: 0, det: 2, fx: { chorus: 0.1, reverbMix: 0.3 } }),
    },
  },
  {
    name: 'FM-klockor',
    base: { reverbMix: 0.4, reverbSize: 4 },
    presets: {
      'FM-klocka': fmBell(),
      'Tempelklocka': fmBell({ r2: 1.41, mod: 0.5, dec: 8, r3: 0.5, l3: 0.5, r4: 2.76, fx: { reverbMix: 0.55, reverbSize: 7 } }),
      'Bjällra': fmBell({ dec: 1.5, r2: 5.4, mod: 0.35, r3: 3, r4: 9.2, rel: 1 }),
      'Kyrkklang': fmBell({ dec: 9, r3: 0.5, l3: 0.6, r4: 1.41, m4: 0.35, fx: { reverbMix: 0.6, reverbSize: 8 } }),
      'Gamelan': fmBell({ r2: 2.4, mod: 0.4, r3: 3.6, l3: 0.35, r4: 1.5, dec: 4, det: 6 }),
      'Rörklang': fmBell({ mod: 0.3, r3: 2.76, l3: 0.4, r4: 5.4, dec: 6 }),
      'Vindspel': fmBell({ dec: 3, r2: 7.1, mod: 0.25, r3: 4.1, l3: 0.5, r4: 11, m4: 0.2, fx: { delayMix: 0.3, delayTime: 0.38, delayFeedback: 0.45 } }),
      'Glasklocka': fmBell({ r2: 5, mod: 0.3, r3: 3, l3: 0.4, r4: 9, dec: 4 }),
      'Mörk klocka': fmBell({ r2: 1.41, mod: 0.35, r3: 0.5, l3: 0.5, r4: 1.41, m4: 0.2, fx: { cutoff: 3000 } }),
      'Juleklocka': fmBell({ mod: 0.55, dec: 2.5, r3: 4, l3: 0.3, r4: 7, det: 4, fx: { delayMix: 0.2, delayTime: 0.3 } }),
      'Bronsklocka': fmBell({ r2: 1.73, mod: 0.6, dec: 6, r3: 2.83, l3: 0.4, r4: 3.46 }),
      'Klockspel FM': fmBell({ mod: 0.2, dec: 2, r3: 2.76, l3: 0.3, r4: 5.4, m4: 0.1, rel: 1.5 }),
      'Tibetansk skål': fmBell({ r2: 2.71, mod: 0.15, mdec: 8, dec: 10, r3: 2.71, l3: 0.35, r4: 5.4, m4: 0.1, det: 4, rel: 5, fx: { reverbMix: 0.5 } }),
      'Kristallklocka': fmBell({ r2: 7, mod: 0.3, r3: 5.04, l3: 0.35, r4: 9, dec: 5 }),
      'Liten bjällra': fmBell({ dec: 0.9, r2: 9.2, mod: 0.3, r3: 6.3, l3: 0.4, r4: 12, rel: 0.6 }),
      'Stor klocka': fmBell({ r2: 1.41, mod: 0.55, dec: 10, r3: 0.5, l3: 0.7, r4: 2.4, m4: 0.4, rel: 6, fx: { reverbMix: 0.6, reverbSize: 9 } }),
    },
  },
  {
    name: 'FM-stavspel',
    base: { reverbMix: 0.25, reverbSize: 2.2 },
    presets: {
      'FM-marimba': fmMallet(),
      'Mjuk marimba': fmMallet({ mod: 0.15, l3: 0.1 }),
      'Basmarimba': fmMallet({ dec: 1.4, mod: 0.2, r3: 10, l3: 0.08 }),
      'Vibrafon FM': fmMallet({ dec: 3, r2: 1, mod: 0.12, mdec: 0.5, r3: 4, l3: 0.25, fx: { lfoTarget: 'amp', lfoRate: 5.5, lfoDepth: 0.35, reverbMix: 0.35 } }),
      'Xylofon FM': fmMallet({ dec: 0.5, r2: 3, mod: 0.35, r3: 6, l3: 0.3 }),
      'Kalimba FM': fmMallet({ dec: 1.2, r2: 5.6, mod: 0.25, r3: 5.6, l3: 0.15 }),
      'Trästav': fmMallet({ dec: 0.35, r2: 2.3, mod: 0.4, r3: 5.4, l3: 0.2 }),
      'Steeldrum FM': fmMallet({ dec: 1.5, r2: 1.5, mod: 0.3, mdec: 0.25, r3: 2, l3: 0.4 }),
      'Balafon': fmMallet({ dec: 0.6, r2: 3.9, mod: 0.45, r3: 2.7, l3: 0.15 }),
      'Celesta FM': fmMallet({ dec: 1.8, r2: 2, mod: 0.15, mdec: 0.3, r3: 4, l3: 0.2, fx: { reverbMix: 0.35 } }),
      'Musikdosa': fmMallet({ dec: 1.5, r2: 5, mod: 0.12, r3: 8, l3: 0.15, fx: { reverbMix: 0.4 } }),
      'Glasmarimba': fmMallet({ r2: 7, mod: 0.25, r3: 4, l3: 0.3, dec: 1 }),
      'Tumpiano FM': fmMallet({ dec: 1, r2: 6.3, mod: 0.2, r3: 3.2, l3: 0.12 }),
      'Plastklubba': fmMallet({ dec: 0.4, r2: 2, mod: 0.5, mdec: 0.03, r3: 5, l3: 0.25 }),
      'Klangstav': fmMallet({ dec: 2.5, r2: 2.76, mod: 0.2, r3: 5.4, l3: 0.25, fx: { reverbMix: 0.35 } }),
      'Dov stav': fmMallet({ dec: 1, mod: 0.1, l3: 0.05, fx: { cutoff: 2000 } }),
    },
  },
  {
    name: 'FM-bas',
    base: { reverbMix: 0.03 },
    presets: {
      'Operatorbas': fmBass(),
      'Slapbas FM': fmBass({ mod: 0.6, mdec: 0.08, r3: 3, m3: 0.3, sus: 0.4 }),
      'Träbas': fmBass({ mod: 0.25, mdec: 0.4, sus: 0.2, dec: 0.9, m4: 0 }),
      'Subbas FM': fmBass({ mod: 0.08, m3: 0, m4: 0.05, fb: 0 }),
      'Solid bas': fmBass({ mod: 0.45, msus: 0.25, fb: 0.3 }),
      'Gummibas': fmBass({ mod: 0.35, mdec: 0.6, r2: 0.5, m4: 0.05 }),
      'Knurrbas': fmBass({ fb: 0.55, m4: 0.35, msus: 0.3 }),
      'Funkbas': fmBass({ mod: 0.55, mdec: 0.12, sus: 0.5, rel: 0.08 }),
      'Popbas FM': fmBass({ mod: 0.45, mdec: 0.2, r4: 1, m4: 0.25, m4dec: 0.15, m4sus: 0 }),
      'Mörk bas': fmBass({ mod: 0.2, fx: { cutoff: 900 } }),
      'Plockbas': fmBass({ sus: 0, dec: 0.8, mod: 0.35, mdec: 0.15 }),
      'Klickbas': fmBass({ r3: 7, m3: 0.4, mod: 0.3 }),
      'Bandlös FM': fmBass({ mod: 0.2, mdec: 0.8, msus: 0.2, fx: { attack: 0.02, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.05 } }),
      'Metallbas': fmBass({ r3: 3.5, m3: 0.3, mod: 0.35 }),
      'Wobbel-FM': fmBass({ mod: 0.4, msus: 0.4, fx: { lfoTarget: 'filter', lfoRate: 3, lfoDepth: 0.6, cutoff: 600, q: 6 } }),
      'Oktavbas': fmBass({ r2: 0.5, mod: 0.3, msus: 0.2, m4: 0.1 }),
    },
  },
  {
    name: 'FM-mässing',
    base: { reverbMix: 0.2 },
    presets: {
      'FM-brass': fmBrass(),
      'Mjukt horn': fmBrass({ mod: 0.3, matt: 0.2, att: 0.08, fb: 0.1 }),
      'Trumpet FM': fmBrass({ mod: 0.6, msus: 0.7, fb: 0.35 }),
      'Brass-stöt': fmBrass({ mdec: 0.15, msus: 0.3, rel: 0.08, att: 0.01, matt: 0.02 }),
      'Syntbrass': fmBrass({ det: 10, fx: { chorus: 0.4 } }),
      'Valthorn': fmBrass({ mod: 0.25, matt: 0.15, fx: { cutoff: 2500, reverbMix: 0.35 } }),
      'Trombon FM': fmBrass({ mod: 0.45, matt: 0.12, fx: { cutoff: 3500 } }),
      'Mässingssektion': fmBrass({ det: 7, fx: { chorus: 0.35 } }),
      'Fanfar': fmBrass({ mod: 0.7, matt: 0.05, msus: 0.7, fb: 0.4, fx: { reverbMix: 0.35 } }),
      'Svällande brass': fmBrass({ att: 0.4, matt: 0.8, mdec: 1, msus: 0.7, rel: 0.5 }),
      'Mörk brass': fmBrass({ mod: 0.35, fx: { cutoff: 1800 } }),
      'Ljus brass': fmBrass({ mod: 0.75, msus: 0.75, fb: 0.45 }),
      '80-talsbrass': fmBrass({ det: 12, mod: 0.55, fx: { chorus: 0.5, reverbMix: 0.3 } }),
      'Brassmatta': fmBrass({ att: 0.6, matt: 1.2, rel: 1.2, det: 8, fx: { chorus: 0.5, reverbMix: 0.45 } }),
      'Tuba FM': fmBrass({ mod: 0.3, msus: 0.4, r3: 0.5, fx: { cutoff: 1200 } }),
      'Kornett': fmBrass({ mod: 0.4, msus: 0.45, fb: 0.15, fx: { lfoTarget: 'pitch', lfoRate: 5.5, lfoDepth: 0.05 } }),
    },
  },
  {
    name: 'FM-mattor',
    base: { reverbMix: 0.45, reverbSize: 4.5, chorus: 0.4 },
    presets: {
      'FM-matta': fmPad(),
      'Glasmatta FM': fmPad({ r3: 4, mod: 0.35, r4: 3 }),
      'Varm matta FM': fmPad({ mod: 0.15, r2: 0.5, fx: { cutoff: 2500 } }),
      'Svepmatta': fmPad({ matt: 3, mdec: 4, msus: 0.1, mod: 0.5 }),
      'Kristallmatta': fmPad({ r2: 2, r3: 5, r4: 7, mod: 0.2 }),
      'Andningsmatta': fmPad({ fx: { lfoTarget: 'amp', lfoRate: 0.3, lfoDepth: 0.4 } }),
      'Stråkmatta FM': fmPad({ mod: 0.4, fb: 0.3, det: 12 }),
      'Mörk drönare': fmPad({ r2: 0.5, r3: 1.5, mod: 0.3, fx: { cutoff: 1200 } }),
      'Ljusmatta': fmPad({ r2: 2, r3: 4, mod: 0.2, det: 5 }),
      'Rymdmatta FM': fmPad({ r4: 1.41, mod: 0.3, fx: { delayMix: 0.3, delayTime: 0.5, delayFeedback: 0.5 } }),
      'Molnmatta': fmPad({ att: 2, rel: 4, det: 14 }),
      'Vintermatta': fmPad({ r3: 6, l3: 0.25, mod: 0.15, fx: { reverbMix: 0.6, reverbSize: 7 } }),
      'Orgelmatta FM': fmPad({ r2: 2, r3: 4, mod: 0.05 }),
      'Pulserande matta': fmPad({ fx: { lfoTarget: 'filter', lfoRate: 2, lfoDepth: 0.4, cutoff: 3000 } }),
      'Gyllene matta': fmPad({ r2: 1.5, r3: 3, mod: 0.3, det: 10 }),
      'Djup matta': fmPad({ r2: 0.5, r3: 2, mod: 0.2, att: 1.5 }),
    },
  },
  {
    name: 'FM-lead',
    base: { delayMix: 0.15, delayTime: 0.375, delayFeedback: 0.3, reverbMix: 0.2 },
    presets: {
      'Operatorlead': fmLead(),
      'Sågtand FM': fmLead({ fb: 0.85, mod: 0.05, m3: 0.05, m4: 0.4 }),
      'Fyrkant FM': fmLead({ r2: 2, mod: 0.4, m3: 0, m4: 0, fb: 0 }),
      'Flöjtlead': fmLead({ mod: 0.08, m3: 0, m4: 0.03, fb: 0.6, fx: { lfoDepth: 0.08 } }),
      'Vass lead': fmLead({ mod: 0.6, msus: 0.6, fb: 0.7 }),
      'Mjuk lead FM': fmLead({ mod: 0.15, fb: 0.2 }),
      'Kvintlead FM': fmLead({ r2: 1.5, mod: 0.4 }),
      'Synkad lead': fmLead({ r2: 3, mod: 0.5, msus: 0.5, mdec: 0.3 }),
      'Skrikande lead': fmLead({ mod: 0.8, msus: 0.8, fb: 0.9, fx: { drive: 0.3 } }),
      'Visslande lead': fmLead({ mod: 0, m3: 0, m4: 0, fb: 0, fx: { lfoDepth: 0.1 } }),
      'Retrolead FM': fmLead({ r2: 2, mod: 0.45, fb: 0.4, fx: { delayMix: 0.3 } }),
      'Brummlead': fmLead({ r2: 0.5, mod: 0.4, fb: 0.6 }),
      'Glaslead': fmLead({ r2: 4, mod: 0.25, r3: 7, m3: 0.1 }),
      'Klocklead': fmLead({ r2: 3.5, mod: 0.3, mdec: 0.3, msus: 0.15 }),
      'Tunn lead': fmLead({ fx: { filterType: 'highpass', cutoff: 800 } }),
      'Bred lead': fmLead({ det: 12, fx: { chorus: 0.6 } }),
    },
  },
  {
    name: 'FM-orgel',
    base: { reverbMix: 0.3, reverbSize: 2.2, chorus: 0.3 },
    presets: {
      'FM-orgel': fmOrgan(),
      'Jazz-FM': fmOrgan({ r: [1, 2, 3, 4], l: [1, 0.6, 0.5, 0.35], perc: true }),
      'Full orgel': fmOrgan({ r: [0.5, 1, 2, 4], l: [1, 1, 0.8, 0.7], fx: { drive: 0.2 } }),
      'Flöjtorgel': fmOrgan({ r: [1, 2, 4, 8], l: [1, 0.3, 0.15, 0.05] }),
      'Kyrkorgel FM': fmOrgan({ r: [0.5, 1, 1.5, 2], l: [1, 0.8, 0.4, 0.6], fx: { reverbMix: 0.55, reverbSize: 6 } }),
      'Rockorgel FM': fmOrgan({ r: [0.5, 1, 3, 4], l: [0.8, 1, 0.8, 0.6], fx: { drive: 0.45 } }),
      'Mjuk orgel': fmOrgan({ r: [1, 2, 3, 4], l: [1, 0.25, 0.1, 0.05] }),
      'Kvintorgel': fmOrgan({ r: [1, 1.5, 2, 3], l: [1, 0.6, 0.5, 0.4] }),
      'Gospel-FM': fmOrgan({ r: [0.5, 1, 2, 3], l: [0.8, 1, 0.9, 0.7], perc: true, fx: { lfoTarget: 'amp', lfoRate: 6.5, lfoDepth: 0.25 } }),
      'Kammarorgel FM': fmOrgan({ r: [1, 2, 4, 6], l: [1, 0.5, 0.3, 0.15], fx: { reverbMix: 0.2 } }),
      'Harmonium FM': fmOrgan({ algo: 7, r: [1, 2, 1, 2], l: [0.8, 0.4, 0.8, 0.3], fb: 0.3 }),
      'Dragspelsorgel': fmOrgan({ algo: 7, r: [1, 1, 1, 1], l: [0.7, 0.7, 0.7, 0.35], det: 12, fb: 0.2 }),
      'Kalliope': fmOrgan({ r: [1, 2, 3, 5], l: [1, 0.6, 0.4, 0.3], fx: { lfoDepth: 0.1 } }),
      'Pipklang': fmOrgan({ r: [1, 3, 5, 7], l: [1, 0.3, 0.15, 0.08] }),
      'Mörk orgel FM': fmOrgan({ r: [0.5, 1, 1.5, 2], l: [1, 0.6, 0.3, 0.1], fx: { cutoff: 2000 } }),
      'Snurrorgel': fmOrgan({ fx: { lfoTarget: 'amp', lfoRate: 6.8, lfoDepth: 0.35, chorus: 0.6 } }),
    },
  },
  {
    name: 'FM-knäppt',
    base: { reverbMix: 0.25 },
    presets: {
      'Harpa FM': fmPluck({ dec: 3, mod: 0.25, mdec: 0.4, m3: 0.05, fx: { reverbMix: 0.4 } }),
      'Gitarr FM': fmPluck({ dec: 2, mod: 0.45, mdec: 0.2, r3: 2, m3: 0.15, fb: 0.2 }),
      'Klavinett FM': fmPluck({ dec: 0.8, mod: 0.7, mdec: 0.3, m3: 0.3, fb: 0.3, fx: { cutoff: 4000 } }),
      'Cembalo FM': fmPluck({ dec: 1.8, mod: 0.55, r3: 5, m3: 0.3, m4: 0.2, fb: 0.2 }),
      'Koto FM': fmPluck({ dec: 1.5, r2: 2, mod: 0.4, r3: 5, m3: 0.2, fx: { lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 0.04 } }),
      'Pizzicato FM': fmPluck({ dec: 0.5, mod: 0.3, mdec: 0.08 }),
      'Banjo FM': fmPluck({ dec: 1, r2: 3, mod: 0.5, mdec: 0.1, r3: 5, m3: 0.25 }),
      'Mandolin FM': fmPluck({ dec: 1.2, r2: 2, mod: 0.45, fx: { lfoTarget: 'amp', lfoRate: 12, lfoDepth: 0.5 } }),
      'Sitar FM': fmPluck({ dec: 3, mod: 0.6, mdec: 1.5, r3: 7, m3: 0.25, fb: 0.3 }),
      'Plektrum': fmPluck({ dec: 1, mod: 0.6, mdec: 0.05 }),
      'Luta': fmPluck({ dec: 2, mod: 0.3, mdec: 0.3, r3: 2, fx: { cutoff: 3000 } }),
      'Syntplock FM': fmPluck({ dec: 0.6, mod: 0.7, mdec: 0.12, fb: 0.5, fx: { delayMix: 0.3, delayTime: 0.28, delayFeedback: 0.4 } }),
      'Vattendroppe FM': fmPluck({ dec: 0.4, r2: 2, mod: 0.6, mdec: 0.04, fx: { delayMix: 0.3, delayTime: 0.3 } }),
      'Cittra': fmPluck({ dec: 4, mod: 0.3, mdec: 0.6, r3: 4, m3: 0.1, det: 5, fx: { reverbMix: 0.35 } }),
      'Ukulele FM': fmPluck({ dec: 1, mod: 0.35, mdec: 0.15, r3: 2, m3: 0.1 }),
      'Hackbräde': fmPluck({ dec: 2.5, mod: 0.35, mdec: 0.2, r3: 4, m3: 0.2, det: 6 }),
    },
  },
  {
    name: 'FM-träblås',
    base: { reverbMix: 0.3 },
    presets: {
      'Flöjt FM': fmWind(),
      'Altflöjt': fmWind({ mod: 0.08, fx: { cutoff: 3000 } }),
      'Piccolo FM': fmWind({ mod: 0.1, br: 0.08, vib: 0.05 }),
      'Klarinett FM': fmWind({ r2: 2, mod: 0.45, msus: 0.4, br: 0.02 }),
      'Basklarinett': fmWind({ r2: 2, mod: 0.4, msus: 0.35, fx: { cutoff: 2000 } }),
      'Oboe FM': fmWind({ mod: 0.5, msus: 0.45, r3: 3, m3: 0.2, br: 0.02 }),
      'Fagott FM': fmWind({ mod: 0.4, msus: 0.4, m3: 0.2, fx: { cutoff: 1500 } }),
      'Saxofon FM': fmWind({ mod: 0.55, msus: 0.5, br: 0.06, r3: 1, m3: 0.25 }),
      'Panpipa': fmWind({ mod: 0.05, br: 0.12, brs: 0.06, att: 0.08 }),
      'Okarina': fmWind({ mod: 0.03, br: 0.04, vib: 0.03 }),
      'Blockflöjt': fmWind({ r2: 2, mod: 0.1, msus: 0.1, br: 0.05 }),
      'Shakuhachi': fmWind({ mod: 0.12, br: 0.15, brs: 0.08, vib: 0.08, att: 0.15 }),
      'Munspel FM': fmWind({ mod: 0.6, msus: 0.55, m3: 0.3, fx: { lfoTarget: 'amp', lfoRate: 5, lfoDepth: 0.2 } }),
      'Engelskt horn': fmWind({ mod: 0.42, msus: 0.38, m3: 0.1, fx: { cutoff: 2500 } }),
      'Sälgflöjt': fmWind({ r2: 3, mod: 0.02, br: 0.1, vib: 0.02 }),
      'Säckpipa FM': fmWind({ mod: 0.65, msus: 0.6, r3: 3, m3: 0.3, fx: { drive: 0.2, lfoDepth: 0 } }),
    },
  },
  {
    name: 'FM-atmosfär',
    base: { reverbMix: 0.55, reverbSize: 6, delayMix: 0.25, delayTime: 0.5, delayFeedback: 0.5 },
    presets: {
      'Polarnatt': fmAtmo(),
      'Djuprymd': fmAtmo({ r2: 0.5, r3: 1.41, mod: 0.4, fx: { cutoff: 2000 } }),
      'Stjärnfält': fmAtmo({ r2: 7.1, mod: 0.2, r3: 11, m3: 0.1, att: 0.8 }),
      'Nebulosa': fmAtmo({ fb: 0.6, det: 15 }),
      'Havsdjup': fmAtmo({ r2: 0.5, mod: 0.25, att: 2.5, fx: { lfoRate: 0.06, lfoDepth: 0.5, cutoff: 1500 } }),
      'Ödemark': fmAtmo({ r2: 2.76, mod: 0.3, fb: 0.4, det: 6 }),
      'Vinterdimma': fmAtmo({ r2: 3, mod: 0.15, matt: 4, att: 3, rel: 6 }),
      'Drömland': fmAtmo({ algo: 6, r2: 2, mod: 0.2, r3: 3, det: 12, fx: { chorus: 0.5 } }),
      'Tidsvirvel': fmAtmo({ r2: 1.5, mod: 0.5, fx: { lfoTarget: 'pitch', lfoRate: 0.2, lfoDepth: 0.15 } }),
      'Kristallgrotta': fmAtmo({ r2: 5.04, mod: 0.25, r3: 7.1, m3: 0.2, att: 0.5, fx: { delayFeedback: 0.65 } }),
      'Månljus': fmAtmo({ r2: 2, mod: 0.15, m3: 0.05, m4: 0.05, att: 2, det: 6 }),
      'Avlägsen signal': fmAtmo({ r2: 3.5, mod: 0.3, att: 0.3, fx: { filterType: 'bandpass', cutoff: 1500, q: 3, delayMix: 0.45 } }),
      'Metallvind': fmAtmo({ fb: 0.95, m4: 0.4, r4: 1.41, mod: 0.2 }),
      'Sorgsen rymd': fmAtmo({ r2: 1, mod: 0.2, r3: 0.5, det: 4, fx: { cutoff: 2500 } }),
      'Solstorm': fmAtmo({ r2: 1.41, mod: 0.7, msus: 0.6, fb: 0.7, fx: { lfoRate: 0.4, lfoDepth: 0.6 } }),
      'Undervattenskyrka': fmAtmo({ algo: 6, r2: 0.5, r3: 2, mod: 0.15, att: 2, fx: { cutoff: 1200, reverbSize: 9 } }),
    },
  },
  {
    name: 'FM-röster',
    base: { reverbMix: 0.45, reverbSize: 4, chorus: 0.4 },
    presets: {
      'Aah FM': fmVoice({ f1: 3, f2: 5 }),
      'Ooh FM': fmVoice({ f1: 2, l1: 0.3, f2: 3, l2: 0.05, mod: 0.05 }),
      'Eeh FM': fmVoice({ f1: 4, f2: 9, l2: 0.25 }),
      'Mmm': fmVoice({ f1: 2, l1: 0.15, l2: 0, mod: 0.02, att: 0.15 }),
      'Kör FM': fmVoice({ det: 15, fx: { chorus: 0.7 } }),
      'Gosskör': fmVoice({ f1: 4, l1: 0.3, f2: 8, l2: 0.1, mod: 0.05, fx: { reverbMix: 0.6, reverbSize: 6 } }),
      'Mörk kör': fmVoice({ f1: 2, f2: 4, fx: { cutoff: 2000 } }),
      'Viskning': fmVoice({ mod: 0.3, fb: 0.95, l1: 0.2, l2: 0.1 }),
      'Robotröst': fmVoice({ f1: 3, f2: 7, mod: 0.4, det: 0, fx: { lfoDepth: 0 } }),
      'Sirenröst': fmVoice({ fx: { lfoTarget: 'pitch', lfoRate: 0.3, lfoDepth: 0.3 } }),
      'Munkkör': fmVoice({ f1: 2, l1: 0.5, f2: 3, l2: 0.2, fx: { reverbMix: 0.65, reverbSize: 8 } }),
      'Solosopran': fmVoice({ f1: 4, l1: 0.35, det: 2, fx: { lfoDepth: 0.08, chorus: 0.1 } }),
      'Basröst': fmVoice({ f1: 2, f2: 3, mod: 0.15 }),
      'Spökkör': fmVoice({ att: 1, rel: 3, det: 20, fx: { delayMix: 0.3, delayTime: 0.6, delayFeedback: 0.5 } }),
      'Barnkör': fmVoice({ f1: 5, f2: 10, l2: 0.1, det: 12 }),
      'Andlig kör': fmVoice({ att: 0.8, rel: 2.5, det: 12, fx: { reverbMix: 0.7, reverbSize: 9 } }),
    },
  },
  {
    name: 'FM-effekter',
    base: { reverbMix: 0.35, delayMix: 0.2, delayTime: 0.33, delayFeedback: 0.4 },
    presets: {
      'Laser FM': FM(1, [[1, 1, 0.001, 0.4, 0], [3, 0.9, 0.001, 0.15, 0], [7, 0.5, 0.001, 0.1, 0], [1, 0.3, 0.001, 0.2, 0]], { fb: 0.5, rel: 0.2 }),
      'Uppsvep': FM(2, [[1, 1, 0.01, 3, 0.9], [2, 0.8, 2, 3, 0.9], [3.5, 0.2, 1.5, 3, 0.5], [1, 0.2, 2, 3, 0.5]], { rel: 1 }),
      'Nedsvep': FM(2, [[1, 1, 0.001, 2, 0.6], [2, 0.9, 0.001, 1.5, 0], [5, 0.3, 0.001, 1, 0], [1, 0.2, 0.001, 1, 0]], { rel: 1 }),
      'Robot': FM(1, [[1, 1, 0.005, 1, 1], [1.5, 0.6, 0.005, 1, 0.6], [1, 0.2, 0.005, 1, 0.3], [1, 0.1, 0.005, 1, 0.3]], { fb: 0.3, rel: 0.1, lfoTarget: 'amp', lfoRate: 8, lfoDepth: 0.6 }),
      'Ufo': FM(2, [[1, 1, 0.05, 1, 1], [2, 0.4, 0.05, 1, 0.4], [3, 0.1, 0.05, 1, 0.2], [1, 0.1, 0.05, 1, 0.2]], { rel: 0.6, lfoTarget: 'pitch', lfoRate: 7, lfoDepth: 0.5 }),
      'Sonar': FM(5, [[1, 1, 0.001, 2.5, 0], [1, 0.08, 0.001, 0.3, 0], [2, 0, 0.001, 1, 0], [1, 0, 0.001, 1, 0]], { rel: 2, delayMix: 0.5, delayTime: 0.6, delayFeedback: 0.6, reverbMix: 0.5 }),
      'Metallregn': FM(2, [[1, 1, 0.001, 0.6, 0], [7.13, 0.6, 0.001, 0.2, 0], [11.2, 0.3, 0.001, 0.1, 0], [3.3, 0.2, 0.001, 0.1, 0]], { rel: 0.5, delayMix: 0.4, delayFeedback: 0.55 }),
      'Glitch': FM(1, [[1, 1, 0.001, 0.3, 0.5], [2.5, 0.7, 0.001, 0.2, 0.3], [5, 0.4, 0.001, 0.1, 0.2], [1, 0.5, 0.001, 0.2, 0.3]], { fb: 0.8, rel: 0.1, lfoTarget: 'amp', lfoRate: 15, lfoDepth: 0.8 }),
      'Vind FM': FM(3, [[1, 1, 0.5, 2, 0.8], [1, 0, 0.001, 1, 0], [1, 0, 0.001, 1, 0], [1, 1, 0.5, 2, 0.8]], { fb: 1, rel: 1.5, filterType: 'bandpass', cutoff: 1200, q: 2, lfoTarget: 'filter', lfoRate: 0.15, lfoDepth: 0.6 }),
      'Radiosus': FM(3, [[3.7, 1, 0.02, 1, 0.8], [1, 0, 0.001, 1, 0], [1, 0, 0.001, 1, 0], [5.1, 0.8, 0.02, 1, 0.8]], { fb: 0.95, rel: 0.3, filterType: 'bandpass', cutoff: 2500, q: 4 }),
      'Rymddörr': FM(2, [[1, 1, 0.3, 1.5, 0], [0.5, 0.7, 0.5, 1, 0.2], [1.41, 0.4, 0.3, 1, 0], [2.76, 0.3, 0.3, 1, 0]], { rel: 1, reverbMix: 0.5 }),
      'Larm': FM(1, [[1, 1, 0.005, 1, 1], [2, 0.5, 0.005, 1, 0.5], [1, 0, 0.005, 1, 0], [1, 0, 0.005, 1, 0]], { rel: 0.1, lfoTarget: 'pitch', lfoRate: 3, lfoDepth: 0.8 }),
      'Droid': FM(1, [[1, 1, 0.002, 0.5, 0.4], [3.5, 0.5, 0.002, 0.2, 0.2], [1, 0.2, 0.002, 0.2, 0.1], [1, 0.2, 0.002, 0.2, 0.1]], { fb: 0.4, rel: 0.1, lfoTarget: 'pitch', lfoRate: 11, lfoDepth: 0.35 }),
      'Kugghjul': FM(2, [[1, 1, 0.001, 0.2, 0], [5.6, 0.8, 0.001, 0.05, 0], [8.3, 0.4, 0.001, 0.05, 0], [1, 0.3, 0.001, 0.05, 0]], { fb: 0.6, rel: 0.1, lfoTarget: 'amp', lfoRate: 9, lfoDepth: 0.7 }),
      'Bubblor': FM(1, [[1, 1, 0.002, 0.25, 0], [2, 0.5, 0.002, 0.1, 0], [1, 0, 0.002, 0.1, 0], [1, 0, 0.002, 0.1, 0]], { rel: 0.2, lfoTarget: 'pitch', lfoRate: 13, lfoDepth: 0.6, delayMix: 0.35, delayTime: 0.15 }),
      'Svart hål': FM(1, [[0.5, 1, 2, 4, 0.8], [0.5, 0.6, 3, 4, 0.6], [1.41, 0.3, 2, 4, 0.4], [0.5, 0.3, 2, 4, 0.4]], { fb: 0.6, rel: 4, reverbMix: 0.6, reverbSize: 8, cutoff: 1500 }),
    },
  },
  {
    name: 'FM-glas',
    base: { reverbMix: 0.45, reverbSize: 5 },
    presets: {
      'Kristall FM': fmGlass(),
      'Glasharmonika': fmGlass({ att: 0.3, sus: 0.8, dec: 2, r2: 3, mod: 0.1, l3: 0.2, rel: 1.5 }),
      'Isskärva': fmGlass({ dec: 1, r2: 9, mod: 0.35, r3: 5.4, r4: 13 }),
      'Prisma': fmGlass({ r2: 5, mod: 0.25, r3: 3, l3: 0.4, det: 8, fx: { chorus: 0.5 } }),
      'Glastrumma': fmGlass({ dec: 0.8, r2: 2.3, mod: 0.5, mdec: 0.1, r3: 3.7 }),
      'Diamant': fmGlass({ r2: 11, mod: 0.3, r3: 7, l3: 0.3, dec: 4 }),
      'Frostklang': fmGlass({ r2: 4, mod: 0.15, r3: 6, l3: 0.3, fx: { cutoff: 6000 } }),
      'Kvarts': fmGlass({ r2: 3.5, mod: 0.2, r3: 2, l3: 0.5, dec: 5 }),
      'Snöflinga': fmGlass({ dec: 1.5, r2: 8, mod: 0.15, r3: 12, l3: 0.15, fx: { delayMix: 0.3, delayTime: 0.4, delayFeedback: 0.5 } }),
      'Spegelklang': fmGlass({ r2: 2, mod: 0.2, r3: 2.01, l3: 0.5, det: 12 }),
      'Istapp': fmGlass({ dec: 2, r2: 6.3, mod: 0.25, r3: 9.2, l3: 0.2 }),
      'Glaskula': fmGlass({ r2: 1.41, mod: 0.2, r3: 4.24, l3: 0.35, dec: 4 }),
      'Ljusbrytning': fmGlass({ r2: 7, mod: 0.15, r3: 3, l3: 0.3, det: 15, fx: { chorus: 0.6 } }),
      'Kristallregn': fmGlass({ dec: 0.9, r2: 9, mod: 0.3, fx: { delayMix: 0.45, delayTime: 0.2, delayFeedback: 0.6 } }),
      'Porslin': fmGlass({ dec: 1.2, r2: 3.2, mod: 0.35, mdec: 0.15, r3: 5.1, l3: 0.3 }),
      'Safir': fmGlass({ r2: 5.04, mod: 0.2, r3: 2.52, l3: 0.4, dec: 6, rel: 3 }),
    },
  },
  {
    name: 'FM-pop',
    base: { reverbMix: 0.3, chorus: 0.35 },
    presets: {
      'Pop-EP': fmEp({ mod: 0.4, tine: 0.35, r4: 14, dec: 2.5, det: 6, fx: { chorus: 0.45 } }),
      'Syntklav': fmPluck({ dec: 0.7, mod: 0.75, mdec: 0.2, r3: 2, m3: 0.35, fb: 0.4, fx: { chorus: 0.2 } }),
      'Popklocka': fmBell({ mod: 0.5, dec: 2, r3: 4, l3: 0.35, r4: 9, det: 5, fx: { delayMix: 0.25, delayTime: 0.375 } }),
      'Popmarimba': fmMallet({ dec: 0.9, r2: 4, mod: 0.35, r3: 7, l3: 0.2, fx: { delayMix: 0.2, delayTime: 0.25 } }),
      'Ispiano': fmEp({ r2: 3, mod: 0.25, r4: 7, tine: 0.4, tl: 0.6, dec: 3.5, det: 8, fx: { chorus: 0.6, reverbMix: 0.4 } }),
      'Syntpopbas': fmBass({ mod: 0.5, mdec: 0.15, r4: 1, m4: 0.2, m4dec: 0.1, m4sus: 0, fx: { chorus: 0 } }),
      'Popbrass': fmBrass({ mod: 0.6, matt: 0.04, det: 10, rel: 0.15, fx: { chorus: 0.4 } }),
      'Stöt': fmBrass({ mod: 0.7, mdec: 0.1, msus: 0.2, matt: 0.01, att: 0.005, rel: 0.12, fx: { reverbMix: 0.4 } }),
      'Popharpa': fmPluck({ dec: 2.5, mod: 0.3, r2: 2, mdec: 0.3, det: 6, fx: { delayMix: 0.25, delayTime: 0.3, delayFeedback: 0.35 } }),
      'Digital matta': fmPad({ r2: 3, r3: 5, mod: 0.35, det: 10, fx: { chorus: 0.6 } }),
      'Popflöjt': fmWind({ mod: 0.12, br: 0.04, det: 6, fx: { chorus: 0.5, delayMix: 0.2 } }),
      'Plingpiano': fmEp({ r2: 4, mod: 0.15, r4: 9, tine: 0.3, dec: 1.8, fx: { delayMix: 0.25, delayTime: 0.33 } }),
      'Discobas': fmBass({ mod: 0.55, mdec: 0.18, msus: 0.15, r2: 1, m3: 0.2, rel: 0.08, fx: { chorus: 0 } }),
      'Kristall-EP': fmEp({ r2: 2, mod: 0.3, r4: 11, tine: 0.45, tl: 0.55, det: 9, fx: { chorus: 0.55 } }),
      'Syntvox': fmVoice({ f1: 3, f2: 5, mod: 0.25, det: 14, fx: { chorus: 0.6 } }),
      'Arpeggioplock': fmPluck({ dec: 0.45, mod: 0.6, mdec: 0.08, r3: 4, m3: 0.15, fx: { delayMix: 0.35, delayTime: 0.25, delayFeedback: 0.45 } }),
    },
  },
  {
    name: 'FM-slagverk',
    base: { reverbMix: 0.15, reverbSize: 1.5 },
    presets: {
      'Bastrumma FM': FM(1, [[1, 1, 0.001, 0.35, 0], [1, 0.6, 0.001, 0.04, 0], [1, 0, 0.001, 0.1, 0], [1, 0, 0.001, 0.1, 0]], { rel: 0.2 }),
      'Tomtrumma FM': FM(1, [[1, 1, 0.001, 0.6, 0], [1.5, 0.3, 0.001, 0.08, 0], [1, 0, 0.001, 0.1, 0], [1, 0, 0.001, 0.1, 0]], { rel: 0.4 }),
      'Virvel FM': FM(5, [[1, 0.8, 0.001, 0.15, 0], [1.5, 0.3, 0.001, 0.03, 0], [1, 0.8, 0.001, 0.2, 0], [3.7, 1, 0.001, 0.2, 0]], { fb: 1, rel: 0.2 }),
      'Hi-hat FM': FM(2, [[3.3, 1, 0.001, 0.08, 0], [7.13, 0.9, 0.001, 0.08, 0], [11.1, 0.9, 0.001, 0.08, 0], [13.7, 0.9, 0.001, 0.08, 0]], { fb: 0.8, rel: 0.08, filterType: 'highpass', cutoff: 5000 }),
      'Öppen hi-hat': FM(2, [[3.3, 1, 0.001, 0.5, 0], [7.13, 0.9, 0.001, 0.5, 0], [11.1, 0.9, 0.001, 0.5, 0], [13.7, 0.9, 0.001, 0.5, 0]], { fb: 0.8, rel: 0.4, filterType: 'highpass', cutoff: 5000 }),
      'Cymbal FM': FM(2, [[3.3, 1, 0.001, 2.5, 0], [7.13, 0.9, 0.001, 2.5, 0], [11.1, 0.9, 0.001, 2, 0], [13.7, 0.9, 0.001, 2, 0]], { fb: 0.85, rel: 2, filterType: 'highpass', cutoff: 3500, reverbMix: 0.3 }),
      'Koskälla': FM(5, [[1, 1, 0.001, 0.35, 0], [2, 0.15, 0.001, 0.05, 0], [1.48, 0.9, 0.001, 0.3, 0], [2.96, 0.15, 0.001, 0.05, 0]], { rel: 0.3 }),
      'Träkloss': FM(1, [[1, 1, 0.001, 0.08, 0], [2.3, 0.4, 0.001, 0.02, 0], [1, 0, 0.001, 0.1, 0], [1, 0, 0.001, 0.1, 0]], { rel: 0.08 }),
      'Bongo FM': FM(1, [[1, 1, 0.001, 0.18, 0], [1.6, 0.3, 0.001, 0.03, 0], [1, 0, 0.001, 0.1, 0], [1, 0, 0.001, 0.1, 0]], { rel: 0.15 }),
      'Conga FM': FM(1, [[1, 1, 0.001, 0.35, 0], [1.5, 0.25, 0.001, 0.04, 0], [1, 0, 0.001, 0.1, 0], [1, 0, 0.001, 0.1, 0]], { rel: 0.3 }),
      'Tabla FM': FM(5, [[1, 1, 0.001, 0.6, 0], [1, 0.2, 0.001, 0.08, 0], [2.9, 0.35, 0.001, 0.4, 0], [1, 0.1, 0.001, 0.05, 0]], { rel: 0.5 }),
      'Puka FM': FM(5, [[1, 1, 0.001, 2, 0], [1.5, 0.25, 0.001, 0.15, 0], [2, 0.3, 0.001, 1.2, 0], [1, 0.1, 0.001, 0.1, 0]], { rel: 1.5, reverbMix: 0.35, reverbSize: 3 }),
      'Gong FM': FM(2, [[1, 1, 0.01, 6, 0], [1.41, 0.7, 0.3, 5, 0.2], [2.76, 0.4, 0.5, 5, 0.2], [0.5, 0.3, 0.2, 5, 0.1]], { rel: 5, reverbMix: 0.5, reverbSize: 6 }),
      'Kastanjett': FM(1, [[1, 1, 0.001, 0.05, 0], [4.7, 0.5, 0.001, 0.02, 0], [1, 0, 0.001, 0.1, 0], [1, 0, 0.001, 0.1, 0]], { rel: 0.05 }),
      'Shaker FM': FM(3, [[6, 1, 0.02, 0.12, 0], [1, 0, 0.001, 0.1, 0], [1, 0, 0.001, 0.1, 0], [7.3, 1, 0.001, 0.12, 0]], { fb: 1, rel: 0.1, filterType: 'highpass', cutoff: 3000 }),
      'Triangel FM': FM(5, [[1, 1, 0.001, 3, 0], [5.4, 0.1, 0.001, 1, 0], [2.76, 0.3, 0.001, 2, 0], [8.9, 0.1, 0.001, 0.5, 0]], { rel: 2, reverbMix: 0.35 }),
    },
  },
];
