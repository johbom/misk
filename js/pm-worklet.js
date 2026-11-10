// Ljudmotorer som körs i ljudtråden (AudioWorklet):
//   pm-string – en sträng (utökad Karplus–Strong)
//   pm-modal  – en resonanskropp (marimba, glas, klocka …): en bank av exakta resonatorer
//   fm4       – FM-motorn: fyra sinusoperatorer med egna kurvor, åtta algoritmer och återkoppling
//   wavetable – vågtabellmotorn
//   voice     – Röst: formantsyntes (vokaler, röstlägen, kör)
//   wind      – Blås: klarinett (fysisk modell) och flöjt (ton + luft i ett resonansrör)
//   grain     – Granulär: korn ur kör, stråkar, glas och naturljud
// Strängens återkopplingsslinga är kortare än vad vanliga Web Audio-noder klarar (128 sampel), och
// webbläsarnas inbyggda filter klipper av långa efterklanger – därför räknas båda här.
//
// En fördröjningslinje lika lång som en svängningsperiod = strängen. Varje varv dämpas den lite
// (decay) och mjukas upp av ett lågpassfilter (brightness) – diskanten dör fortare än grundtonen,
// precis som på en riktig sträng. Strängen sätts i gång på tre sätt:
//   pluck  – knäppt: en kort brusstöt, filtrerad efter hur hårt/ljust man knäpper
//   hammer – slagen: en mjuk puls (som en pianohammare)
//   bow    – stråke: svagt brus matas in hela tiden medan tonen hålls, så att den klingar kvar
// Anslagspunkten (pos) tar bort de deltoner som har nod där man knäpper (nära stallet = tunnare klang).

class PmString extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 10, maxValue: 8000, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' }, // cent, för vibrato
    ];
  }

  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.start = o.start || 0; // ctx-tid då tonen börjar
    this.decay = Math.max(0.05, o.decay || 3); // T60 i sekunder
    this.bright = Math.min(1, Math.max(0, o.bright ?? 0.6));
    this.pos = Math.min(0.5, Math.max(0.02, o.pos ?? 0.2));
    this.exciter = o.exciter || 'pluck';
    this.level = o.level ?? 1;
    this.buf = new Float32Array(4096); // räcker ned till ca 12 Hz
    this.w = 0; // skrivposition
    this.lp = 0; // lågpassfiltrets minne
    this.dc = [0, 0]; // DC-spärr
    this.exc = null; // excitation som matas in i början
    this.excPos = 0;
    this.releaseAt = Infinity;
    this.quiet = 0; // hur länge det varit tyst efter släpp
    this.bowLp = 0;
    this.bowGain = 36; // stråkens styrka (kalibrerad så att den låter lika starkt som knäppt)
    this.seed = 12345;
    this.end = Infinity; // då rösten är helt slut (efter släppets uttoning)
    this.port.onmessage = (e) => {
      if (e.data.release !== undefined) this.releaseAt = e.data.release;
      if (e.data.end !== undefined) this.end = e.data.end;
    };
  }

  rand() { // snabb, deterministisk slump (-1..1)
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 2147483648 - 1;
  }

  // Bygger excitationen när tonen börjar (längden beror på tonhöjden)
  makeExcitation(period) {
    const n = Math.max(2, Math.round(period));
    const e = new Float32Array(n);
    if (this.exciter === 'hammer') {
      // Mjuk puls; hårdare/ljusare = kortare
      const w = Math.max(2, Math.round(n * (0.5 - 0.42 * this.bright)));
      for (let i = 0; i < w; i++) e[i] = Math.sin((Math.PI * i) / w) ** 2;
    } else if (this.exciter === 'pluck') {
      // Brus, lågpassat efter ljushet
      const a = 0.15 + 0.85 * this.bright;
      let y = 0;
      for (let i = 0; i < n; i++) { y += a * (this.rand() - y); e[i] = y; }
    }
    // Anslagspunkt: kamfilter (deltoner med nod vid anslagspunkten försvinner)
    const d = Math.max(1, Math.round(this.pos * n));
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = e[i] - (i >= d ? e[i - d] : 0);
    // Normalisera så att alla lägen blir lika starka
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 0) for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
    return out;
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    if (!out) return true;
    const t0 = currentTime;
    const freq = parameters.frequency[0] * Math.pow(2, parameters.detune[0] / 1200);
    // Lågpass i slingan: ljusare = mindre dämpning av diskanten
    const a = 0.08 + 0.9 * this.bright;
    // Varvlängd i sampel (med decimaler). Lågpasset fördröjer också ca (1−a)/a sampel, vilket
    // annars gör strängen "längre" och tonen för låg – dra av det.
    const period = Math.max(2, sampleRate / freq - (1 - a) / a);
    // Förluster per varv: ger T60 = decay för grundtonen
    const g = Math.pow(10, -3 / (this.decay * freq));
    const N = this.buf.length;
    let peak = 0;

    for (let i = 0; i < out.length; i++) {
      const t = t0 + i / sampleRate;
      if (t < this.start) { out[i] = 0; continue; }
      if (!this.exc && this.exciter !== 'bow') this.exc = this.makeExcitation(period);

      // Läs strängen ett varv bakåt (linjär interpolation för exakt tonhöjd)
      const rp = this.w - period + N * 2;
      const i0 = Math.floor(rp) % N;
      const frac = rp - Math.floor(rp);
      const delayed = this.buf[i0] * (1 - frac) + this.buf[(i0 + 1) % N] * frac;

      // Dämpning och lågpass i slingan
      this.lp += a * (delayed - this.lp);
      let x = this.lp * g;

      // Excitation
      if (this.exc && this.excPos < this.exc.length) x += this.exc[this.excPos++];
      if (this.exciter === 'bow' && t < this.releaseAt) {
        // Stråke: friktionsbrus, lite mjukare ju mörkare
        this.bowLp += (0.05 + 0.5 * this.bright) * (this.rand() - this.bowLp);
        x += this.bowLp * this.bowGain * (1 - g + 0.002);
      }
      // Håll strängen stabil
      if (x > 4) x = 4; else if (x < -4) x = -4;
      this.buf[this.w] = x;
      this.w = (this.w + 1) % N;

      // DC-spärr på utgången
      const y = x - this.dc[0] + 0.995 * this.dc[1];
      this.dc[0] = x;
      this.dc[1] = y;
      out[i] = y * 1.4 * this.level;
      const ay = Math.abs(y);
      if (ay > peak) peak = ay;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);

    // Avsluta när tonen är släppt och har tystnat (sparar processorkraft)
    if (t0 > this.end) return false;
    // Tyst i 0,1 s (efter anslaget, och inte medan stråken drar) = klar
    if (this.excPos > 0 || this.exciter === 'bow') {
      const bowing = this.exciter === 'bow' && t0 < this.releaseAt;
      this.quiet = !bowing && peak < 1e-5 ? this.quiet + out.length : 0;
      if (this.quiet > sampleRate * 0.1) return false;
    }
    return true;
  }
}

registerProcessor('pm-string', PmString);

// Resonanskropp: varje delton är en tvåpolig resonator  y = 2r·cos(w)·y1 − r²·y2 + x.
// r ger klingtiden (T60) och w frekvensen; insignalen skalas med sin(w) så att varje delton ringer
// med exakt sin styrka. Anslaget är en kort puls – hårdare klubba = kortare puls = ljusare klang.
class PmModal extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 10, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.start = o.start || 0;
    this.ratios = o.ratios || [1];
    this.amps = o.amps || [1];
    this.t60s = o.t60s || [1];
    const len = Math.max(2, o.pulseLen || 32);
    this.pulse = new Float32Array(len);
    let area = 0;
    let seed = 987654321;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      this.pulse[i] = Math.sin((Math.PI * i) / len) ** 2 * (1 + (o.noise || 0) * noise);
      area += this.pulse[i];
    }
    for (let i = 0; i < len; i++) this.pulse[i] /= area; // pulsens yta = 1
    const n = this.ratios.length;
    this.y1 = new Float64Array(n);
    this.y2 = new Float64Array(n);
    this.n = 0;
    this.quiet = 0;
    this.end = Infinity;
    this.port.onmessage = (e) => { if (e.data.end !== undefined) this.end = e.data.end; };
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    if (!out) return true;
    const t0 = currentTime;
    if (t0 > this.end) return false;
    const f0 = parameters.frequency[0] * Math.pow(2, parameters.detune[0] / 1200);
    const m = this.ratios.length;
    const c1 = new Float64Array(m);
    const c2 = new Float64Array(m);
    const gin = new Float64Array(m);
    for (let k = 0; k < m; k++) {
      const w = (2 * Math.PI * f0 * this.ratios[k]) / sampleRate;
      if (w >= Math.PI * 0.95) continue; // över halva samplingsfrekvensen: hoppa över
      const r = Math.exp(-6.91 / (this.t60s[k] * sampleRate));
      c1[k] = 2 * r * Math.cos(w);
      c2[k] = r * r;
      gin[k] = Math.sin(w) * this.amps[k];
    }
    for (let i = 0; i < out.length; i++) {
      if (t0 + i / sampleRate < this.start) { out[i] = 0; continue; }
      const x = this.n < this.pulse.length ? this.pulse[this.n] : 0;
      this.n++;
      let sum = 0;
      for (let k = 0; k < m; k++) {
        const y = c1[k] * this.y1[k] - c2[k] * this.y2[k] + gin[k] * x;
        this.y2[k] = this.y1[k];
        this.y1[k] = y;
        sum += y;
      }
      out[i] = sum;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    // Tyst i 0,1 s efter anslaget = klar (sparar processorkraft vid snabbt spel)
    if (this.n > this.pulse.length) {
      let peak = 0;
      for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
      this.quiet = peak < 1e-5 ? this.quiet + out.length : 0;
      if (this.quiet > sampleRate * 0.1) return false;
    }
    return true;
  }
}

registerProcessor('pm-modal', PmModal);

// FM-motorn: fyra sinusoperatorer (fasmodulering, som klassiska FM-syntar).
// Varje operator har ett förhållande till grundtonen, en nivå och en egen kurva (attack, decay,
// sustain). Bärarna hörs; modulatorerna ändrar i stället bärarnas klang – ju högre nivå, desto fler
// övertoner. Operator 4 kan återkoppla till sig själv (ger sågtandslik klang, vid högt värde brus).
// Allt räknas sampel för sampel, så att återkopplingen och snabba kurvor blir exakta.
class Fm4 extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 10, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.start = o.start || 0;
    this.ops = (o.ops || []).slice(0, 4);
    while (this.ops.length < 4) this.ops.push({ ratio: 1, level: 0, attack: 0.01, decay: 1, sustain: 0 });
    this.mods = o.mods || [[], [], [], []];
    this.isCar = [false, false, false, false];
    (o.car || [0]).forEach((k) => { this.isCar[k] = true; });
    // Flera bärare: dela på nivån, så att algoritmerna låter ungefär lika starkt
    let carSum = 0;
    for (let k = 0; k < 4; k++) if (this.isCar[k]) carSum += this.ops[k].level;
    this.carNorm = 1 / Math.max(1, carSum);
    this.fb = Math.min(1, Math.max(0, o.fb || 0)) * 1.6;
    this.index = o.index ?? 6;
    // Svävning: operatorerna stäms en aning isär (bredare, levande klang)
    const d = o.detune || 0;
    this.detf = [0, d, -d, d / 2].map((c) => Math.pow(2, c / 1200));
    this.phase = new Float64Array(4);
    this.env = new Float64Array(4);
    this.stage = new Uint8Array(4); // 0 = attack, 1 = decay/sustain
    this.attackStep = this.ops.map((op) => 1 / Math.max(1, (op.attack || 0.001) * sampleRate));
    this.decayK = this.ops.map((op) => Math.exp(-3 / Math.max(1, (op.decay || 0.01) * sampleRate)));
    this.out = new Float64Array(4);
    this.fb1 = 0;
    this.fb2 = 0;
    this.end = Infinity;
    this.quiet = 0;
    this.port.onmessage = (e) => { if (e.data.end !== undefined) this.end = e.data.end; };
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    if (!out) return true;
    const t0 = currentTime;
    if (t0 > this.end) return false;
    const f0 = parameters.frequency[0] * Math.pow(2, parameters.detune[0] / 1200);
    const inc = new Float64Array(4);
    const live = [true, true, true, true];
    for (let k = 0; k < 4; k++) {
      const f = f0 * this.ops[k].ratio * this.detf[k];
      inc[k] = f / sampleRate;
      if (f > sampleRate * 0.45) live[k] = false; // över halva samplingsfrekvensen: tyst
    }
    const TWO_PI = 2 * Math.PI;
    const { ops, mods, isCar, env, stage, phase } = this;
    for (let i = 0; i < out.length; i++) {
      if (t0 + i / sampleRate < this.start) { out[i] = 0; continue; }
      let sum = 0;
      for (let k = 3; k >= 0; k--) {
        // Kurvan: linjär attack, sedan exponentiellt mot sustain
        if (stage[k] === 0) {
          env[k] += this.attackStep[k];
          if (env[k] >= 1) { env[k] = 1; stage[k] = 1; }
        } else {
          const s = ops[k].sustain;
          env[k] = s + (env[k] - s) * this.decayK[k];
        }
        phase[k] += inc[k];
        if (phase[k] >= 1) phase[k] -= Math.floor(phase[k]);
        if (!live[k]) { this.out[k] = 0; continue; }
        let pm = 0;
        const m = mods[k];
        for (let j = 0; j < m.length; j++) pm += this.out[m[j]];
        if (k === 3 && this.fb) pm += this.fb * 0.5 * (this.fb1 + this.fb2);
        const y = Math.sin(TWO_PI * phase[k] + pm) * env[k];
        if (k === 3) { this.fb2 = this.fb1; this.fb1 = y; }
        if (isCar[k]) {
          sum += y * ops[k].level;
          this.out[k] = 0;
        } else {
          this.out[k] = y * ops[k].level * this.index;
        }
      }
      out[i] = sum * this.carNorm;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    // Har bärarna klingat ut (sustain 0) är rösten klar: spara processorkraft
    let peak = 0;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    this.quiet = peak < 1e-5 && t0 > this.start + 0.05 ? this.quiet + out.length : 0;
    if (this.quiet > sampleRate * 0.1) return false;
    return true;
  }
}

registerProcessor('fm4', Fm4);

// ---------- Vågtabell ----------
// En oscillator som glider mellan åtta vågformer (en "tabell"). Positionen styrs av ett startläge,
// en kurva som flyttar den över tid och en långsam svängning. Flera lätt ostämda röster (unison)
// sprids i stereo. Tabellerna byggs av övertoner, en gång per tabell och tonområde, och med bara
// så många övertoner som ryms under halva samplingsfrekvensen (annars blir det vikningsdistorsion).
const WT_SIZE = 2048;
const WT_FRAMES = 8;
const wtCache = new Map();
// Färdigräknad sinus (en period på WT_SIZE punkter): sin(2π·n·i/N) = WT_SIN[(n·i) mod N]
const WT_SIN = Float32Array.from({ length: WT_SIZE }, (_, i) => Math.sin((2 * Math.PI * i) / WT_SIZE));
const wtSin = (k) => WT_SIN[k & (WT_SIZE - 1)];
const wtCos = (k) => WT_SIN[(k + WT_SIZE / 4) & (WT_SIZE - 1)];

// Övertonernas styrka för ram f (0–1 = var i tabellen) och överton n (1, 2, 3 …)
function wtSpectrum(name, f, n) {
  const lerp = (a, b, x) => a + (b - a) * x;
  switch (name) {
    case 'basic': { // sinus -> triangel -> sågtand -> fyrkant
      const tri = n % 2 ? 1 / (n * n) : 0;
      const saw = 1 / n;
      const sq = n % 2 ? 1 / n : 0;
      const sine = n === 1 ? 1 : 0;
      const x = f * 3;
      if (x < 1) return lerp(sine, tri, x);
      if (x < 2) return lerp(tri, saw, x - 1);
      return lerp(saw, sq, x - 2);
    }
    case 'pulse': { // pulsbredd från 50 % ned till 4 %
      const w = lerp(0.5, 0.04, f);
      return Math.abs((2 / (n * Math.PI)) * Math.sin(n * Math.PI * w));
    }
    case 'vowel': { // vokalerna u -> o -> a -> e -> i (två formanter, i övertoner vid ca 130 Hz)
      const V = [[2.3, 6], [3.5, 6.5], [6, 9.5], [3.5, 17], [2, 21]];
      const x = f * 4;
      const i = Math.min(3, Math.floor(x));
      const [a1, a2] = V[i];
      const [b1, b2] = V[i + 1];
      const f1 = lerp(a1, b1, x - i);
      const f2 = lerp(a2, b2, x - i);
      return (Math.exp(-((n - f1) ** 2) / 2.5) + 0.6 * Math.exp(-((n - f2) ** 2) / 6) + 0.3 / n) / 1.4;
    }
    case 'organ': { // dragstänger som dras ut en efter en
      const bars = [1, 2, 3, 4, 6, 8, 10, 12, 16];
      const k = bars.indexOf(n);
      if (k < 0) return 0;
      const open = f * bars.length + 1;
      return Math.max(0, Math.min(1, open - k)) * (k === 0 ? 1 : 0.7);
    }
    case 'glass': { // glesa, höga övertoner som vandrar uppåt
      const center = lerp(3, 24, f);
      return n === 1 ? 0.6 : (n % 3 === 0 || n % 5 === 0 ? Math.exp(-((n - center) ** 2) / 8) : 0);
    }
    case 'digital': { // "slumpade" men fasta spektra, som en gammal digitalsynt
      const seed = (Math.sin(n * 12.9898 + Math.floor(f * 7.99) * 78.233) * 43758.5453) % 1;
      return Math.abs(seed) / Math.sqrt(n);
    }
    default:
      return n === 1 ? 1 : 0;
  }
}

// Vågformer som är lättare att beskriva i tid (synk, veckning): räknas om till övertoner med DFT
function wtTimeShape(name, f, x) { // x = 0..1 i perioden
  if (name === 'sync') { // hårdsynkad sågtand: slavens tonhöjd 1 -> 5 gånger grundtonen
    const ratio = 1 + f * 4;
    const ph = (x * ratio) % 1;
    return 1 - 2 * ph;
  }
  if (name === 'fold') { // sinus genom en veckare: mer och mer veck
    const g = 1 + f * 6;
    let v = Math.sin(2 * Math.PI * x) * g;
    for (let k = 0; k < 8 && Math.abs(v) > 1; k++) v = v > 1 ? 2 - v : -2 - v;
    return v;
  }
  return Math.sin(2 * Math.PI * x);
}

function wtHarmonicsFromTime(name, f, maxH) {
  const N = 1024; // (WT_SIZE / N = 2: index i i signalen motsvarar 2i i sinustabellen)
  const s = new Float32Array(N);
  for (let i = 0; i < N; i++) s[i] = wtTimeShape(name, f, i / N);
  const re = new Float32Array(maxH + 1);
  const im = new Float32Array(maxH + 1);
  for (let n = 1; n <= maxH && n < N / 2; n++) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < N; i++) {
      a += s[i] * wtCos(2 * n * i);
      b += s[i] * wtSin(2 * n * i);
    }
    re[n] = (2 * a) / N;
    im[n] = (2 * b) / N;
  }
  return { re, im };
}

function wtTable(name, maxH) {
  const key = `${name}:${maxH}`;
  if (wtCache.has(key)) return wtCache.get(key);
  const frames = [];
  let peak = 0;
  for (let fr = 0; fr < WT_FRAMES; fr++) {
    const f = fr / (WT_FRAMES - 1);
    const data = new Float32Array(WT_SIZE + 1);
    const timeBased = name === 'sync' || name === 'fold';
    const h = timeBased ? wtHarmonicsFromTime(name, f, maxH) : null;
    for (let n = 1; n <= maxH; n++) {
      const a = timeBased ? 0 : wtSpectrum(name, f, n);
      if (!timeBased && !a) continue;
      if (timeBased) {
        const c = h.re[n];
        const d = h.im[n];
        if (Math.abs(c) + Math.abs(d) < 1e-5) continue;
        for (let i = 0; i < WT_SIZE; i++) data[i] += c * wtCos(n * i) + d * wtSin(n * i);
      } else {
        for (let i = 0; i < WT_SIZE; i++) data[i] += a * wtSin(n * i);
      }
    }
    data[WT_SIZE] = data[0];
    for (let i = 0; i < WT_SIZE; i++) peak = Math.max(peak, Math.abs(data[i]));
    frames.push(data);
  }
  // Samma toppnivå för hela tabellen, så att volymen inte hoppar när positionen rör sig
  frames.forEach((d) => { for (let i = 0; i <= WT_SIZE; i++) d[i] /= peak || 1; });
  wtCache.set(key, frames);
  return frames;
}

class Wavetable extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 10, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.start = o.start || 0;
    this.name = o.table || 'basic';
    this.pos = o.pos || 0;
    this.env = o.env || 0;
    this.envTime = Math.max(0.01, o.envTime || 1);
    this.move = o.move || 0;
    this.moveRate = o.moveRate || 0.5;
    this.unison = Math.max(1, Math.min(7, Math.round(o.unison || 1)));
    this.spread = o.spread || 0;
    this.width = o.width ?? 0.7;
    this.level = 1 / Math.sqrt(this.unison);
    // Varje unisonröst: egen fas (slumpad start, så att de inte tar ut varandra), stämning och panorering
    this.voices = Array.from({ length: this.unison }, (_, i) => {
      const x = this.unison === 1 ? 0 : (i / (this.unison - 1)) * 2 - 1;
      const pan = x * this.width;
      return {
        phase: this.unison === 1 ? 0 : Math.random(),
        cents: x * this.spread,
        gl: Math.cos(((pan + 1) * Math.PI) / 4),
        gr: Math.sin(((pan + 1) * Math.PI) / 4),
      };
    });
    this.maxH = 0;
    this.frames = null;
    this.elapsed = 0;
    this.lfoPhase = Math.random();
    this.end = Infinity;
    this.port.onmessage = (e) => { if (e.data.end !== undefined) this.end = e.data.end; };
    // Förberedelse: bygg tabellen för alla tonområden direkt (när ljudet väljs), så att första
    // tonen inte behöver vänta på det
    this.warmOnly = !!o.warm;
    if (this.warmOnly) for (let h = 256; h >= 1; h /= 2) wtTable(this.name, h);
  }

  process(inputs, outputs, parameters) {
    if (this.warmOnly) return false;
    const L = outputs[0][0];
    const R = outputs[0][1] || L;
    if (!L) return true;
    const t0 = currentTime;
    if (t0 > this.end) return false;
    const f0 = parameters.frequency[0] * Math.pow(2, parameters.detune[0] / 1200);
    // Tonområde: så många övertoner som ryms (i steg om oktaver, så att tabellerna kan delas)
    const fit = Math.max(1, Math.floor((sampleRate * 0.45) / (f0 * Math.pow(2, this.spread / 1200))));
    let maxH = 1;
    while (maxH * 2 <= Math.min(256, fit)) maxH *= 2;
    if (maxH !== this.maxH) { this.maxH = maxH; this.frames = wtTable(this.name, maxH); }
    const frames = this.frames;
    const incs = this.voices.map((v) => (f0 * Math.pow(2, v.cents / 1200)) / sampleRate);
    for (let i = 0; i < L.length; i++) {
      if (t0 + i / sampleRate < this.start) { L[i] = 0; R[i] = 0; continue; }
      // Position i tabellen (räknas om var 16:e sampel räcker, men det är billigt nog per sampel)
      this.elapsed += 1 / sampleRate;
      this.lfoPhase += this.moveRate / sampleRate;
      let p = this.pos + this.env * (1 - Math.exp((-3 * this.elapsed) / this.envTime))
        + this.move * 0.5 * Math.sin(2 * Math.PI * this.lfoPhase);
      p = Math.min(1, Math.max(0, p)) * (WT_FRAMES - 1);
      const fa = Math.min(WT_FRAMES - 2, Math.floor(p));
      const fx = p - fa;
      const A = frames[fa];
      const B = frames[fa + 1];
      let l = 0;
      let r = 0;
      for (let k = 0; k < this.voices.length; k++) {
        const v = this.voices[k];
        v.phase += incs[k];
        if (v.phase >= 1) v.phase -= 1;
        const x = v.phase * WT_SIZE;
        const j = x | 0;
        const fr = x - j;
        const a = A[j] + (A[j + 1] - A[j]) * fr;
        const b = B[j] + (B[j + 1] - B[j]) * fr;
        const s = a + (b - a) * fx;
        l += s * v.gl;
        r += s * v.gr;
      }
      L[i] = l * this.level;
      R[i] = r * this.level;
    }
    return true;
  }
}
registerProcessor('wavetable', Wavetable);

// ======================================================================================
// ---------- Röst (formantsyntes) ----------
// En röstkälla (glottis) går genom fem formanter – munhålans resonanser – som bestämmer vokalen.
// Källan är ett bandbegränsat pulståg (alla övertoner lika starka, inga vikningsfel) plus luft
// (brus som pulserar i takt med stämbanden). Formanterna är uppmätta värden för bas, tenor, alt och
// sopran (barn = sopran en bit uppåt). Vokalen glider steglöst u → o → a → e → i. Flera röster
// (kör) får egen stämning, eget vibrato och små tonhöjdsvariationer, och sprids i stereo.
const VOWELS = ['u', 'o', 'a', 'e', 'i'];
// [frekvenser (Hz), styrka (dB), bandbredd (Hz)] för formant 1–5
const VOICE_FORMANTS = {
  bass: {
    a: [[600, 1040, 2250, 2450, 2750], [0, -7, -9, -9, -20], [60, 70, 110, 120, 130]],
    e: [[400, 1620, 2400, 2800, 3100], [0, -12, -9, -12, -18], [40, 80, 100, 120, 120]],
    i: [[250, 1750, 2600, 3050, 3340], [0, -30, -16, -22, -28], [60, 90, 100, 120, 120]],
    o: [[400, 750, 2400, 2600, 2900], [0, -11, -21, -20, -40], [40, 80, 100, 120, 120]],
    u: [[350, 600, 2400, 2675, 2950], [0, -20, -32, -28, -36], [40, 80, 100, 120, 120]],
  },
  tenor: {
    a: [[650, 1080, 2650, 2900, 3250], [0, -6, -7, -8, -22], [80, 90, 120, 130, 140]],
    e: [[400, 1700, 2600, 3200, 3580], [0, -14, -12, -14, -20], [70, 80, 100, 120, 120]],
    i: [[290, 1870, 2800, 3250, 3540], [0, -15, -18, -20, -30], [40, 90, 100, 120, 120]],
    o: [[400, 800, 2600, 2800, 3000], [0, -10, -12, -12, -26], [40, 80, 100, 120, 120]],
    u: [[350, 600, 2700, 2900, 3300], [0, -20, -17, -14, -26], [40, 60, 100, 120, 120]],
  },
  alto: {
    a: [[800, 1150, 2800, 3500, 4950], [0, -4, -20, -36, -60], [80, 90, 120, 130, 140]],
    e: [[400, 1600, 2700, 3300, 4950], [0, -24, -30, -35, -60], [60, 80, 120, 150, 200]],
    i: [[350, 1700, 2700, 3700, 4950], [0, -20, -30, -36, -60], [50, 100, 120, 150, 200]],
    o: [[450, 800, 2830, 3500, 4950], [0, -9, -16, -28, -55], [70, 80, 100, 130, 135]],
    u: [[325, 700, 2530, 3500, 4950], [0, -12, -30, -40, -64], [50, 60, 170, 180, 200]],
  },
  soprano: {
    a: [[800, 1150, 2900, 3900, 4950], [0, -6, -32, -20, -50], [80, 90, 120, 130, 140]],
    e: [[350, 2000, 2800, 3600, 4950], [0, -20, -15, -40, -56], [60, 100, 120, 150, 200]],
    i: [[270, 2140, 2950, 3900, 4950], [0, -12, -26, -26, -44], [60, 90, 100, 120, 120]],
    o: [[450, 800, 2830, 3800, 4950], [0, -11, -22, -22, -50], [70, 80, 100, 130, 135]],
    u: [[325, 700, 2700, 3800, 4950], [0, -16, -35, -40, -60], [50, 60, 170, 180, 200]],
  },
};

// Formanterna för vokalläget x (0 = u … 1 = i), skalade (s) uppåt eller nedåt
function voiceFormants(type, x, s = 1) {
  const T = VOICE_FORMANTS[type === 'child' ? 'soprano' : type] || VOICE_FORMANTS.alto;
  const scale = (type === 'child' ? 1.18 : 1) * s;
  const y = Math.min(1, Math.max(0, x)) * 4;
  const i = Math.min(3, Math.floor(y));
  const fr = y - i;
  const A = T[VOWELS[i]];
  const B = T[VOWELS[i + 1]];
  const out = [];
  for (let k = 0; k < 5; k++) {
    out.push({
      f: Math.exp(Math.log(A[0][k]) + (Math.log(B[0][k]) - Math.log(A[0][k])) * fr) * scale,
      g: Math.pow(10, (A[1][k] + (B[1][k] - A[1][k]) * fr) / 20),
      bw: (A[2][k] + (B[2][k] - A[2][k]) * fr) * Math.sqrt(scale),
    });
  }
  return out;
}

// Bandpass (topp = 1) för en formant: koefficienter in i ett tillståndsobjekt
function bpSet(st, f, bw, gain) {
  const fc = Math.min(f, sampleRate * 0.45);
  const w = (2 * Math.PI * fc) / sampleRate;
  const alpha = Math.sin(w) * Math.sinh((Math.log(2) / 2) * (bw / fc) * (w / Math.sin(w)));
  const a0 = 1 + alpha;
  st.b0 = (alpha / a0) * gain;
  st.a1 = (-2 * Math.cos(w)) / a0;
  st.a2 = (1 - alpha) / a0;
}
const bpNew = () => ({ b0: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 });
function bpTick(st, x) {
  const y = st.b0 * (x - st.x2) - st.a1 * st.y1 - st.a2 * st.y2;
  st.x2 = st.x1; st.x1 = x; st.y2 = st.y1; st.y1 = y;
  return y;
}

class VoiceSynth {
  constructor(o = {}) {
    this.type = o.type || 'alto';
    this.vowel = o.vowel ?? 0.5;
    this.breath = o.breath || 0;
    this.vib = o.vib || 0;
    this.move = o.move || 0;
    this.moveRate = o.moveRate || 0.3;
    const n = Math.max(1, Math.min(6, Math.round(o.voices || 1)));
    this.spread = o.spread || 0;
    this.voices = Array.from({ length: n }, (_, i) => {
      const x = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const pan = x * 0.8;
      return {
        phase: n === 1 ? 0 : Math.random(),
        cents: x * this.spread + (n === 1 ? 0 : (Math.random() - 0.5) * this.spread * 0.4),
        gl: Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2,
        gr: Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2,
        vibPhase: Math.random(),
        vibRate: 5.2 + (n === 1 ? 0 : (Math.random() - 0.5) * 0.8),
        jit: 0,
        jitTo: 0,
        M: 1,
      };
    });
    this.stereo = n > 1;
    // Fem formanter + "bröstklang" (en resonans nära grundtonen) per kanal
    this.bankL = Array.from({ length: 6 }, bpNew);
    this.bankR = this.stereo ? Array.from({ length: 6 }, bpNew) : this.bankL;
    this.movePhase = Math.random();
    this.elapsed = 0;
    this.voicedGain = 1 - 0.9 * this.breath * this.breath;
    this.noiseGain = this.breath * 9;
    this.level = 0.11 / Math.sqrt(n);
  }

  // Ett block: f0 i Hz, ctl = vokal (0–1) från Läge på rutan, eller < 0 = som ljudet är
  render(L, R, start, n, f0, ctl = -1) {
    const sr = sampleRate;
    this.movePhase += (this.moveRate * n) / sr;
    let x = ctl >= 0 ? ctl : this.vowel + this.move * 0.5 * Math.sin(2 * Math.PI * this.movePhase);
    x = Math.min(1, Math.max(0, x));
    const setBank = (bank, s) => {
      voiceFormants(this.type, x, s).forEach((fm, k) => bpSet(bank[k], fm.f, fm.bw, fm.g));
      bpSet(bank[5], Math.max(140, f0 * 1.1), Math.max(80, f0 * 0.8), 0.45);
    };
    setBank(this.bankL, this.stereo ? 0.985 : 1);
    if (this.stereo) setBank(this.bankR, 1.015);
    // Antal övertoner som ryms under halva samplingsfrekvensen (udda tal: Dirichletkärnan)
    this.voices.forEach((v) => {
      const P = sr / (f0 * Math.pow(2, v.cents / 1200));
      v.M = Math.max(1, 2 * Math.floor((P * 0.9) / 2) + 1);
      if (Math.random() < n / sr * 12) v.jitTo = (Math.random() - 0.5) * 14; // små ojämnheter (cent)
    });
    const vibOn = this.vib * 32 * Math.min(1, Math.max(0, (this.elapsed - 0.2) / 0.4));
    // Höga toner har färre övertoner i formanterna och blir svagare – jämnas ut (uppmätt)
    const level = this.level * Math.pow(f0 / 261.6, 0.32);
    for (let i = start; i < start + n; i++) {
      this.elapsed += 1 / sr;
      let eL = 0;
      let eR = 0;
      let gate = 0;
      for (let k = 0; k < this.voices.length; k++) {
        const v = this.voices[k];
        v.jit += (v.jitTo - v.jit) * 0.0005;
        v.vibPhase += v.vibRate / sr;
        const cents = v.cents + v.jit + vibOn * Math.sin(2 * Math.PI * v.vibPhase);
        v.phase += (f0 * Math.pow(2, cents / 1200)) / sr;
        if (v.phase >= 1) v.phase -= 1;
        const den = Math.sin(Math.PI * v.phase);
        const d = Math.abs(den) < 1e-5 ? v.M : Math.sin(Math.PI * v.M * v.phase) / den;
        const h = (d - 1) * 0.5; // alla övertoner med styrka 1, ingen likström
        eL += h * v.gl;
        eR += h * v.gr;
        if (k === 0) gate = 0.4 + 0.6 * (0.5 + 0.5 * Math.cos(2 * Math.PI * v.phase));
      }
      const noise = (Math.random() * 2 - 1) * this.noiseGain * gate;
      eL = eL * this.voicedGain + noise;
      eR = eR * this.voicedGain + noise;
      let yL = 0;
      for (let k = 0; k < 6; k++) yL += bpTick(this.bankL[k], eL);
      let yR = yL;
      if (this.stereo) {
        yR = 0;
        for (let k = 0; k < 6; k++) yR += bpTick(this.bankR[k], eR);
      }
      L[i] = yL * level;
      R[i] = yR * level;
    }
  }
}

class Voice extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 10, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'ctl', defaultValue: -1, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.start = o.start || 0;
    this.end = Infinity;
    this.synth = new VoiceSynth(o);
    this.port.onmessage = (e) => { if (e.data.end !== undefined) this.end = e.data.end; };
  }

  process(inputs, outputs, parameters) {
    const L = outputs[0][0];
    const R = outputs[0][1] || L;
    if (!L) return true;
    const t0 = currentTime;
    if (t0 > this.end) return false;
    const skip = Math.max(0, Math.min(L.length, Math.ceil((this.start - t0) * sampleRate)));
    for (let i = 0; i < skip; i++) { L[i] = 0; R[i] = 0; }
    if (skip >= L.length) return true;
    const f0 = parameters.frequency[0] * Math.pow(2, parameters.detune[0] / 1200);
    this.synth.render(L, R, skip, L.length - skip, f0, parameters.ctl[0]);
    return true;
  }
}
registerProcessor('voice', Voice);

// ---------- Blås ----------
//   reed  – klarinett, fysisk modell (vågledare som i Synthesis ToolKit): ett rörblad som öppnar
//           och stänger mot munstycket och ett rör som är slutet i ena änden – därför mest udda
//           övertoner, en mörk och ihålig klang. Tonen byggs upp av sig själv när man börjar blåsa.
//   flute – flöjt: en ren ton med några övertoner (fler ju hårdare och ljusare man blåser) och luft
//           som resonerar i ett rör stämt till tonen (en kamfilterslinga). I början hörs ett kort
//           "tju" av luft innan tonen tagit sig (tonen byggs upp lite långsammare än luften).
// Blåstrycket styr styrka och klang, andningen hur mycket luft som hörs.
const WIND_BUF = 8192;
class Wind extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 10, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'ctl', defaultValue: -1, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.start = o.start || 0;
    this.end = Infinity;
    this.rel = Infinity;
    this.kind = o.kind === 'reed' ? 'reed' : 'flute';
    this.pressure = o.pressure ?? 0.5;
    this.noise = o.noise ?? 0.2;
    this.bright = o.bright ?? 0.5;
    this.vib = o.vib || 0;
    this.attack = Math.max(0.005, o.attack ?? 0.06);
    this.bore = new Float32Array(WIND_BUF);
    this.w = 0;
    this.lp = 0;
    this.x1 = 0;
    this.ox = 0;
    this.oy = 0;
    this.env = 0;
    this.tone = 0; // flöjt: tonens egen uppbyggnad (lite efter luften)
    this.phase = 0;
    this.elapsed = 0;
    this.vibPhase = Math.random();
    this.press = -1;
    this.port.onmessage = (e) => {
      if (e.data.end !== undefined) this.end = e.data.end;
      if (e.data.release !== undefined) this.rel = e.data.release;
    };
  }

  read(d) {
    const p = this.w - d;
    const i = Math.floor(p);
    const fr = p - i;
    const a = this.bore[(i + WIND_BUF) & (WIND_BUF - 1)];
    const b = this.bore[(i + 1 + WIND_BUF) & (WIND_BUF - 1)];
    return a + (b - a) * fr;
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    if (!out) return true;
    const t0 = currentTime;
    if (t0 > this.end) return false;
    const sr = sampleRate;
    const f = Math.max(20, parameters.frequency[0] * Math.pow(2, parameters.detune[0] / 1200));
    const ctl = parameters.ctl[0];
    const target = ctl >= 0 ? ctl : this.pressure;
    this.press = this.press < 0 ? target : this.press + (target - this.press) * 0.2;
    const press = this.press;
    const flute = this.kind === 'flute';
    let boreLen;
    let a = 0;
    if (flute) {
      boreLen = sr / f; // luftens resonansrör (kamfilter) stämt till tonen
    } else {
      a = 0.5 + 0.45 * this.bright; // envägsfilter i röret: a·x + (1−a)·x1
      boreLen = (0.5 * sr) / f - (1 - a);
    }
    boreLen = Math.min(WIND_BUF - 4, Math.max(2, boreLen));
    // Flöjtens övertoner: fler ju hårdare och ljusare man blåser (bara de som ryms)
    const h2 = f * 2 < sr * 0.45 ? 0.08 + 0.3 * this.bright * (0.4 + 0.6 * press) : 0;
    const h3 = f * 3 < sr * 0.45 ? 0.03 + 0.22 * this.bright * press * press : 0;
    const h4 = f * 4 < sr * 0.45 ? 0.12 * this.bright * press * press : 0;
    const toneGain = 0.35 + 0.65 * press;
    const reedP = 0.68 + 0.27 * press; // rörbladet börjar svänga vid ca 0,64
    const nGain = this.noise * (flute ? 1.4 - 0.6 * press : 0.2);
    const toneRate = 1 / (Math.max(0.02, this.attack * 1.6) * sr);
    const inc = f / sr;
    for (let i = 0; i < out.length; i++) {
      const t = t0 + i / sr;
      if (t < this.start) { out[i] = 0; continue; }
      this.elapsed += 1 / sr;
      // Blåsningen: upp under anblåsningen, ned när tonen släpps
      const goal = t >= this.rel ? 0 : 1;
      const rate = goal > this.env ? 1 / (this.attack * sr) : 1 / (0.06 * sr);
      this.env += Math.max(-rate, Math.min(rate, goal - this.env));
      this.vibPhase += 5 / sr;
      const vib = this.vib * Math.sin(2 * Math.PI * this.vibPhase) * Math.min(1, this.elapsed / 0.5);
      const nz = Math.random() * 2 - 1;
      let y;
      if (flute) {
        this.tone += Math.max(-rate, Math.min(toneRate, this.env - this.tone));
        this.phase += inc * (1 + vib * 0.004);
        if (this.phase >= 1) this.phase -= 1;
        const ph = 2 * Math.PI * this.phase;
        const tone = Math.sin(ph) + h2 * Math.sin(2 * ph) + h3 * Math.sin(3 * ph) + h4 * Math.sin(4 * ph);
        // Luft: mer i början (innan tonen tagit sig), och genom röret så att den låter som tonen
        const air = nz * nGain * (0.25 + 1.5 * Math.max(0, this.env - this.tone)) * this.env;
        const res = this.read(boreLen);
        this.lp += 0.5 * (res - this.lp);
        this.bore[this.w & (WIND_BUF - 1)] = air + 0.9 * this.lp;
        y = tone * this.tone * toneGain * (1 + vib * 0.08) * 0.32 + res * 0.35;
      } else {
        let breath = reedP * this.env * (1 + vib * 0.05);
        breath += breath * nz * nGain;
        const boreOut = this.read(boreLen);
        const filt = a * boreOut + (1 - a) * this.x1;
        this.x1 = boreOut;
        const pd = -0.95 * filt - breath;
        let reed = 0.7 - 0.3 * pd;
        reed = reed > 1 ? 1 : reed < -1 ? -1 : reed;
        this.bore[this.w & (WIND_BUF - 1)] = breath + pd * reed;
        y = boreOut * 0.4;
      }
      this.w++;
      // Likströmsspärr på utgången
      const o = y - this.ox + 0.995 * this.oy;
      this.ox = y;
      this.oy = o;
      out[i] = o;
    }
    if (this.w > 1e9) this.w &= WIND_BUF - 1;
    return true;
  }
}
registerProcessor('wind', Wind);

// ---------- Granulär ----------
// Ljudet byggs av många korta korn (10–500 ms) som läses ur en ljudkälla, var och en med mjuk
// in- och uttoning, lite olika ställe i källan och slumpad plats i stereo. Täta, långa korn = en
// jämn ljudmatta; glesa, korta = gnistor och prassel. Källorna räknas fram här (inga ljudfiler):
// tonande (kör, stråkar, glas – grundton C4, spelas upp i rätt tonhöjd) och texturer (vind, regn,
// bäck, fåglar, glitter – följer också tangenten: högre ton = ljusare och snabbare).
const GRAIN_F0 = 261.6256; // källornas grundton (C4)
const GRAIN_SECONDS = 3;
const grainCache = new Map();
const HANN = Float32Array.from({ length: 1025 }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 1024));

// En jämn slinga: slutet tonas in i början, så att kornen kan läsa runt utan klick
function grainLoop(buf, fade) {
  const n = buf.length - fade;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf[i];
  for (let i = 0; i < fade; i++) {
    const x = i / fade;
    out[i] = buf[i] * Math.sqrt(x) + buf[n + i] * Math.sqrt(1 - x);
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  for (let i = 0; i < n; i++) out[i] /= peak || 1;
  return out;
}

function grainSource(name) {
  if (grainCache.has(name)) return grainCache.get(name);
  const sr = sampleRate;
  const len = Math.round(sr * (GRAIN_SECONDS + 0.25));
  const buf = new Float32Array(len);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = 2 * Math.PI;
  // Ett kort ljud (ping, droppe, bubbla, kvitter) in i bufferten
  const add = (at, dur, fn) => {
    const s = Math.floor(at * sr);
    const n = Math.floor(dur * sr);
    for (let i = 0; i < n && s + i < len; i++) buf[s + i] += fn(i / sr, i / n);
  };
  // Brus genom ett bandpass som vandrar (för vind och vatten)
  const noiseBand = (gain, fLo, fHi, bw, speed) => {
    const st = bpNew();
    let f = rnd(fLo, fHi);
    let to = f;
    let g = 1;
    let gTo = 1;
    for (let i = 0; i < len; i++) {
      if (i % 64 === 0) {
        if (Math.random() < (64 / sr) * speed) to = rnd(fLo, fHi);
        if (Math.random() < (64 / sr) * speed * 0.7) gTo = rnd(0.2, 1);
        f += (to - f) * 0.004;
        g += (gTo - g) * 0.004;
        bpSet(st, f, bw, 1);
      }
      buf[i] += bpTick(st, Math.random() * 2 - 1) * gain * g;
    }
  };
  switch (name) {
    case 'choir': { // kör (alt, tre röster) som sjunger u → o → a → e → i genom källan
      const v = new VoiceSynth({ type: 'alto', voices: 3, spread: 10, vib: 0.5, breath: 0.15 });
      const L = new Float32Array(128);
      const R = new Float32Array(128);
      for (let i = 0; i < len; i += 128) {
        const n = Math.min(128, len - i);
        v.render(L, R, 0, n, GRAIN_F0, i / len);
        for (let k = 0; k < n; k++) buf[i + k] = (L[k] + R[k]) * 0.5;
      }
      break;
    }
    case 'strings': { // stråkmatta: fem lätt ostämda sågtänder (bandbegränsade) som andas
      const N = 2048;
      const table = new Float32Array(N + 1);
      for (let h = 1; h * GRAIN_F0 * 1.01 < sr * 0.45; h++) {
        const a = (1 / h) / (1 + (h * GRAIN_F0 / 3500) ** 2);
        for (let i = 0; i < N; i++) table[i] += a * Math.sin((TAU * h * i) / N);
      }
      table[N] = table[0];
      [-14, -6, 0, 7, 15].forEach((c) => {
        let ph = Math.random();
        const inc = (GRAIN_F0 * Math.pow(2, c / 1200)) / sr;
        const lfo = rnd(0.15, 0.5);
        const lph = Math.random();
        for (let i = 0; i < len; i++) {
          ph += inc;
          if (ph >= 1) ph -= 1;
          const x = ph * N;
          const j = x | 0;
          const s = table[j] + (table[j + 1] - table[j]) * (x - j);
          buf[i] += s * (0.7 + 0.3 * Math.sin(TAU * (lph + (lfo * i) / sr)));
        }
      });
      break;
    }
    case 'glass': { // glas: glesa, ringande deltoner som svävar mot varandra
      [[1, 1], [2.32, 0.55], [4.25, 0.35], [6.63, 0.2], [9.38, 0.12]].forEach(([r, a]) => {
        if (GRAIN_F0 * r > sr * 0.45) return;
        const f1 = GRAIN_F0 * r;
        const beat = rnd(0.3, 1.2);
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          buf[i] += a * Math.sin(TAU * f1 * t) * (0.65 + 0.35 * Math.cos(TAU * beat * t));
        }
      });
      break;
    }
    case 'wind': // vind: brus genom vandrande resonanser, i byar
      noiseBand(1, 250, 900, 120, 1.2);
      noiseBand(0.7, 500, 1600, 200, 0.8);
      noiseBand(0.4, 1200, 3000, 400, 0.6);
      break;
    case 'rain': { // regn: tusentals droppar på ett svagt sus
      noiseBand(0.25, 2000, 6000, 3000, 0.3);
      for (let k = 0; k < GRAIN_SECONDS * 140; k++) {
        const f = rnd(1800, 6000);
        const tau = rnd(0.002, 0.01);
        const a = rnd(0.1, 1) ** 2;
        add(rnd(0, GRAIN_SECONDS + 0.2), tau * 6, (t) => a * Math.sin(TAU * f * t) * Math.exp(-t / tau));
      }
      break;
    }
    case 'water': { // bäck: bubblor som stiger i tonhöjd, på ett mjukt porlande
      noiseBand(0.15, 300, 900, 300, 0.8);
      for (let k = 0; k < GRAIN_SECONDS * 45; k++) {
        const f0 = rnd(350, 1400);
        const tau = rnd(0.012, 0.05);
        const a = rnd(0.2, 1);
        let ph = 0;
        add(rnd(0, GRAIN_SECONDS + 0.2), tau * 5, (t) => {
          ph += (f0 * (1 + (2.5 * t) / tau * 0.15)) / sr;
          return a * Math.sin(TAU * ph) * Math.exp(-t / tau) * Math.min(1, t / 0.002);
        });
      }
      break;
    }
    case 'birds': { // fåglar: fraser av korta kvitter med drill
      let t = rnd(0, 0.3);
      while (t < GRAIN_SECONDS + 0.2) {
        const base = rnd(2500, 4500);
        const syl = Math.floor(rnd(2, 7));
        const sweep = rnd(-1500, 1500);
        const dur = rnd(0.04, 0.12);
        const trill = rnd(20, 60);
        const a = rnd(0.4, 1);
        for (let s = 0; s < syl; s++) {
          let ph = 0;
          add(t, dur, (tt, x) => {
            ph += (base + sweep * x + 300 * Math.sin(TAU * trill * tt)) / sr;
            return a * Math.sin(TAU * ph) * Math.sin(Math.PI * x);
          });
          t += dur * rnd(1.1, 1.6);
        }
        t += rnd(0.15, 0.6);
      }
      break;
    }
    case 'glitter': // glitter: höga, korta klockpling
    default:
      for (let k = 0; k < GRAIN_SECONDS * 30; k++) {
        const f = rnd(2000, 7000);
        const tau = rnd(0.03, 0.2);
        const a = rnd(0.2, 1);
        add(rnd(0, GRAIN_SECONDS + 0.2), tau * 5, (t) =>
          a * (Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * f * 2.01 * t)) * Math.exp(-t / tau) * Math.min(1, t / 0.001));
      }
  }
  const out = grainLoop(buf, Math.round(sr * 0.25));
  grainCache.set(name, out);
  return out;
}

class Grain extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 261.6, minValue: 10, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'ctl', defaultValue: -1, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.warmOnly = !!o.warm;
    this.src = grainSource(o.source || 'choir');
    if (this.warmOnly) return;
    this.start = o.start || 0;
    this.end = Infinity;
    this.pos = o.pos ?? 0.5;
    this.scan = o.scan || 0;
    this.spread = o.spread ?? 0.1;
    this.size = Math.max(0.01, o.size || 0.1);
    this.density = Math.max(1, o.density || 20);
    this.jitter = o.jitter || 0;
    this.width = o.width ?? 0.7;
    this.grains = [];
    this.next = 0;
    this.elapsed = 0;
    // Nivån: ju fler korn som ligger på varandra, desto svagare vart och ett
    this.level = 0.75 / Math.sqrt(Math.max(1, this.density * this.size));
    this.port.onmessage = (e) => { if (e.data.end !== undefined) this.end = e.data.end; };
  }

  process(inputs, outputs, parameters) {
    if (this.warmOnly) return false;
    const L = outputs[0][0];
    const R = outputs[0][1] || L;
    if (!L) return true;
    const t0 = currentTime;
    if (t0 > this.end) return false;
    const sr = sampleRate;
    const src = this.src;
    const n = src.length;
    const f = parameters.frequency[0] * Math.pow(2, parameters.detune[0] / 1200);
    const rate = f / GRAIN_F0;
    const ctl = parameters.ctl[0];
    const glen = Math.max(16, Math.round(this.size * sr));
    for (let i = 0; i < L.length; i++) {
      if (t0 + i / sr < this.start) { L[i] = 0; R[i] = 0; continue; }
      this.elapsed += 1 / sr;
      if (--this.next <= 0 && this.grains.length < 96) {
        // Nytt korn: var i källan (läge + vandring + spridning), tonhöjd och plats i stereo
        let p = ctl >= 0 ? ctl : this.pos + this.scan * 0.1 * this.elapsed;
        p += (Math.random() - 0.5) * this.spread;
        p -= Math.floor(p);
        const pan = (Math.random() * 2 - 1) * this.width;
        this.grains.push({
          x: p * n,
          inc: rate * Math.pow(2, ((Math.random() * 2 - 1) * this.jitter) / 1200),
          age: 0,
          gl: Math.cos(((pan + 1) * Math.PI) / 4),
          gr: Math.sin(((pan + 1) * Math.PI) / 4),
        });
        this.next = (sr / this.density) * (0.6 + Math.random() * 0.8);
      }
      let l = 0;
      let r = 0;
      for (let k = this.grains.length - 1; k >= 0; k--) {
        const g = this.grains[k];
        const wx = (g.age / glen) * 1024;
        const wi = wx | 0;
        const w = HANN[wi] + (HANN[wi + 1] - HANN[wi]) * (wx - wi);
        const j = g.x | 0;
        const a = src[j];
        const b = src[j + 1 < n ? j + 1 : 0];
        const s = (a + (b - a) * (g.x - j)) * w;
        l += s * g.gl;
        r += s * g.gr;
        g.x += g.inc;
        if (g.x >= n) g.x -= n;
        if (++g.age >= glen) this.grains.splice(k, 1);
      }
      L[i] = l * this.level;
      R[i] = r * this.level;
    }
    return true;
  }
}
registerProcessor('grain', Grain);
