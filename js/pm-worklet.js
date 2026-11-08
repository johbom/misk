// Ljudmotorer som körs i ljudtråden (AudioWorklet):
//   pm-string – en sträng (utökad Karplus–Strong)
//   pm-modal  – en resonanskropp (marimba, glas, klocka …): en bank av exakta resonatorer
//   fm4       – FM-motorn: fyra sinusoperatorer med egna kurvor, åtta algoritmer och återkoppling
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
