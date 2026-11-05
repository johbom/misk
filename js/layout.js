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
  strings: svgIcon([0, 1, 2, 3, 4].map((i) =>
    `<line x1="${8 + i * 8}" y1="4" x2="${8 + i * 8}" y2="32" stroke-width="2" stroke-linecap="round"/>`).join('')),
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
    const s = Math.max(28, Math.min(fitted, R0 * 0.75));
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
    // Mellanrummet får ta högst knappt halva bågen, annars försvinner sektorerna
    const g = Math.min(opts.ringGap, mid * step * 0.45);
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
  hex(n, W, H, gap) {
    const ROW = Math.sqrt(3) / 2; // radavstånd i ett tätpackat mönster
    const bestFor = (g) => {
      let best = null;
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const shift = rows > 1 ? 0.5 : 0;
        const sW = (W - (cols - 1 + shift) * g) / (cols + shift);
        const sH = (H - (rows - 1) * ROW * g) / (1 + (rows - 1) * ROW);
        const s = Math.min(sW, sH);
        if (!best || s > best.s) best = { s, cols, rows, shift };
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
    return Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      return { x: x0 + c * step + (r % 2) * shift * step, y: y0 + r * ROW * step, w: s, h: s, font: s * 0.2 };
    });
  },

  // Långa lodräta strängar sida vid sida, från vänster (lägst) till höger.
  // opts.stringLength = strängarnas längd som andel av höjden (centrerade lodrätt).
  strings(n, W, H, gap, opts) {
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
