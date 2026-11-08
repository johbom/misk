// Trumset för sidan Toner: varje ruta spelar ett trumljud i stället för en ton.
// Allt syntetiseras (oscillatorer, brus och filter) – inga ljudfiler behövs.
// Varje trumljud har ett General MIDI-nummer, så MIDI ut träffar rätt trumma i en trumsampler
// (GM-trummor ligger oftast på kanal 10).

// ---------- Byggstenar ----------
let drumNoiseBuf = null;
function drumNoise(ctx) {
  if (drumNoiseBuf && drumNoiseBuf.ctx === ctx) return drumNoiseBuf.buf;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  drumNoiseBuf = { ctx, buf };
  return buf;
}

function dNoise(ctx, t, dur) {
  const s = ctx.createBufferSource();
  s.buffer = drumNoise(ctx);
  s.loop = true;
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
  return s;
}

function dOsc(ctx, type, f, t, dur) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

// Volymkurva: snabbt anslag, exponentiell avklingning till tyst på `decay` sekunder
function dEnv(ctx, t, peak, decay, attack = 0.001) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function dFilt(ctx, type, f, q = 0.7) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

function dDrive(ctx, amount) {
  const s = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  const k = amount * 20;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * (1 + k)) / Math.tanh(1 + k);
  }
  s.curve = curve;
  return s;
}

// Metallklang som i 808/909: sex fyrkantsvågor med ojämna förhållanden
const METAL_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21];
function dMetal(ctx, t, dur, base, out) {
  const mix = ctx.createGain();
  mix.gain.value = 0.25;
  METAL_RATIOS.forEach((r) => dOsc(ctx, 'square', base * r, t, dur).connect(mix));
  mix.connect(out);
}

// Öppen hihat tystas av stängd hihat och hihatpedal (som på ett riktigt trumset)
const drumChoke = new Map();
function dChoke(group, t, g) {
  const prev = drumChoke.get(group);
  if (prev && prev !== g) {
    try {
      prev.gain.cancelScheduledValues(t);
      prev.gain.setTargetAtTime(0, t, 0.012);
    } catch {}
  }
  if (g) drumChoke.set(group, g);
}

// ---------- Trumljuden ----------
// Varje funktion får (ctx, out, t, v = nivå, p = inställningar) och returnerar när ljudet är slut.
const DRUM_VOICES = {
  kick(ctx, out, t, v, p) {
    const o = dOsc(ctx, 'sine', p.f0, t, p.decay);
    o.frequency.exponentialRampToValueAtTime(p.f1, t + p.sweep);
    const g = dEnv(ctx, t, v, p.decay, 0.002);
    if (p.drive) o.connect(dDrive(ctx, p.drive)).connect(g);
    else o.connect(g);
    g.connect(out);
    if (p.click) {
      const c = dNoise(ctx, t, 0.02);
      c.connect(dFilt(ctx, 'highpass', p.clickHz || 3000)).connect(dEnv(ctx, t, v * p.click, 0.012)).connect(out);
    }
    return t + p.decay;
  },

  snare(ctx, out, t, v, p) {
    const o = dOsc(ctx, 'triangle', p.tone * 1.5, t, p.toneDecay);
    o.frequency.exponentialRampToValueAtTime(p.tone, t + 0.03);
    o.connect(dEnv(ctx, t, v * p.body, p.toneDecay)).connect(out);
    if (p.tone2) {
      dOsc(ctx, 'sine', p.tone2, t, p.toneDecay).connect(dEnv(ctx, t, v * p.body * 0.6, p.toneDecay * 0.8)).connect(out);
    }
    const n = dNoise(ctx, t, p.noiseDecay);
    n.connect(dFilt(ctx, 'highpass', p.noiseHz)).connect(dFilt(ctx, 'lowpass', p.noiseTop || 12000))
      .connect(dEnv(ctx, t, v * p.snappy, p.noiseDecay)).connect(out);
    return t + Math.max(p.toneDecay, p.noiseDecay);
  },

  hat(ctx, out, t, v, p) {
    const g = dEnv(ctx, t, v, p.decay);
    const hp = dFilt(ctx, 'highpass', p.hp || 7000);
    hp.connect(g).connect(out);
    if (p.metal) {
      const bp = dFilt(ctx, 'bandpass', 10000, 0.6);
      const m = ctx.createGain();
      m.gain.value = p.metal;
      dMetal(ctx, t, p.decay, p.base || 40, bp);
      bp.connect(m).connect(hp);
    }
    if (p.noise) {
      const m = ctx.createGain();
      m.gain.value = p.noise;
      dNoise(ctx, t, p.decay).connect(m).connect(hp);
    }
    dChoke('hat', t, p.open ? g : null);
    return t + p.decay;
  },

  clap(ctx, out, t, v, p) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    // Tre snabba smällar och sedan en svans (flera händer som inte klappar exakt samtidigt)
    [0, 0.011, 0.022].forEach((dt) => {
      g.gain.setValueAtTime(v, t + dt);
      g.gain.exponentialRampToValueAtTime(v * 0.15, t + dt + 0.009);
    });
    g.gain.setValueAtTime(v * 0.8, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.033 + p.decay);
    dNoise(ctx, t, p.decay + 0.05).connect(dFilt(ctx, 'bandpass', p.f || 1100, 1.1)).connect(g).connect(out);
    return t + 0.04 + p.decay;
  },

  tom(ctx, out, t, v, p) {
    const o = dOsc(ctx, 'sine', p.f * (p.bend || 1.6), t, p.decay);
    o.frequency.exponentialRampToValueAtTime(p.f, t + (p.sweep || 0.08));
    o.connect(dEnv(ctx, t, v, p.decay, 0.002)).connect(out);
    if (p.skin) {
      dNoise(ctx, t, 0.06).connect(dFilt(ctx, 'lowpass', 2500)).connect(dEnv(ctx, t, v * p.skin, 0.05)).connect(out);
    }
    return t + p.decay;
  },

  cymbal(ctx, out, t, v, p) {
    const g = dEnv(ctx, t, v, p.decay, 0.002);
    const hp = dFilt(ctx, 'highpass', p.hp || 5000);
    hp.connect(g).connect(out);
    const m = ctx.createGain();
    m.gain.value = p.metal ?? 0.5;
    dMetal(ctx, t, p.decay, p.base || 60, m);
    m.connect(hp);
    const n = ctx.createGain();
    n.gain.value = p.noise ?? 0.6;
    dNoise(ctx, t, p.decay).connect(n).connect(hp);
    if (p.bell) {
      [p.bellF || 760, (p.bellF || 760) * 1.5].forEach((f) =>
        dOsc(ctx, 'sine', f, t, p.decay).connect(dEnv(ctx, t, v * p.bell, p.decay * 0.7)).connect(out));
    }
    return t + p.decay;
  },

  rim(ctx, out, t, v, p) {
    dOsc(ctx, 'triangle', p.f || 1700, t, 0.04).connect(dEnv(ctx, t, v, 0.035)).connect(out);
    dOsc(ctx, 'sine', p.f2 || 455, t, 0.05).connect(dEnv(ctx, t, v * 0.6, 0.045)).connect(out);
    dNoise(ctx, t, 0.02).connect(dFilt(ctx, 'highpass', 4000)).connect(dEnv(ctx, t, v * 0.5, 0.012)).connect(out);
    return t + 0.06;
  },

  cowbell(ctx, out, t, v, p) {
    const bp = dFilt(ctx, 'bandpass', p.bp || 1400, 1.2);
    const g = dEnv(ctx, t, v, p.decay || 0.35);
    [p.f || 587, (p.f || 587) * 1.44].forEach((f) => dOsc(ctx, 'square', f, t, p.decay || 0.35).connect(bp));
    bp.connect(g).connect(out);
    return t + (p.decay || 0.35);
  },

  // Korta, tonade träljud: claves och träblock
  wood(ctx, out, t, v, p) {
    dOsc(ctx, 'sine', p.f, t, p.decay).connect(dEnv(ctx, t, v, p.decay)).connect(out);
    if (p.knock) {
      dOsc(ctx, 'triangle', p.f * 2.3, t, p.decay).connect(dFilt(ctx, 'bandpass', p.f * 2.3, 4))
        .connect(dEnv(ctx, t, v * p.knock, p.decay * 0.6)).connect(out);
    }
    return t + p.decay;
  },

  // Brusljud: shaker, maracas, cabasa
  shaker(ctx, out, t, v, p) {
    dNoise(ctx, t, p.decay + 0.03).connect(dFilt(ctx, 'highpass', p.hp || 5500))
      .connect(dEnv(ctx, t, v, p.decay, p.attack || 0.012)).connect(out);
    return t + p.decay + 0.03;
  },

  tambourine(ctx, out, t, v, p) {
    const g = dEnv(ctx, t, v, p.decay || 0.3, 0.003);
    const hp = dFilt(ctx, 'highpass', 6500);
    hp.connect(g).connect(out);
    dMetal(ctx, t, p.decay || 0.3, 180, hp);
    dNoise(ctx, t, p.decay || 0.3).connect(hp);
    return t + (p.decay || 0.3);
  },

  // Handtrummor: conga, bongo (tonhöjd som sjunker lite, och en smäll av handen)
  hand(ctx, out, t, v, p) {
    const o = dOsc(ctx, 'sine', p.f * 1.15, t, p.decay);
    o.frequency.exponentialRampToValueAtTime(p.f, t + 0.025);
    o.connect(dEnv(ctx, t, v, p.decay, 0.002)).connect(out);
    dNoise(ctx, t, 0.03).connect(dFilt(ctx, 'bandpass', p.slapHz || 1800, 1.5))
      .connect(dEnv(ctx, t, v * (p.slap ?? 0.4), 0.025)).connect(out);
    return t + p.decay;
  },

  timbale(ctx, out, t, v, p) {
    const o = dOsc(ctx, 'triangle', p.f * 1.1, t, p.decay);
    o.frequency.exponentialRampToValueAtTime(p.f, t + 0.02);
    o.connect(dEnv(ctx, t, v * 0.8, p.decay)).connect(out);
    dOsc(ctx, 'sine', p.f * 2.32, t, p.decay).connect(dEnv(ctx, t, v * 0.3, p.decay * 0.8)).connect(out);
    dNoise(ctx, t, 0.08).connect(dFilt(ctx, 'bandpass', 3200, 1)).connect(dEnv(ctx, t, v * 0.5, 0.07)).connect(out);
    return t + p.decay;
  },

  // Metallklockor: agogo och triangel
  bell(ctx, out, t, v, p) {
    (p.partials || [1, 2.7]).forEach((r, i) =>
      dOsc(ctx, 'sine', p.f * r, t, p.decay).connect(dEnv(ctx, t, v / (1 + i * 0.8), p.decay * (1 - i * 0.2))).connect(out));
    return t + p.decay;
  },

  guiro(ctx, out, t, v, p) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    const n = p.ticks || 12;
    const len = p.len || 0.28;
    for (let i = 0; i < n; i++) {
      const at = t + (i * len) / n;
      g.gain.setValueAtTime(v, at);
      g.gain.exponentialRampToValueAtTime(v * 0.05, at + (len / n) * 0.8);
    }
    g.gain.setValueAtTime(0, t + len + 0.01);
    dNoise(ctx, t, len + 0.05).connect(dFilt(ctx, 'bandpass', p.f || 2600, 2)).connect(g).connect(out);
    return t + len + 0.02;
  },
};

// ---------- Trumseten ----------
// [GM-nummer, namn, ljud, inställningar, nivå]. Ordningen är rutornas ordning.
// Nivåerna är uppmätta så att bastrumma och virvel ligger i nivå med syntens toner, och hihat,
// cymbaler och smått slagverk lite under.
const DRUM_KITS = {
  acoustic: {
    name: 'Akustiskt', room: 0.2, roomSize: 1.1,
    pieces: [
      [36, 'Bastrumma', 'kick', { f0: 110, f1: 50, sweep: 0.07, decay: 0.42, click: 0.35, clickHz: 2500 }, 2.279],
      [38, 'Virvel', 'snare', { tone: 185, toneDecay: 0.13, body: 0.55, noiseHz: 1800, noiseTop: 9000, noiseDecay: 0.24, snappy: 0.75 }, 1.791],
      [42, 'Hihat', 'hat', { decay: 0.07, metal: 0.4, noise: 0.6, hp: 7500 }, 2.706],
      [46, 'Öppen hihat', 'hat', { decay: 0.55, metal: 0.4, noise: 0.6, hp: 7000, open: true }, 1.261],
      [41, 'Golvtom', 'tom', { f: 80, decay: 0.65, skin: 0.25 }, 1.257],
      [45, 'Låg tom', 'tom', { f: 110, decay: 0.55, skin: 0.25 }, 1.346],
      [48, 'Hög tom', 'tom', { f: 160, decay: 0.45, skin: 0.25 }, 1.546],
      [49, 'Crash', 'cymbal', { decay: 1.9, hp: 4500, metal: 0.35, noise: 0.8, base: 70 }, 0.392],
      [51, 'Ride', 'cymbal', { decay: 1.3, hp: 6000, metal: 0.5, noise: 0.35, base: 80, bell: 0.08, bellF: 900 }, 0.821],
      [37, 'Kantslag', 'rim', { f: 1600, f2: 420 }, 1.093],
      [44, 'Hihatpedal', 'hat', { decay: 0.045, metal: 0.4, noise: 0.5, hp: 6500 }, 2.219],
      [54, 'Tamburin', 'tambourine', { decay: 0.3 }, 0.831],
      [39, 'Handklapp', 'clap', { decay: 0.2, f: 1100 }, 2.483],
      [56, 'Koskälla', 'cowbell', { f: 560, bp: 1300, decay: 0.3 }, 0.665],
      [55, 'Splash', 'cymbal', { decay: 0.8, hp: 6500, metal: 0.4, noise: 0.7, base: 90 }, 0.851],
      [53, 'Ride-klocka', 'cymbal', { decay: 1.1, hp: 7000, metal: 0.3, noise: 0.15, base: 85, bell: 0.35, bellF: 820 }, 0.675],
    ],
  },
  e808: {
    name: '808', room: 0.05, roomSize: 0.8,
    pieces: [
      [36, 'Bastrumma', 'kick', { f0: 150, f1: 46, sweep: 0.05, decay: 1.2, click: 0.08 }, 1.209],
      [38, 'Virvel', 'snare', { tone: 238, tone2: 476, toneDecay: 0.12, body: 0.6, noiseHz: 2000, noiseDecay: 0.17, snappy: 0.6 }, 2.123],
      [42, 'Hihat', 'hat', { decay: 0.05, metal: 1, noise: 0, hp: 7000 }, 6.688],
      [46, 'Öppen hihat', 'hat', { decay: 0.42, metal: 1, noise: 0, hp: 7000, open: true }, 2.785],
      [39, 'Handklapp', 'clap', { decay: 0.24, f: 1000 }, 2.098],
      [45, 'Låg tom', 'tom', { f: 85, bend: 1.3, sweep: 0.2, decay: 0.55 }, 1.379],
      [47, 'Mellantom', 'tom', { f: 125, bend: 1.3, sweep: 0.2, decay: 0.45 }, 1.585],
      [50, 'Hög tom', 'tom', { f: 175, bend: 1.3, sweep: 0.2, decay: 0.38 }, 1.72],
      [56, 'Koskälla', 'cowbell', { f: 587, bp: 2600, decay: 0.38 }, 0.638],
      [49, 'Cymbal', 'cymbal', { decay: 1.3, hp: 5500, metal: 0.9, noise: 0.2, base: 40 }, 1.193],
      [37, 'Kantslag', 'rim', { f: 1700, f2: 455 }, 1.245],
      [75, 'Claves', 'wood', { f: 2500, decay: 0.07 }, 1.519],
      [70, 'Maracas', 'shaker', { decay: 0.05, hp: 7500, attack: 0.004 }, 1.409],
      [64, 'Låg conga', 'hand', { f: 165, decay: 0.32, slap: 0 }, 1.697],
      [63, 'Mellanconga', 'hand', { f: 250, decay: 0.26, slap: 0 }, 1.851],
      [62, 'Hög conga', 'hand', { f: 370, decay: 0.2, slap: 0 }, 1.968],
    ],
  },
  e909: {
    name: '909', room: 0.08, roomSize: 0.9,
    pieces: [
      [36, 'Bastrumma', 'kick', { f0: 260, f1: 52, sweep: 0.035, decay: 0.5, click: 0.6, clickHz: 4000, drive: 0.25 }, 2.079],
      [38, 'Virvel', 'snare', { tone: 200, toneDecay: 0.1, body: 0.5, noiseHz: 2500, noiseDecay: 0.26, snappy: 0.95 }, 1.56],
      [42, 'Hihat', 'hat', { decay: 0.06, metal: 0.3, noise: 0.9, hp: 8000 }, 1.664],
      [46, 'Öppen hihat', 'hat', { decay: 0.38, metal: 0.3, noise: 0.9, hp: 7500, open: true }, 1.055],
      [39, 'Handklapp', 'clap', { decay: 0.18, f: 1300 }, 2.526],
      [45, 'Låg tom', 'tom', { f: 95, bend: 1.8, sweep: 0.06, decay: 0.45, skin: 0.15 }, 1.554],
      [47, 'Mellantom', 'tom', { f: 135, bend: 1.8, sweep: 0.06, decay: 0.38, skin: 0.15 }, 1.719],
      [50, 'Hög tom', 'tom', { f: 190, bend: 1.8, sweep: 0.06, decay: 0.32, skin: 0.15 }, 1.885],
      [49, 'Crash', 'cymbal', { decay: 1.6, hp: 5000, metal: 0.4, noise: 0.8, base: 65 }, 0.443],
      [51, 'Ride', 'cymbal', { decay: 1.1, hp: 6500, metal: 0.6, noise: 0.3, base: 75, bell: 0.06 }, 1.002],
      [37, 'Kantslag', 'rim', { f: 1900, f2: 500 }, 1.015],
      [35, 'Bastrumma 2', 'kick', { f0: 200, f1: 44, sweep: 0.06, decay: 0.8, click: 0.3, drive: 0.5 }, 1.516],
      [40, 'Virvel 2', 'snare', { tone: 230, toneDecay: 0.08, body: 0.35, noiseHz: 3500, noiseDecay: 0.18, snappy: 1 }, 1.818],
      [54, 'Tamburin', 'tambourine', { decay: 0.25 }, 0.841],
      [82, 'Shaker', 'shaker', { decay: 0.09, hp: 6000 }, 0.712],
      [56, 'Koskälla', 'cowbell', { f: 600, bp: 2200, decay: 0.25 }, 0.763],
    ],
  },
  lofi: {
    name: 'Lo-fi', room: 0.12, roomSize: 0.7, lowpass: 3600, crush: 5, drive: 0.3,
    pieces: [
      [36, 'Bastrumma', 'kick', { f0: 120, f1: 52, sweep: 0.06, decay: 0.35, click: 0.2, clickHz: 1500 }, 0.585],
      [38, 'Virvel', 'snare', { tone: 175, toneDecay: 0.12, body: 0.6, noiseHz: 1200, noiseTop: 6000, noiseDecay: 0.2, snappy: 0.7 }, 0.649],
      [42, 'Hihat', 'hat', { decay: 0.05, metal: 0.3, noise: 0.7, hp: 5000 }, 0.991],
      [46, 'Öppen hihat', 'hat', { decay: 0.3, metal: 0.3, noise: 0.7, hp: 5000, open: true }, 0.435],
      [37, 'Kantslag', 'rim', { f: 1300, f2: 380 }, 0.53],
      [39, 'Handklapp', 'clap', { decay: 0.16, f: 900 }, 0.492],
      [45, 'Låg tom', 'tom', { f: 100, decay: 0.4, skin: 0.3 }, 0.303],
      [50, 'Hög tom', 'tom', { f: 150, decay: 0.32, skin: 0.3 }, 0.363],
      [51, 'Ride', 'cymbal', { decay: 0.9, hp: 4000, metal: 0.4, noise: 0.4, base: 70 }, 0.227],
      [82, 'Shaker', 'shaker', { decay: 0.08, hp: 3500 }, 0.204],
      [75, 'Claves', 'wood', { f: 1800, decay: 0.06 }, 0.386],
      [76, 'Träblock', 'wood', { f: 900, decay: 0.08, knock: 0.4 }, 0.372],
      [35, 'Dov bastrumma', 'kick', { f0: 90, f1: 42, sweep: 0.08, decay: 0.5, click: 0.1 }, 0.441],
      [40, 'Snärt', 'snare', { tone: 220, toneDecay: 0.06, body: 0.3, noiseHz: 1800, noiseTop: 5000, noiseDecay: 0.1, snappy: 0.9 }, 0.926],
      [54, 'Tamburin', 'tambourine', { decay: 0.2 }, 0.519],
      [49, 'Crash', 'cymbal', { decay: 1.2, hp: 3500, metal: 0.3, noise: 0.8, base: 70 }, 0.113],
    ],
  },
  latin: {
    name: 'Slagverk', room: 0.18, roomSize: 1.2,
    pieces: [
      [64, 'Låg conga', 'hand', { f: 180, decay: 0.38, slap: 0.35, slapHz: 1500 }, 1.537],
      [63, 'Hög conga', 'hand', { f: 260, decay: 0.3, slap: 0.4, slapHz: 1800 }, 1.766],
      [62, 'Dämpad conga', 'hand', { f: 270, decay: 0.07, slap: 0.8, slapHz: 2200 }, 1.759],
      [61, 'Låg bongo', 'hand', { f: 330, decay: 0.2, slap: 0.4, slapHz: 2400 }, 1.838],
      [60, 'Hög bongo', 'hand', { f: 450, decay: 0.15, slap: 0.4, slapHz: 2800 }, 1.933],
      [66, 'Låg timbal', 'timbale', { f: 380, decay: 0.35 }, 1.381],
      [65, 'Hög timbal', 'timbale', { f: 520, decay: 0.3 }, 1.405],
      [56, 'Koskälla', 'cowbell', { f: 560, bp: 1200, decay: 0.28 }, 0.681],
      [68, 'Låg agogo', 'bell', { f: 660, decay: 0.45, partials: [1, 2.7, 5.1] }, 0.484],
      [67, 'Hög agogo', 'bell', { f: 880, decay: 0.4, partials: [1, 2.7, 5.1] }, 0.527],
      [75, 'Claves', 'wood', { f: 2500, decay: 0.06 }, 1.523],
      [77, 'Låg träblock', 'wood', { f: 800, decay: 0.09, knock: 0.5 }, 1.192],
      [76, 'Högt träblock', 'wood', { f: 1150, decay: 0.08, knock: 0.5 }, 1.162],
      [82, 'Shaker', 'shaker', { decay: 0.1, hp: 5500, attack: 0.02 }, 0.568],
      [73, 'Guiro', 'guiro', { f: 2600, len: 0.28, ticks: 12 }, 0.511],
      [81, 'Triangel', 'bell', { f: 4600, decay: 1.4, partials: [1, 1.5, 1.96] }, 0.183],
    ],
  },
};

// ---------- Uppspelning ----------
// Varje trumset har en egen buss: (lo-fi-filter) -> volym, plus lite egen rumsklang.
// Trummorna går förbi syntens effekter (eko och klang hör till rutornas ljud, inte till trummorna).
const drumBuses = new Map();

function drumBus(kitId) {
  const ctx = audioCtx;
  const cached = drumBuses.get(kitId);
  if (cached && cached.ctx === ctx) return cached.input;
  const kit = DRUM_KITS[kitId];
  const input = ctx.createGain();
  let last = input;
  if (kit.drive) { const d = dDrive(ctx, kit.drive); last.connect(d); last = d; }
  if (kit.crush) {
    // Färre nivåer = grövre, "samplat" ljud
    const s = ctx.createWaveShaper();
    const steps = 2 ** kit.crush;
    s.curve = Float32Array.from({ length: 4096 }, (_, i) => Math.round(((i / 4095) * 2 - 1) * steps) / steps);
    last.connect(s);
    last = s;
  }
  if (kit.lowpass) { const f = dFilt(ctx, 'lowpass', kit.lowpass, 0.9); last.connect(f); last = f; }
  last.connect(engine.volume);
  if (kit.room) {
    const send = ctx.createGain();
    send.gain.value = kit.room;
    const rev = ctx.createConvolver();
    rev.buffer = engine.makeImpulse(kit.roomSize || 1);
    last.connect(send).connect(rev).connect(engine.volume);
  }
  drumBuses.set(kitId, { ctx, input });
  return input;
}

const drumKitOn = () => ui.notesKind.value === 'drums' && ui.drumKit.value in DRUM_KITS;
const DRUM_SHOT_MS = 400; // One-shot: hur länge rutan lyser
const DRUM_LEVEL = 0.75; // trummornas nivå jämfört med syntens toner

// En trumma i trumsetet för ruta i (rutorna går runt om de är fler än trummorna)
function drumPiece(kitId, i) {
  const kit = DRUM_KITS[kitId];
  const [gm, name, voice, p, lvl] = kit.pieces[i % kit.pieces.length];
  const piece = { gm, name, voice, p, lvl, kit: kitId };
  piece.icon = drumIcon(piece);
  return piece;
}

// Slår an en trumma. Returnerar en stoppfunktion (gör inget – trummor klingar ut av sig själva),
// med cancel() för arpeggiatorns retrigg.
function drumHit(piece, when = 0, level = 1) {
  const ctx = audioCtx;
  const t = Math.max(ctx.currentTime + NOTE_LOOKAHEAD, when);
  const out = ctx.createGain();
  out.connect(drumBus(piece.kit));
  const end = DRUM_VOICES[piece.voice](ctx, out, t, DRUM_LEVEL * level * piece.lvl, piece.p);
  setTimeout(() => { try { out.disconnect(); } catch {} }, (end - ctx.currentTime + 0.4) * 1000);
  const stop = () => {};
  stop.cancel = () => {
    if (ctx.currentTime >= t) return false;
    try { out.disconnect(); } catch {}
    return true;
  };
  return stop;
}

// ---------- Symboler ----------
// De vanligaste trumljuden visas med en symbol i stället för namn (namnet finns kvar som
// beskrivning för skärmläsare och när pekaren vilar på rutan). Storleken skiljer låg/hög tom och conga.
const drumSvg = (body) =>
  `<svg class="drum-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

// Trumma från sidan: övre skinnet som ellips, kroppen nedåt (bottnen på y = bottom)
function drumSide(cx, bottom, w, h, extra = '') {
  const rx = w / 2;
  const ry = Math.max(1.2, w * 0.15);
  const top = bottom - h;
  return `<ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}"/>`
    + `<path d="M${cx - rx} ${top}v${h}a${rx} ${ry} 0 0 0 ${2 * rx} 0v-${h}"/>${extra}`;
}

// Conga: hög tunna som smalnar av nedåt
function conga(r, muted = false) {
  const cx = 12;
  return `<ellipse cx="${cx}" cy="4.5" rx="${r}" ry="1.6"${muted ? ' fill="currentColor"' : ''}/>`
    + `<path d="M${cx - r} 4.5C${cx - r - 1.8} 11 ${cx - r + 0.6} 16.5 ${cx - r * 0.65} 21.5H${cx + r * 0.65}C${cx + r - 0.6} 16.5 ${cx + r + 1.8} 11 ${cx + r} 4.5"/>`;
}

// Bongo: två små trummor ihop; den som spelas har fyllt skinn
function bongos(low) {
  const f = ' fill="currentColor"';
  return `<ellipse cx="7.5" cy="9" rx="5" ry="1.6"${low ? f : ''}/><path d="M2.5 9v7a5 1.6 0 0 0 10 0V9"/>`
    + `<ellipse cx="17.5" cy="10.5" rx="4" ry="1.4"${low ? '' : f}/><path d="M13.5 10.5v5.5a4 1.4 0 0 0 8 0v-5.5"/><path d="M12.5 13h1"/>`;
}

// Cymbal på stativ
function cymbal(rx, opts = {}) {
  const bell = opts.bell ? '<ellipse cx="12" cy="5.6" rx="2.6" ry="2" fill="currentColor"/>' : '<path d="M10.6 6.6a1.4 1 0 0 1 2.8 0"/>';
  const sparks = opts.sparks ? '<path d="M3 2.5l1.4 1.8M21 2.5l-1.4 1.8M12 1v1.6"/>' : '';
  return `<path d="M12 8v13M8.5 21.5h7"/><ellipse cx="12" cy="7.2" rx="${rx}" ry="1.9"/>${bell}${sparks}`;
}

// Hihat: två cymbaler på stativ (tätt = stängd, isär = öppen), pedal = med fotplatta
function hihat(open, pedal = false) {
  const top = open ? 3 : 6.2;
  const plates = `<ellipse cx="12" cy="${top}" rx="8.5" ry="1.4"/><ellipse cx="12" cy="8.4" rx="8.5" ry="1.4"/>`;
  const foot = pedal ? '<path d="M12 21.5l5-2.5" stroke-width="2.4"/><path d="M7 21.5h6"/>' : '<path d="M8.5 21.5h7"/>';
  return `<path d="M12 ${top}V21.5"/>${plates}${foot}`;
}

const DRUM_ICONS = {
  kick: '<circle cx="12" cy="11.5" r="8.5"/><circle cx="12" cy="11.5" r="3.2"/><path d="M5.5 18.5l-2 3.5M18.5 18.5l2 3.5"/>',
  snare: drumSide(12, 18, 18, 5.5, '<path d="M5 2.5l5.5 6M19 2.5l-5.5 6"/><path d="M5 15.5l2 1.2 2-1.2 2 1.2 2-1.2 2 1.2 2-1.2 2 1.2" stroke-width="1.2"/>'),
  rim: drumSide(12, 19, 18, 6, '<path d="M2.5 13.5L21.5 7" stroke-width="2.4"/>'),
  tomFloor: drumSide(12, 18.5, 17, 11, '<path d="M4.5 18.5l-1.5 3.5M19.5 18.5l1.5 3.5"/>'),
  tomLow: drumSide(12, 20, 17, 9),
  tomMid: drumSide(12, 20, 13.5, 7.5),
  tomHigh: drumSide(12, 20, 10, 6),
  hatClosed: hihat(false),
  hatOpen: hihat(true),
  hatPedal: hihat(false, true),
  crash: cymbal(10, { sparks: true }),
  splash: cymbal(6, { sparks: true }),
  ride: cymbal(10.5),
  rideBell: cymbal(10.5, { bell: true }),
  clap: '<rect x="4.5" y="7" width="6" height="13" rx="3" transform="rotate(-18 7.5 13.5)"/><rect x="13.5" y="7" width="6" height="13" rx="3" transform="rotate(18 16.5 13.5)"/><path d="M12 1.5v3M6.8 3l1.2 2M17.2 3l-1.2 2"/>',
  cowbell: '<path d="M8.5 7.5h7l3 13h-13z"/><path d="M10.5 7.5V4h3v3.5"/><path d="M8 13.5h8" opacity=".5"/>',
  tambourine: `<circle cx="12" cy="12" r="7.5"/>${[0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    return `<circle cx="${(12 + 7.5 * Math.cos(a)).toFixed(1)}" cy="${(12 + 7.5 * Math.sin(a)).toFixed(1)}" r="1.7" fill="currentColor"/>`;
  }).join('')}`,
  maracas: '<ellipse cx="8" cy="7.5" rx="3.6" ry="4.8" transform="rotate(-18 8 7.5)"/><path d="M9.6 12l2 9.5"/><ellipse cx="16.5" cy="7.5" rx="3.6" ry="4.8" transform="rotate(18 16.5 7.5)"/><path d="M14.9 12l-2 9.5"/>',
  shaker: '<rect x="8" y="3" width="8" height="18" rx="4" transform="rotate(30 12 12)"/><path d="M10.8 9.5h.01M13 12h.01M11 14.5h.01M13.4 8.4h.01" stroke-width="2.4"/><path d="M19.5 3.5l1.5-1M21 7l1.5-.3M3 17l-1.5.3M4.5 20.5l-1.5 1"/>',
  claves: '<path d="M3.5 17.5L17 6" stroke-width="2.8"/><path d="M7 5.5l13.5 11.5" stroke-width="2.8"/>',
  woodblock: '<rect x="3" y="8.5" width="18" height="8.5" rx="2"/><path d="M6 12.7h12"/><path d="M14 2.5l-3 5" stroke-width="2.2"/>',
  triangle: '<path d="M10.5 5L3.5 19.5h15.5L12.3 6.8"/><path d="M15.5 11.5l6-6" stroke-width="2"/><path d="M10.5 5l1-2"/>',
  congaLow: conga(6.2),
  congaMid: conga(5.4),
  congaHigh: conga(4.6),
  congaMute: conga(5, true),
  bongoLow: bongos(true),
  bongoHigh: bongos(false),
};

// GM-nummer -> symbol (de vanligaste; övriga visar namnet)
const DRUM_ICON_FOR = {
  35: 'kick', 36: 'kick', 37: 'rim', 38: 'snare', 40: 'snare', 39: 'clap',
  41: 'tomFloor', 43: 'tomFloor', 45: 'tomLow', 47: 'tomMid', 48: 'tomMid', 50: 'tomHigh',
  42: 'hatClosed', 44: 'hatPedal', 46: 'hatOpen',
  49: 'crash', 57: 'crash', 55: 'splash', 51: 'ride', 59: 'ride', 53: 'rideBell',
  54: 'tambourine', 56: 'cowbell', 70: 'maracas', 69: 'shaker', 82: 'shaker',
  75: 'claves', 76: 'woodblock', 77: 'woodblock', 81: 'triangle',
  64: 'congaLow', 63: 'congaHigh', 62: 'congaMute', 61: 'bongoLow', 60: 'bongoHigh',
};

function drumIcon(piece) {
  // 808:s tre congas: låg, mellan, hög
  let id = DRUM_ICON_FOR[piece.gm];
  if (piece.name === 'Mellanconga') id = 'congaMid';
  if (piece.name === 'Hög conga' && piece.kit === 'e808') id = 'congaHigh';
  return id ? drumSvg(DRUM_ICONS[id]) : '';
}
