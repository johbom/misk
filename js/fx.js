// Ljudeffekter för sidan Toner: uppsättningar som väljs som trumset (Disco, Reggae & dub, Tecknat & lek).
// Varje ruta spelar en hel effekt (sirén, lufthorn, laser, boing …) som klingar ut av sig själv.
// Allt syntetiseras med samma byggstenar som trummorna (js/drums.js) – inga ljudfiler.
// Laddas efter js/drums.js och lägger till nya ljud i DRUM_VOICES och nya set i DRUM_KITS.
// MIDI: rutorna skickar 36, 37, 38 … (C1 och uppåt), som på en vanlig padkontroller.

// Volymkurva med flera stötar: [[start, längd], …] i sekunder från t
function fxBursts(ctx, t, v, bursts, attack = 0.01, release = 0.06) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  bursts.forEach(([s, len]) => {
    const a = t + s;
    g.gain.setValueAtTime(0, a);
    g.gain.linearRampToValueAtTime(v, a + attack);
    g.gain.setValueAtTime(v, a + Math.max(attack, len - release));
    g.gain.linearRampToValueAtTime(0, a + len);
  });
  return g;
}

// Lågfrekvent svängning in i en parameter (t.ex. detune i cent)
function fxLfo(ctx, t, dur, rate, depth, target, shape = 'sine') {
  const l = dOsc(ctx, shape, rate, t, dur);
  const g = ctx.createGain();
  g.gain.value = depth;
  l.connect(g).connect(target);
  return { osc: l, gain: g };
}

const FX_VOICES = {
  // Tonhöjd som glider från f0 till f1 (laser, syntrumma, glidflöjt, hopp …), en eller flera gånger
  sweep(ctx, out, t, v, p) {
    const n = p.n || 1;
    const dur = p.dur;
    let end = t;
    for (let i = 0; i < n; i++) {
      const at = t + i * (p.gap || dur);
      const k = (p.step || 1) ** i * (p.rand ? 1 + (Math.random() - 0.5) * p.rand : 1);
      const o = dOsc(ctx, p.type || 'sine', p.f0 * k, at, dur + (p.tail || 0));
      if (p.lin) o.frequency.linearRampToValueAtTime(p.f1 * k, at + dur);
      else o.frequency.exponentialRampToValueAtTime(p.f1 * k, at + dur);
      if (p.vib) fxLfo(ctx, at, dur + (p.tail || 0), p.vib[0], p.vib[1], o.detune);
      const amp = v * (p.fade || 1) ** i;
      const g = dEnv(ctx, at, amp, dur + (p.tail || 0), p.attack || 0.004);
      let src = o;
      if (p.lp) { const f = dFilt(ctx, 'lowpass', p.lp); o.connect(f); src = f; }
      src.connect(g).connect(out);
      if (p.noise) {
        dNoise(ctx, at, 0.03).connect(dFilt(ctx, 'bandpass', p.noiseHz || 2000, 1))
          .connect(dEnv(ctx, at, amp * p.noise, 0.025)).connect(out);
      }
      end = Math.max(end, at + dur + (p.tail || 0));
    }
    return end;
  },

  // Dubsirén: en oscillator vars tonhöjd svänger (sinus = ylande, fyrkant = två toner, sågtand = stigande)
  siren(ctx, out, t, v, p) {
    const dur = p.dur;
    const o = dOsc(ctx, p.type || 'square', p.f, t, dur);
    if (p.rise) o.detune.linearRampToValueAtTime(p.rise, t + dur);
    const lfo = fxLfo(ctx, t, dur, p.rate, p.depth, o.detune, p.shape || 'sine');
    if (p.rateTo) lfo.osc.frequency.exponentialRampToValueAtTime(p.rateTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.02);
    g.gain.setValueAtTime(v, t + dur - 0.15);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(dFilt(ctx, 'lowpass', p.lp || 3000, 0.8)).connect(g).connect(out);
    return t + dur;
  },

  // Lufthorn och tuta: flera sågtänder (ett ackord) i stötar, genom ett filter och lite distorsion
  horn(ctx, out, t, v, p) {
    const bursts = p.bursts;
    const dur = Math.max(...bursts.map(([s, l]) => s + l));
    const g = fxBursts(ctx, t, v, bursts, 0.015, 0.05);
    const f = dFilt(ctx, p.filter || 'bandpass', p.bp || 1100, p.q || 0.7);
    f.connect(dDrive(ctx, p.drive ?? 0.4)).connect(g).connect(out);
    (p.chord || [1, 1.26, 1.5]).forEach((r, i) => {
      const o = dOsc(ctx, p.type || 'sawtooth', p.f * r, t, dur);
      o.detune.value = (i - 1) * (p.detune ?? 6);
      // Varje stöt börjar lite lågt och glider upp (som när luften får fart)
      bursts.forEach(([s]) => {
        o.frequency.setValueAtTime(p.f * r * (p.scoop || 0.94), t + s);
        o.frequency.exponentialRampToValueAtTime(p.f * r, t + s + 0.06);
      });
      o.connect(f);
    });
    return t + dur;
  },

  // Brus genom ett filter som sveper (uppsvep, nedsvep, explosion, skott, åska, vind)
  whoosh(ctx, out, t, v, p) {
    const dur = p.dur;
    const f = dFilt(ctx, p.filter || 'bandpass', p.f0, p.q || 1);
    f.frequency.exponentialRampToValueAtTime(p.f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + (p.attack || 0.005));
    if (p.hold) g.gain.setValueAtTime(v, t + p.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    dNoise(ctx, t, dur).connect(f).connect(g).connect(out);
    if (p.rumble) fxLfo(ctx, t, dur, p.rumble[0], p.rumble[1] * v, g.gain, 'triangle');
    if (p.boom) {
      const [f0, f1, decay, lvl] = p.boom;
      const o = dOsc(ctx, 'sine', f0, t, decay);
      o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.6);
      o.connect(dEnv(ctx, t, v * lvl, decay, 0.003)).connect(out);
    }
    return t + dur;
  },

  // Visselpipa: hög ton med en kula som skallrar (snabb svängning) och lite luft, i stötar
  whistle(ctx, out, t, v, p) {
    const bursts = p.bursts;
    const dur = Math.max(...bursts.map(([s, l]) => s + l));
    const g = fxBursts(ctx, t, v, bursts, 0.01, 0.03);
    const o = dOsc(ctx, 'sine', p.f, t, dur);
    const trill = ctx.createGain();
    trill.gain.value = 0.75;
    fxLfo(ctx, t, dur, p.trill || 32, 0.25, trill.gain, 'square');
    fxLfo(ctx, t, dur, p.trill || 32, p.wobble ?? 60, o.detune, 'square');
    o.connect(trill).connect(g);
    dNoise(ctx, t, dur).connect(dFilt(ctx, 'bandpass', p.f, 3)).connect(dEnv(ctx, t, 0.35, dur)).connect(g);
    g.connect(out);
    return t + dur;
  },

  // Orkesterslag: ett ackord av sågtänder som slår till och klingar av, med filter som stängs
  stab(ctx, out, t, v, p) {
    const decay = p.decay || 0.7;
    const f = dFilt(ctx, 'lowpass', p.lp0 || 6000, 1);
    f.frequency.exponentialRampToValueAtTime(p.lp1 || 900, t + decay);
    const g = dEnv(ctx, t, v, decay, 0.004);
    f.connect(g).connect(out);
    (p.chord || [1, 1.5, 2, 2.52, 3]).forEach((r, i) => {
      const o = dOsc(ctx, 'sawtooth', p.f * r, t, decay);
      o.detune.value = (i % 2 ? 1 : -1) * 7;
      o.connect(f);
    });
    dNoise(ctx, t, 0.06).connect(dFilt(ctx, 'bandpass', 2500, 0.8)).connect(dEnv(ctx, t, v * 0.6, 0.05)).connect(out);
    return t + decay;
  },

  // Boing: en ton som studsar i tonhöjd (svängningen dör ut) och glider lite uppåt
  boing(ctx, out, t, v, p) {
    const dur = p.dur || 0.9;
    const o = dOsc(ctx, p.type || 'triangle', p.f, t, dur);
    o.frequency.exponentialRampToValueAtTime(p.f * (p.rise || 1.5), t + dur);
    const lfo = fxLfo(ctx, t, dur, p.rate || 14, p.depth || 900, o.detune);
    lfo.gain.gain.setValueAtTime(p.depth || 900, t);
    lfo.gain.gain.exponentialRampToValueAtTime(20, t + dur);
    o.connect(dEnv(ctx, t, v, dur, 0.003)).connect(out);
    return t + dur;
  },

  // En följd av korta toner: mynt, kraft, dörrklocka, ta-da, xylofonrusch
  seq(ctx, out, t, v, p) {
    let end = t;
    p.notes.forEach(([s, f, len, lvl = 1]) => {
      const at = t + s;
      const decay = len ?? p.decay ?? 0.15;
      const g = dEnv(ctx, at, v * lvl, decay, 0.003);
      (p.partials || [1]).forEach((r, i) => {
        const o = dOsc(ctx, p.type || 'square', f * r, at, decay);
        if (i) { const pg = ctx.createGain(); pg.gain.value = 0.35 / i; o.connect(pg).connect(g); } else o.connect(g);
      });
      let dst = out;
      if (p.lp) { const lp = dFilt(ctx, 'lowpass', p.lp); lp.connect(out); dst = lp; }
      g.connect(dst);
      end = Math.max(end, at + decay);
    });
    return end;
  },

  // Flera ljud efter varandra (fallande bomb, ba-dum-tss): [[start, ljud, inställningar, nivå], …]
  combo(ctx, out, t, v, p) {
    let end = t;
    p.hits.forEach(([s, voice, q, lvl = 1]) => {
      end = Math.max(end, (FX_VOICES[voice] || DRUM_VOICES[voice])(ctx, out, t + s, v * lvl, q));
    });
    return end;
  },

  // Applåder: många handklapp på slumpade ställen, som växer och klingar av
  applause(ctx, out, t, v, p) {
    const dur = p.dur || 2.4;
    const n = Math.round(dur * (p.density || 40));
    for (let i = 0; i < n; i++) {
      const at = t + Math.random() * dur * 0.9;
      const swell = Math.sin(Math.PI * Math.min(1, (at - t) / dur)) ** 0.6;
      dNoise(ctx, at, 0.05).connect(dFilt(ctx, 'bandpass', 900 + Math.random() * 1800, 1.4))
        .connect(dEnv(ctx, at, v * (0.5 + Math.random() * 0.5) * swell, 0.03 + Math.random() * 0.03, 0.002)).connect(out);
    }
    return t + dur;
  },

  // Skivskrap: en ton och brus vars hastighet går fram och tillbaka (som när skivan dras med handen)
  scratch(ctx, out, t, v, p) {
    const moves = p.moves; // [[tid, hastighet], …]
    const dur = moves[moves.length - 1][0];
    const base = p.f || 160;
    const o = dOsc(ctx, 'sawtooth', base, t, dur);
    const bp = dFilt(ctx, 'bandpass', 1200, 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    o.frequency.setValueAtTime(base * 0.2, t);
    bp.frequency.setValueAtTime(400, t);
    moves.forEach(([s, r]) => {
      const a = Math.abs(r);
      o.frequency.linearRampToValueAtTime(Math.max(20, base * a), t + s);
      bp.frequency.linearRampToValueAtTime(400 + 1600 * a, t + s);
      g.gain.linearRampToValueAtTime(v * Math.min(1, a), t + s);
    });
    const n = ctx.createGain();
    n.gain.value = 0.5;
    dNoise(ctx, t, dur).connect(n).connect(bp);
    o.connect(bp).connect(g).connect(out);
    return t + dur;
  },

  // Tillbakaspolning: ackord som rusar uppåt i tonhöjd och hackar allt snabbare
  rewind(ctx, out, t, v, p) {
    const dur = p.dur || 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.setValueAtTime(v, t + dur * 0.75);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const lfo = fxLfo(ctx, t, dur, 6, 0.5, chop.gain, 'square');
    lfo.osc.frequency.exponentialRampToValueAtTime(28, t + dur);
    const f = dFilt(ctx, 'lowpass', 1500, 1);
    f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    [1, 1.5, 2].forEach((r) => {
      const o = dOsc(ctx, 'sawtooth', (p.f || 110) * r, t, dur);
      o.frequency.exponentialRampToValueAtTime((p.f || 110) * r * 9, t + dur);
      o.connect(f);
    });
    dNoise(ctx, t, dur).connect(dFilt(ctx, 'highpass', 3000)).connect(f);
    f.connect(chop).connect(g).connect(out);
    return t + dur;
  },

  // Fjäderkrasch: som när man stöter till förstärkarens fjäderreverb – droppande "pjong"-ljud som klingar av
  spring(ctx, out, t, v, p) {
    const n = p.n || 14;
    const period = p.period || 0.038;
    for (let i = 0; i < n; i++) {
      const at = t + i * period;
      const amp = v * 0.9 ** i;
      const o = dOsc(ctx, 'sine', p.f0 || 3200, at, 0.05);
      o.frequency.exponentialRampToValueAtTime(p.f1 || 500, at + 0.035);
      o.connect(dEnv(ctx, at, amp, 0.04, 0.001)).connect(out);
    }
    dNoise(ctx, t, 0.4).connect(dFilt(ctx, 'bandpass', 1300, 2)).connect(dEnv(ctx, t, v * 0.7, 0.35)).connect(out);
    return t + n * period + 0.05;
  },
};
Object.assign(DRUM_VOICES, FX_VOICES);

// Sätts ihop som trumseten: [MIDI-nummer, namn, ljud, inställningar, nivå]. Nivåerna är uppmätta (högsta
// korta ljudstyrka i nivå med trumsetens virvel).
const fxKit = (name, opts, pieces) => ({
  name, fx: true, ...opts, pieces: pieces.map(([n, voice, p, lvl = 1], i) => [36 + i, n, voice, p, lvl]),
});

Object.assign(DRUM_KITS, {
  disco: fxKit('Disco', { room: 0.25, roomSize: 1.6, echo: { time: 0.3, fb: 0.3, mix: 0.18, lp: 3000 } }, [
    ['Syntrumma', 'sweep', { f0: 900, f1: 110, dur: 0.45, noise: 0.25 }, 0.64],
    ['Hög syntrumma', 'sweep', { f0: 1500, f1: 260, dur: 0.32, noise: 0.25 }, 0.72],
    ['Syntrumvirvel', 'sweep', { f0: 1300, f1: 300, dur: 0.16, n: 5, gap: 0.09, step: 0.82, noise: 0.2 }, 0.95],
    ['Laser', 'sweep', { type: 'square', f0: 2600, f1: 140, dur: 0.3, lp: 5000 }, 0.61],
    ['Dubbellaser', 'sweep', { type: 'square', f0: 2200, f1: 180, dur: 0.18, n: 2, gap: 0.16, lp: 5000 }, 0.75],
    ['Disco-visselpipa', 'whistle', { f: 2900, bursts: [[0, 0.32], [0.42, 0.12], [0.6, 0.12]] }, 0.38],
    ['Sirén', 'siren', { type: 'sawtooth', f: 620, rate: 0.9, depth: 700, dur: 2.2, lp: 2800 }, 0.46],
    ['Orkesterslag', 'stab', { f: 196, decay: 0.8 }, 0.32],
    ['Stor handklapp', 'clap', { decay: 0.4, f: 1200 }, 2.1],
    ['Öppen hihat', 'hat', { decay: 0.5, metal: 0.4, noise: 0.6, hp: 7000, open: true }, 1.26],
    ['Tamburin', 'tambourine', { decay: 0.3 }, 0.83],
    ['Koskälla', 'cowbell', { f: 587, bp: 2600, decay: 0.38 }, 0.64],
    ['Uppsvep', 'whoosh', { f0: 300, f1: 9000, dur: 1.6, attack: 1.4, q: 3 }, 1.21],
    ['Nedsvep', 'whoosh', { f0: 9000, f1: 200, dur: 1.2, attack: 0.02, hold: 0.5, q: 3 }, 1.08],
    ['Rymdbubbla', 'sweep', { f0: 300, f1: 1500, dur: 0.9, vib: [9, 500], tail: 0.3 }, 0.38],
    ['Glitterregn', 'seq', {
      type: 'sine', partials: [1, 2.76], notes: [[0, 2093, 0.4], [0.07, 2637, 0.4, 0.9], [0.14, 3136, 0.4, 0.8],
        [0.21, 3520, 0.4, 0.7], [0.28, 4186, 0.5, 0.6], [0.35, 3136, 0.4, 0.5], [0.42, 4699, 0.6, 0.5]],
    }, 0.47],
  ]),

  dub: fxKit('Reggae & dub', { room: 0.3, roomSize: 2.2, echo: { time: 0.375, fb: 0.55, mix: 0.45, lp: 2200 } }, [
    ['Dubsirén', 'siren', { type: 'square', f: 440, rate: 0.7, depth: 1000, dur: 2.4, lp: 2400 }, 0.26],
    ['Snabb dubsirén', 'siren', { type: 'square', f: 600, rate: 9, depth: 500, dur: 1.4, lp: 2600 }, 0.26],
    ['Stigande sirén', 'siren', { type: 'square', f: 330, rate: 2.5, depth: 1200, shape: 'sawtooth', rise: 1200, dur: 2, lp: 2600 }, 0.26],
    ['Sirénpip', 'sweep', { type: 'square', f0: 500, f1: 1500, dur: 0.12, n: 4, gap: 0.19, step: 1.12, lp: 3000 }, 0.89],
    ['Lufthorn', 'horn', { f: 466, bursts: [[0, 0.16], [0.22, 0.16], [0.44, 0.7]] }, 0.23],
    ['Långt lufthorn', 'horn', { f: 415, bursts: [[0, 1.4]] }, 0.23],
    ['Skott', 'whoosh', { filter: 'lowpass', f0: 7000, f1: 500, dur: 0.35, boom: [140, 45, 0.3, 0.9] }, 0.7],
    ['Bomb', 'whoosh', { filter: 'lowpass', f0: 3500, f1: 60, dur: 2.2, attack: 0.01, boom: [90, 30, 1.2, 1], rumble: [11, 0.25] }, 0.35],
    ['Fallande bomb', 'combo', { hits: [
      [0, 'sweep', { f0: 2400, f1: 500, dur: 1.4, attack: 0.05 }, 0.45],
      [1.4, 'whoosh', { filter: 'lowpass', f0: 3500, f1: 60, dur: 2, boom: [90, 30, 1.2, 1], rumble: [11, 0.25] }],
    ] }, 0.38],
    ['Dubvirvel', 'snare', { tone: 190, toneDecay: 0.12, body: 0.5, noiseHz: 1800, noiseDecay: 0.22, snappy: 0.85 }, 1.6],
    ['Kantslag', 'rim', { f: 1600, f2: 420 }, 1.1],
    ['Fjäderkrasch', 'spring', { n: 16 }, 1.4],
    ['Tillbakaspolning', 'rewind', { dur: 1.1 }, 0.23],
    ['Skivskrap', 'scratch', { moves: [[0.06, 2.2], [0.14, 0.1], [0.22, 2], [0.3, 0.1], [0.36, 2.6], [0.5, 0]] }, 1.72],
    ['Visselpipa', 'whistle', { f: 3100, bursts: [[0, 0.7]] }, 0.38],
    ['Åska', 'whoosh', { filter: 'lowpass', f0: 1200, f1: 90, dur: 3, attack: 0.05, rumble: [7, 0.4], boom: [70, 35, 2, 0.6] }, 0.58],
  ]),

  cartoon: fxKit('Tecknat & lek', { room: 0.15, roomSize: 1 }, [
    ['Boing', 'boing', { f: 180, dur: 0.9 }, 0.66],
    ['Glidflöjt upp', 'sweep', { f0: 500, f1: 2000, dur: 0.6, lin: true, vib: [6, 25], attack: 0.03 }, 0.41],
    ['Glidflöjt ner', 'sweep', { f0: 2000, f1: 450, dur: 0.6, lin: true, vib: [6, 25], attack: 0.03 }, 0.41],
    ['Busvissling', 'combo', { hits: [
      [0, 'sweep', { f0: 900, f1: 2600, dur: 0.22, attack: 0.02 }],
      [0.28, 'sweep', { f0: 1700, f1: 600, dur: 0.45, attack: 0.02 }],
    ] }, 0.44],
    ['Plopp', 'sweep', { f0: 320, f1: 1400, dur: 0.04, tail: 0.04, noise: 0.5, noiseHz: 1500 }, 1.26],
    ['Cykeltuta', 'horn', { f: 400, chord: [1, 1.01], type: 'square', bp: 900, q: 3, drive: 0.2, scoop: 1.05,
      bursts: [[0, 0.14], [0.22, 0.2]] }, 0.29],
    ['Bubblor', 'sweep', { f0: 350, f1: 1300, dur: 0.05, n: 7, gap: 0.07, rand: 0.6, attack: 0.002 }, 1.62],
    ['Mynt', 'seq', { notes: [[0, 988, 0.08], [0.08, 1319, 0.35]], lp: 6000 }, 0.58],
    ['Hopp', 'sweep', { type: 'square', f0: 300, f1: 900, dur: 0.18, lp: 4000 }, 0.75],
    ['Kraft', 'seq', { notes: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i * 0.055, 392 * 2 ** (i / 6), 0.07]), lp: 6000 }, 1.14],
    ['Dörrklocka', 'seq', { type: 'sine', partials: [1, 2.4, 4.1], notes: [[0, 659, 0.9], [0.45, 523, 1.4]] }, 0.35],
    ['Ta-da', 'seq', { type: 'sawtooth', lp: 3000, notes: [[0, 523, 0.12, 0.8], [0.14, 523, 0.12, 0.8],
      [0.28, 659, 0.9], [0.28, 784, 0.9, 0.8], [0.28, 1047, 0.9, 0.7]] }, 0.54],
    ['Applåd', 'applause', { dur: 2.4, density: 45 }, 2.11],
    ['Xylofonrusch', 'seq', { type: 'sine', partials: [1, 3.9], notes: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16].map((s, i) =>
      [i * 0.045, 523 * 2 ** (s / 12), 0.25]) }, 0.64],
    ['Ba-dum-tss', 'combo', { hits: [
      [0, 'snare', { tone: 200, toneDecay: 0.1, body: 0.5, noiseHz: 2000, noiseDecay: 0.15, snappy: 0.7 }, 0.9],
      [0.22, 'tom', { f: 110, decay: 0.3, skin: 0.2 }],
      [0.42, 'cymbal', { decay: 1.4, hp: 5000, metal: 0.4, noise: 0.8, base: 65 }, 0.6],
    ] }, 0.75],
    ['Smäll', 'whoosh', { filter: 'lowpass', f0: 5000, f1: 200, dur: 0.6, boom: [110, 40, 0.5, 0.8] }, 0.66],
  ]),
});

// Ekot (dub) läggs på i trumsetets buss (js/drums.js), som här: en fördröjning med återkoppling
// och mörkare repetitioner för varje varv.
function fxEcho(ctx, from, to, e) {
  const send = ctx.createGain();
  send.gain.value = e.mix;
  const d = ctx.createDelay(2);
  d.delayTime.value = e.time;
  const fb = ctx.createGain();
  fb.gain.value = e.fb;
  const lp = dFilt(ctx, 'lowpass', e.lp || 2500);
  from.connect(send).connect(d).connect(lp);
  lp.connect(fb).connect(d);
  lp.connect(to);
}
