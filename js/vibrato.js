// Vibrato: vickar man pekaren fram och tillbaka (eller upp och ned) över en ruta som låter,
// blir det ett försiktigt pitchvibrato – som när en stråkmusiker vickar fingret på strängen.
//
// Varje vändning (pekaren byter riktning efter att ha rört sig minst WIGGLE_MIN_PX) räknas.
// Flera vändningar i rad = vibrato. Djupet växer med hur ihärdigt man vickar (högst det valda
// djupet i cent), takten följer hur fort man vickar, och vibratot tonar ut när man slutar.
// Små ryck (darr, blickens mikrorörelser) och ett vanligt svep räknas inte.

const WIGGLE_MIN_PX = 6; // minsta rörelse åt andra hållet för att räknas som en vändning
const WIGGLE_WINDOW_MS = 700; // vändningar äldre än så här glöms bort
const wiggles = new Map(); // pointerId -> { pad, x, y, turns, depth }
let wiggleTimer = 0;

// XY-plattan: en låtsasruta per pekare, så att vickning ger vibrato där också
const xyPseudo = new Map();
function xyPseudoPad(id) {
  if (document.body.dataset.tab !== 'xy' || !(xy.voices.has(id) || xyArp.pts.has(id))) return null;
  if (!xyPseudo.has(id)) xyPseudo.set(id, { el: xy.el, vibrato: (c, r) => xyVibrato(id, c, r) });
  return xyPseudo.get(id);
}

const padOfEl = (el) => {
  const e = el instanceof Element ? el.closest('.pad') : null;
  return e ? allPads().find((p) => p.el === e) || null : null;
};

// Följer en axel: ytterpunkten åt det håll man rör sig, och när man vänder
function trackAxis(st, a, v, now) {
  if (a.ext === null) { a.ext = v; return; }
  const d = v - a.ext;
  if (!a.dir) {
    if (Math.abs(d) >= WIGGLE_MIN_PX) { a.dir = Math.sign(d); a.ext = v; }
  } else if (Math.sign(d) === a.dir) {
    a.ext = v; // fortsätter åt samma håll: ny ytterpunkt
  } else if (Math.abs(d) >= WIGGLE_MIN_PX) {
    a.dir = -a.dir; // vänt
    a.ext = v;
    st.turns.push(now);
  }
}

function applyWiggle(st, now) {
  st.turns = st.turns.filter((t) => now - t < WIGGLE_WINDOW_MS);
  const n = st.turns.length;
  const max = Number(ui.vibrato.value) || 0;
  // En vändning kan vara slumpen; från två börjar vibratot och når fullt djup efter fyra
  const depth = n >= 2 ? max * Math.min(1, (n - 1) / 3) : 0;
  let rate = 0;
  if (n >= 2) {
    const half = (st.turns[n - 1] - st.turns[0]) / (n - 1); // ms mellan vändningar = halv period
    rate = Math.min(8, Math.max(3, 1000 / (2 * half)));
  }
  if (Math.abs(depth - st.depth) < 0.5 && !rate) return;
  st.depth = depth;
  if (st.pad.vibrato) st.pad.vibrato(depth, rate);
  st.pad.el.classList.toggle('vibrato', depth > 0);
}

function stopWiggle(id) {
  const st = wiggles.get(id);
  if (!st) return;
  if (st.pad.vibrato) st.pad.vibrato(0);
  st.pad.el.classList.remove('vibrato');
  wiggles.delete(id);
}

// Tonar ut vibratot när man slutat vicka
function tickWiggles() {
  const now = performance.now();
  for (const [id, st] of wiggles) {
    applyWiggle(st, now);
    if (!st.turns.length && !st.depth) stopWiggle(id);
  }
  if (!wiggles.size) { clearInterval(wiggleTimer); wiggleTimer = 0; }
}

function setupVibrato() {
  document.addEventListener('pointermove', (e) => {
    if (!Number(ui.vibrato.value) || scanning()) return;
    const pad = padOfEl(e.target) || xyPseudoPad(e.pointerId);
    let st = wiggles.get(e.pointerId);
    if (st && st.pad !== pad) { stopWiggle(e.pointerId); st = null; }
    if (!pad || !pad.vibrato || (strum.harp && strum.pad === pad)) return; // tyst ruta eller harpa
    if (!st) {
      st = { pad, x: { ext: null, dir: 0 }, y: { ext: null, dir: 0 }, turns: [], depth: 0 };
      wiggles.set(e.pointerId, st);
    }
    const now = performance.now();
    const before = st.turns.length;
    trackAxis(st, st.x, e.clientX, now);
    trackAxis(st, st.y, e.clientY, now);
    if (st.turns.length !== before) {
      applyWiggle(st, now);
      if (!wiggleTimer) wiggleTimer = setInterval(tickWiggles, 100);
    }
  }, { passive: true });
  const end = (e) => stopWiggle(e.pointerId);
  document.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') end(e); });
  document.addEventListener('pointercancel', end);
}
