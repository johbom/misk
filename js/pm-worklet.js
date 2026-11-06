// Fysiska modeller som körs i ljudtråden (AudioWorklet):
//   pm-string – en sträng (utökad Karplus–Strong)
//   pm-modal  – en resonanskropp (marimba, glas, klocka …): en bank av exakta resonatorer
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
