// Läge på rutan (avancerat): var på rutan pekaren är styr en parameter medan rutan låter.
//  - Rutnät och Bikupa: från rutans nederkant (0) till överkant (1)
//  - Cirkel, Ring och Båge: från innerkanten (den sida som vetter mot mitten) och utåt
//  - Strängar på Toner: längs strängen (lodräta: nederkant → överkant, vågräta: vänster → höger)
//  - Strängar på Ackord: tvärs över strängen (lodräta: vänster → höger, vågräta: nederkant → överkant)
// Ljudet ändras mjukt i varje röst (Synth.noteOn → stop.pos). MIDI skickar samma sak som CC eller pitch bend.

const POS_MIDI = { filter: ['cc', 74], volume: ['cc', 11], vibrato: ['cc', 1], bend: ['bend'], timbre: ['cc', 2], timbre2: ['cc', 71] };
const posParam = () => ui.posParam.value;
const posOn = () => posParam() !== 'off';

// Senaste läget för varje pekare (mus, finger, blick)
const pointerXY = new Map();
let posLast = null;
let posMidiLast = -1;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Mittpunkten som Cirkel och Båge är ordnade runt (Båge: viloplatsen längst ned)
function formationCenter(container, f) {
  const cr = container.getBoundingClientRect();
  const x0 = cr.left + container.clientLeft;
  const y0 = cr.top + container.clientTop;
  if (f === 'arc') {
    return {
      x: x0 + parseFloat(container.style.getPropertyValue('--hole-x')),
      y: y0 + parseFloat(container.style.getPropertyValue('--hole-y')),
    };
  }
  const cs = getComputedStyle(container);
  const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
  const pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
  return {
    x: x0 + pl + (container.clientWidth - pl - pr) / 2,
    y: y0 + pt + (container.clientHeight - pt - pb) / 2,
  };
}

// Ljudmotorns egna val (klang 1 och 2) får namn efter vald motor (ENGINE_CTLS i js/synth.js).
function syncPosOptions() {
  const model = synthParams.model in ENGINE_CTLS ? synthParams.model : 'osc';
  const engineName = SYNTH_PARAMS[0].options.find(([v]) => v === model)?.[1] || '';
  const group = $('pos-engine');
  group.label = `Ljudmotorn (${engineName})`;
  group.querySelectorAll('option').forEach((o, i) => { o.textContent = ENGINE_CTLS[model][i]; });
}

// 0..1: var på rutan punkten (x, y) ligger, enligt formationen
function padPos(pad, x, y) {
  const r = pad.el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const f = ui.formation.value;
  const container = pad.el.parentElement;
  const fromBottom = () => clamp01((r.bottom - y) / r.height);
  if (f === 'strings') {
    const h = ui.stringDir.value === 'h';
    const fromLeft = () => clamp01((x - r.left) / r.width);
    // Toner: längs strängen. Ackord: tvärs över, eftersom harpan dras längs strängen.
    if (container.id === 'pads') return h ? fromLeft() : fromBottom();
    return h ? fromBottom() : fromLeft();
  }
  if (f === 'ring') {
    // Varje sektor är en hel kvadrat runt ringens mitt (klippt till sin form)
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    const inner = parseFloat(container.style.getPropertyValue('--hole-r')) || 0;
    return clamp01((Math.hypot(x - cx, y - cy) - inner) / Math.max(1, R - inner));
  }
  if (f === 'circle' || f === 'arc') {
    const c = formationCenter(container, f);
    const bx = r.left + r.width / 2, by = r.top + r.height / 2;
    const len = Math.hypot(bx - c.x, by - c.y);
    if (!(len > 1)) return fromBottom(); // en ensam boll mitt på ytan
    const d = ((x - bx) * (bx - c.x) + (y - by) * (by - c.y)) / len; // längs riktningen ut från mitten
    return clamp01(0.5 + d / r.width);
  }
  return fromBottom(); // Rutnät och Bikupa
}

// Ge rutans ljud ett nytt läge. first = precis när tonen börjar (sätts direkt, utan glidning).
function posApply(pad, x, first = false) {
  if (x == null || !pad.posTarget) return;
  if (!first && pad.posX != null && Math.abs(x - pad.posX) < 0.004) return;
  pad.posX = x;
  pad.posTarget(x, first);
  if (typeof seqPosMove === 'function') seqPosMove(pad, x); // stegsequencern minns läget (js/seq.js)
}

// En ruta börjar låta: läget tas från pekaren som ligger över den
function posStart(pad) {
  if (!posOn() || !pad.posTarget) return;
  for (const { x, y } of pointerXY.values()) {
    if (padAt(x, y) === pad) { posApply(pad, padPos(pad, x, y), true); return; }
  }
}

// Läget för en enskild röst (harpans knäppta toner)
function posForVoice(pad, stop) {
  if (!posOn() || !posLast || !stop || !stop.pos) return;
  const x = padPos(pad, posLast.x, posLast.y);
  if (x != null) stop.pos(x, posParam(), true);
}

function posMidi(x) {
  const m = POS_MIDI[posParam()];
  if (!m) return;
  const ch = midiChannel();
  if (m[0] === 'cc') {
    const v = Math.round(x * 127);
    if (v === posMidiLast) return;
    posMidiLast = v;
    sendMidi([0xb0 | ch, m[1], v]);
  } else {
    const v = Math.min(16383, Math.round(8192 + x * 8191)); // upp till en helton med vanlig böjning ±2
    if (v === posMidiLast) return;
    posMidiLast = v;
    sendMidi([0xe0 | ch, v & 127, v >> 7]);
  }
}

// När inget låter längre: pitch bend tillbaka till mitten
function posReleased() {
  if (posParam() !== 'bend' || !ui.outMidi.checked) return;
  if (allPads().some((p) => p.posTarget)) return;
  posMidiLast = -1;
  sendMidi([0xe0 | midiChannel(), 0, 64]);
}

function setupPosition() {
  const note = (e) => {
    const p = { x: e.clientX, y: e.clientY };
    pointerXY.set(e.pointerId, p);
    posLast = p;
  };
  // Fångas först (före pointerenter och rutornas egna lyssnare), så att en ruta som börjar låta
  // redan vet var pekaren är
  ['pointerover', 'pointerdown'].forEach((t) => window.addEventListener(t, note, { capture: true, passive: true }));
  window.addEventListener('pointermove', (e) => {
    note(e);
    if (!posOn()) return;
    const pad = padAt(e.clientX, e.clientY);
    if (pad) posApply(pad, padPos(pad, e.clientX, e.clientY));
  }, { capture: true, passive: true });
  const gone = (e) => { if (e.pointerType !== 'mouse') pointerXY.delete(e.pointerId); };
  window.addEventListener('pointerup', gone, true);
  window.addEventListener('pointercancel', gone, true);

  // Byter man parameter mitt i spelet: allt som låter går över till den nya
  ui.posParam.addEventListener('change', () => {
    posMidiLast = -1;
    allPads().forEach((p) => { if (p.posTarget) p.posTarget(posOn() ? p.posX ?? 1 : 1, false); });
    if (!posOn()) allPads().forEach((p) => { p.posX = null; });
    $('pos-hint').hidden = !posOn();
    syncPosOptions();
  });
  $('pos-hint').hidden = !posOn();
  syncPosOptions();
}
