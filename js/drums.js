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

const drumKitOn = () => ui.drumKit.value in DRUM_KITS;
const DRUM_SHOT_MS = 400; // One-shot: hur länge rutan lyser
const DRUM_LEVEL = 0.75; // trummornas nivå jämfört med syntens toner

// En trumma i trumsetet för ruta i (rutorna går runt om de är fler än trummorna)
function drumPiece(kitId, i) {
  const kit = DRUM_KITS[kitId];
  const [gm, name, voice, p, lvl] = kit.pieces[i % kit.pieces.length];
  return { gm, name, voice, p, lvl, kit: kitId };
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
