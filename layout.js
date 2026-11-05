// Formationer för rutorna. Rutnät sköts av CSS grid; de andra räknas ut här
// och placeras med absoluta positioner inne i sin behållare.
//
// Varje funktion får: n (antal rutor), W och H (ytan i px), gap (mellanrum i px)
// och returnerar en lista med { x, y, w, h, font } – en per ruta, i spelordning.

const FORMATIONS = {
  grid: 'Rutnät',
  circle: 'Cirkel (bollar)',
  hex: 'Bikupa (bollar)',
  strings: 'Strängar',
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
  strings(n, W, H, gap) {
    const MAX = 120;
    const { g, s: fitted } = fitGap(gap, MIN_STRING, (g) => (W - g * (n - 1)) / n);
    const s = Math.max(12, Math.min(fitted, MAX));
    const x0 = (W - (n * s + (n - 1) * g)) / 2;
    return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (s + g), y: 0, w: s, h: H, font: 14 }));
  },
};
