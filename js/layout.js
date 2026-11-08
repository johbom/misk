// Formationer för rutorna. Rutnät sköts av CSS grid; de andra räknas ut här
// och placeras med absoluta positioner inne i sin behållare.
//
// Varje funktion får: n (antal rutor), W och H (ytan i px), gap (mellanrum i px),
// opts ({ stringLength, ringGap, ringHole } från inställningarna)
// och returnerar en lista med { x, y, w, h, font } – en per ruta, i spelordning.
// Ringen lägger dessutom till clip (formen) och label (var texten ska stå).

const FORMATIONS = {
  grid: 'Rutnät',
  circle: 'Cirkel',
  ring: 'Ring',
  hex: 'Bikupa',
  strings: 'Strängar',
  arc: 'Båge',
};

// Hörn för en ringsektor (tårtbit med hål i mitten) runt (cx, cy), från vinkel a0 till a1.
// Kanterna dras in så att mellanrummet g blir lika brett hela vägen ut.
function sectorPoints(cx, cy, r0, r1, a0, a1, g) {
  const half = (a1 - a0) / 2;
  const inset = (r) => Math.min(Math.asin(Math.min(1, g / 2 / r)), half * 0.95);
  const arc = (r, from, to) => {
    const steps = Math.max(3, Math.min(64, Math.ceil((Math.abs(to - from) * r) / 6)));
    return Array.from({ length: steps + 1 }, (_, k) => {
      const a = from + ((to - from) * k) / steps;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  };
  return [...arc(r1, a0 + inset(r1), a1 - inset(r1)), ...arc(r0, a1 - inset(r0), a0 + inset(r0))];
}

// Små bilder till formationsknapparna (ritas med currentColor)
const svgIcon = (body) =>
  `<svg viewBox="0 0 48 36" aria-hidden="true" fill="currentColor" stroke="currentColor">${body}</svg>`;
const FORMATION_ICONS = {
  grid: svgIcon([0, 1].flatMap((r) => [0, 1, 2, 3].map((c) =>
    `<rect x="${3 + c * 11.5}" y="${5 + r * 14}" width="7.5" height="10" rx="2" stroke="none"/>`)).join('')),
  circle: svgIcon(Array.from({ length: 8 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    return `<circle cx="${(24 + 13 * Math.cos(a)).toFixed(1)}" cy="${(18 + 13 * Math.sin(a)).toFixed(1)}" r="3.6" stroke="none"/>`;
  }).join('')),
  ring: svgIcon(Array.from({ length: 6 }, (_, i) => {
    const a0 = -Math.PI / 2 + ((i - 0.5) * Math.PI) / 3;
    const pts = sectorPoints(24, 18, 7, 16, a0, a0 + Math.PI / 3, 2.2);
    return `<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" stroke="none"/>`;
  }).join('')),
  hex: svgIcon([0, 1, 2].flatMap((r) => [0, 1, 2].map((c) =>
    `<circle cx="${12 + c * 10 + (r % 2) * 5}" cy="${8 + r * 10}" r="4.2" stroke="none"/>`)).join('')),
  arc: svgIcon([[15, 7], [9, 5]].flatMap(([R, k]) => Array.from({ length: k }, (_, i) => {
    const a = Math.PI + (i * Math.PI) / (k - 1);
    return `<circle cx="${(24 + R * Math.cos(a)).toFixed(1)}" cy="${(31 + R * Math.sin(a)).toFixed(1)}" r="2.8" stroke="none"/>`;
  })).join('')),
  strings: svgIcon([0, 1, 2, 3, 4].map((i) =>
    `<line x1="${8 + i * 8}" y1="4" x2="${8 + i * 8}" y2="32" stroke-width="2" stroke-linecap="round"/>`).join('')),
};

// Symboler för spelsätten: volymen över tid (ljudets "kurva")
const modeIcon = (fill, line, extra = '') => svgIcon(
  `<path d="${fill}" fill-opacity="0.28" stroke="none"/>`
  + `<path d="${line}" fill="none" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${extra}`);
const PLAY_MODES = {
  hold: {
    name: 'Håll', desc: 'Låter så länge pekaren är kvar på rutan (gated).',
    icon: modeIcon('M10 29 L13 8 H33 L36 29 Z', 'M4 29 H10 L13 8 H33 L36 29 H44'),
  },
  shot: {
    name: 'One-shot', desc: 'Ett anslag som klingar ut av sig självt. Ljudfiler spelas hela.',
    icon: modeIcon('M9 29 L11.5 6 C16 19 24 27 44 28.5 V29 Z', 'M4 29 H9 L11.5 6 C16 19 24 27 44 28.5'),
  },
  fixed: {
    name: 'Längd', desc: 'Låter exakt den tonlängd du väljer.',
    icon: modeIcon('M10 25 L12.5 6 H33.5 L36 25 Z', 'M4 25 H10 L12.5 6 H33.5 L36 25 H44',
      '<path d="M11 29 V35 M35 29 V35 M11 32 H35" fill="none" stroke-width="1.8" stroke-linecap="round"/>'),
  },
  latch: {
    name: 'Ligg kvar', desc: 'Låter tills nästa ruta. Samma ruta igen tystar.',
    icon: modeIcon('M8 29 L11 10 H40 V29 Z', 'M4 29 H8 L11 10 H39',
      '<path d="M37 5.5 L43.5 10 L37 14.5" fill="none" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'),
  },
};

const MIN_BALL = 60; // minsta bollstorlek innan mellanrummet krymps
const MIN_STRING = 40; // minsta strängbredd innan mellanrummet krymps

// Försök med valt mellanrum; blir knapparna för små, krymp mellanrummet stegvis.
function fitGap(gap, min, size) {
  let g = gap;
  let s = size(g);
  while (s < min && g > 6) {
    g = Math.max(6, g * 0.85);
    s = size(g);
  }
  return { g, s };
}

const LAYOUTS = {
  // Bollar jämnt fördelade runt en cirkel, med första tonen högst upp, sedan medurs.
  circle(n, W, H, gap) {
    const R0 = Math.min(W, H) / 2;
    const sin = Math.sin(Math.PI / n);
    // Största bollen där grannar på ringen har "g" mellan sig
    const { s: fitted } = fitGap(gap, MIN_BALL, (g) => (2 * R0 * sin - g) / (1 + sin));
    // En enda boll: stor, mitt på ytan
    const s = n === 1 ? R0 * 1.5 : Math.max(28, Math.min(fitted, R0 * 0.75));
    const R = n === 1 ? 0 : R0 - s / 2;
    return Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: W / 2 + R * Math.cos(a) - s / 2, y: H / 2 + R * Math.sin(a) - s / 2, w: s, h: s, font: s * 0.2 };
    });
  },

  // Ring delad i sektorer, med ett tomt hål i mitten där muspekaren kan vila.
  // Första rutan högst upp, sedan medurs.
  // opts.ringGap = mellanrum mellan sektorerna (px), opts.ringHole = hålets radie (andel av ringens).
  ring(n, W, H, gap, opts) {
    const R = Math.min(W, H) / 2;
    const r = R * opts.ringHole;
    const step = (2 * Math.PI) / n;
    const mid = (R + r) / 2;
    // Mellanrummet får ta högst tre fjärdedelar av bågen, annars försvinner sektorerna
    const g = n === 1 ? 0 : Math.min(opts.ringGap, mid * step * 0.75); // en sektor = hel ring, ingen glipa
    const font = Math.min(28, (R - r) * 0.28, (mid * step - g) * 0.3);
    const rects = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + i * step; // sektorns mitt
      const pts = sectorPoints(R, R, r, R, a - step / 2, a + step / 2, g);
      return {
        x: W / 2 - R, y: H / 2 - R, w: 2 * R, h: 2 * R, font,
        clip: `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`,
        label: { x: R + mid * Math.cos(a), y: R + mid * Math.sin(a) },
      };
    });
    rects.hole = { x: W / 2, y: H / 2, r };
    return rects;
  },

  // Bollar i bikupemönster: varannan rad förskjuten en halv boll.
  // opts.hexOrder: rows = vänster→höger rad för rad, snake = slingrande (varannan rad baklänges),
  // cols = uppifrån och ned, kolumn för kolumn
  hex(n, W, H, gap, opts = {}) {
    const ROW = Math.sqrt(3) / 2; // radavstånd i ett tätpackat mönster
    const bestFor = (g) => {
      let best = { s: 0, cols: 1, rows: 1, shift: 0, none: true }; // (n = 0 ger inga rutor)
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const shift = rows > 1 ? 0.5 : 0;
        const sW = (W - (cols - 1 + shift) * g) / (cols + shift);
        const sH = (H - (rows - 1) * ROW * g) / (1 + (rows - 1) * ROW);
        const s = Math.min(sW, sH);
        if (best.none || s > best.s) best = { s, cols, rows, shift };
      }
      return best;
    };
    const { g } = fitGap(gap, MIN_BALL, (g) => bestFor(g).s);
    const { cols, rows, shift, s: raw } = bestFor(g);
    const s = Math.max(28, raw);
    const step = s + g;
    const totalW = cols * s + (cols - 1) * g + shift * step;
    const totalH = s + (rows - 1) * ROW * step;
    const x0 = (W - totalW) / 2;
    const y0 = (H - totalH) / 2;
    // Lodrätt: lika många rader som behövs för att fylla kolumnerna uppifrån
    const colRows = Math.ceil(n / cols);
    return Array.from({ length: n }, (_, i) => {
      let r = Math.floor(i / cols);
      let c = i % cols;
      if (opts.hexOrder === 'snake' && r % 2) c = cols - 1 - c;
      if (opts.hexOrder === 'cols') { c = Math.floor(i / colRows); r = i % colRows; }
      return { x: x0 + c * step + (r % 2) * shift * step, y: y0 + r * ROW * step, w: s, h: s, font: s * 0.2 };
    });
  },

  // Bollar i halvcirklar (bågar) ovanför en viloplats längst ned i mitten: alla bollar på en båge
  // ligger lika långt från viloplatsen. Yttersta bågen först, från vänster till höger, sedan inåt.
  arc(n, W, H, gap) {
    // Hur många bollar ryms med storleken s (och mellanrummet g)? Bågarna räknas utifrån och in.
    const arcsFor = (s, g) => {
      const R = Math.min(W / 2 - s / 2, H - s); // yttersta bågens radie (bollarnas mitt)
      const arcs = [];
      let total = 0;
      for (let r = R; r >= s * 1.6 && total < n; r -= s + g) {
        const fit = Math.floor((Math.PI * r) / (s + g)) + 1;
        arcs.push({ r, fit });
        total += fit;
      }
      return { arcs, total };
    };
    // Största bollen där alla får plats (binärsökning), mellanrummet krymps vid behov
    const best = (g) => {
      let lo = 12;
      let hi = Math.min(W / 2, H, 200);
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (arcsFor(mid, g).total >= n) lo = mid; else hi = mid;
      }
      return lo;
    };
    const { g, s } = fitGap(gap, MIN_BALL, best);
    const { arcs } = arcsFor(s, g);
    // Fördela bollarna på bågarna i proportion till hur många som ryms, de yttre fylls först
    const cap = arcs.reduce((a, b) => a + b.fit, 0);
    let left = n;
    const counts = arcs.map((a, j) => {
      const c = j === arcs.length - 1 ? left : Math.min(a.fit, left, Math.round((n * a.fit) / cap));
      left -= c;
      return c;
    });
    const cx = W / 2;
    const cy = H - s / 2; // bågarnas mittpunkt (viloplatsen), i höjd med de nedersta bollarna
    const out = [];
    arcs.forEach((a, j) => {
      const c = counts[j];
      for (let i = 0; i < c; i++) {
        const ang = c === 1 ? -Math.PI / 2 : Math.PI + (i * Math.PI) / (c - 1);
        out.push({ x: cx + a.r * Math.cos(ang) - s / 2, y: cy + a.r * Math.sin(ang) - s / 2, w: s, h: s, font: s * 0.2 });
      }
    });
    out.hole = { x: cx, y: cy, r: Math.max(s * 0.6, (arcs.at(-1)?.r ?? s) - s / 2 - g) };
    return out;
  },

  // Långa strängar. Lodrätt (standard): sida vid sida, från vänster (lägst) till höger.
  // Vågrätt (opts.stringDir 'h'): staplade, nerifrån (lägst) och upp.
  // opts.stringLength = strängarnas längd som andel av höjden (eller bredden, vågrätt).
  strings(n, W, H, gap, opts) {
    if (opts.stringDir === 'h') {
      // Samma uträkning med ytan vriden ett kvarts varv
      return LAYOUTS.strings(n, H, W, gap, { ...opts, stringDir: 'v' }).map((r) => ({
        x: r.y, y: H - r.x - r.w, w: r.h, h: r.w, font: r.font,
      }));
    }
    const MAX = 120;
    const { g, s: fitted } = fitGap(gap, MIN_STRING, (g) => (W - g * (n - 1)) / n);
    let s = Math.max(12, Math.min(fitted, MAX));
    let gg = g;
    if (n * s + (n - 1) * gg > W) {
      // Många strängar på smal skärm: minsta mellanrum och dela bredden lika
      gg = Math.min(g, 3);
      s = (W - gg * (n - 1)) / n;
    }
    const x0 = (W - (n * s + (n - 1) * gg)) / 2;
    const h = H * opts.stringLength;
    return Array.from({ length: n }, (_, i) => ({
      x: x0 + i * (s + gg), y: (H - h) / 2, w: s, h, font: Math.min(14, s * 0.6),
    }));
  },
};
