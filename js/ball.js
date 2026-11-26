// Bollar som pekare (bara i den avancerade versionen).
//
// 1–5 bollar rör sig "fysiskt" över spelytan (Toner, Ackord och XY): de faller med gravitationen, studsar mot
// kanterna och mot varandra och spelar det de rör sig över – precis som fingrar. Rutan under en boll spelar,
// harpan knäpps när en boll rullar längs en sträng, och på XY är varje boll en egen röst.
//  - Ta tag i en boll (tryck och dra): den följer med pekaren. Släpp i farten så kastas den.
//    Med flera fingrar går det att hålla flera bollar samtidigt.
//  - Med bara pekaren (hover, blick): för pekaren in i en boll så knuffas den. Pekaren är som en pinne
//    som bollarna studsar mot – står pekaren still kan en boll till och med vila på den.
//  - Luta enheten (telefon, surfplatta): bollarna faller åt det håll som är nedåt. Ligger enheten platt
//    svävar de; ju mer den lutar, desto starkare drar det.
// Medan bollarna är på spelar pekaren inte själv: ett genomskinligt lager över spelytan tar emot den,
// så att det bara är bollarna som spelar.

const BALL_IDS = ['ball', 'ball2', 'ball3', 'ball4', 'ball5']; // pekarnas id (rutor, XY, harpa, läge på rutan)
const BALL_COLORS = ['#ffb547', '#5bd1ff', '#ff6b9a', '#7be3a0', '#c89bff'];
const BALL_G_MAX = 3000; // px/s² vid 100 % (40 %: faller en vanlig spelyta på knappt en sekund)
const BALL_V_MAX = 6000; // px/s, högsta fart
const BALL_STEP = 1 / 240; // s, fysikens tidssteg (flera per bildruta: inga studsar missas)
const BALL_AIR = 0.15; // luftmotstånd per sekund
const BALL_ROLL = 1.4; // rullmotstånd per sekund när en boll ligger mot "golvet"
const BALL_POKE = 6; // px: pekarens "tjocklek" när den knuffar en boll

const isBallId = (id) => typeof id === 'string' && id.startsWith('ball');

const ballState = {
  balls: [], // { id, x, y, vx, vy, el, grab, played } – i spelytans px, från övre vänstra hörnet
  r: 20, // radie (alla bollar är lika stora)
  w: 0, h: 0, // spelytans storlek (bollarna flyttas med när den ändras)
  tab: '', // sidan bollarna spelar på just nu
  raf: 0, idle: 0, last: 0,
  pokers: new Map(), // pointerId -> { x, y, vx, vy, t }: pekare som svävar över spelytan (knuffar)
  tilt: null, // { x, y }: gravitationens riktning och styrka (0–1) från enhetens lutning, eller null
  tiltListening: false,
  layer: null,
};

const ballOn = () => ui.ballOn.checked && !simpleApp();
const ballActive = () => ballOn() && isPlayTab() && $('start-overlay').classList.contains('hidden');

function ballSurface() {
  return { notes: $('pads'), chords: $('chord-pads'), xy: $('xy-pad') }[document.body.dataset.tab] || null;
}

// ---------- Knappen, reglagen och lagret ----------
function ballSync() {
  const on = ballOn();
  const b = $('ball-toggle');
  b.classList.toggle('on', ui.ballOn.checked);
  b.setAttribute('aria-pressed', ui.ballOn.checked);
  $('ball-count-value').textContent = ui.ballCount.value;
  $('ball-size-value').textContent = `${ui.ballSize.value} %`;
  $('ball-gravity-value').textContent = `${ui.ballGravity.value} %`;
  $('ball-bounce-value').textContent = `${ui.ballBounce.value} %`;
  if (on && ui.ballTilt.checked) ballTiltListen();
  if (!ui.ballTilt.checked) ballState.tilt = null;
  if (on && !ballState.raf && !ballState.idle) { ballState.last = 0; ballState.raf = requestAnimationFrame(ballFrame); }
  if (!on) ballHide();
  else ballCount();
}

function ballHide() {
  const S = ballState;
  S.balls.forEach(ballLift);
  S.layer.hidden = true;
  S.balls.forEach((bl) => { bl.grab = null; });
  S.pokers.clear();
  S.tab = '';
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
  clearTimeout(S.idle);
  S.idle = 0;
}

// Bollen slutar spela (byte av sida, av, startrutan, färre bollar)
function ballLift(bl) {
  liftFinger(bl.id);
  xyVoiceStop(bl.id);
  const tr = xy.trails.get(bl.id);
  if (tr) { xy.trails.delete(bl.id); xy.trails.set(`${bl.id}-${performance.now()}`, tr); } // spåret bleknar för sig
  strums.delete(bl.id);
  pointerXY.delete(bl.id);
  bl.played = null;
}

// Rätt antal bollar: nya faller in uppifrån, de sista tas bort
function ballCount() {
  const S = ballState;
  const n = Math.max(1, Math.min(BALL_IDS.length, Number(ui.ballCount.value) || 1));
  while (S.balls.length > n) {
    const bl = S.balls.pop();
    ballLift(bl);
    bl.el.remove();
  }
  while (S.balls.length < n) {
    const i = S.balls.length;
    const el = document.createElement('div');
    el.className = 'ball';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--ball-color', BALL_COLORS[i]);
    S.layer.append(el);
    const bl = { id: BALL_IDS[i], x: 0, y: 0, vx: 0, vy: 0, el, grab: null, played: null };
    S.balls.push(bl);
    if (S.w) ballDrop(bl);
  }
}

// Ny boll: överst (eller "högst upp" med lutningen), utspridda över bredden
function ballDrop(bl) {
  const S = ballState;
  const i = S.balls.indexOf(bl);
  const n = S.balls.length;
  bl.x = S.w * ((i + 0.5) / Math.max(n, 1)) + (Math.random() - 0.5) * 20;
  bl.y = S.r + 4;
  bl.vx = (Math.random() - 0.5) * 120;
  bl.vy = 0;
  ballClamp(bl);
}

// ---------- Lutning (telefon, surfplatta) ----------
// deviceorientation: beta lutar framåt/bakåt, gamma åt sidorna. Gravitationen i skärmens plan blir
// (sin γ · cos β, sin β) i stående läge, och vrids sedan med skärmens rotation.
function ballOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  const rad = Math.PI / 180;
  const b = e.beta * rad;
  const g = e.gamma * rad;
  const px = Math.sin(g) * Math.cos(b);
  const py = Math.sin(b);
  const ang = (screen.orientation?.angle ?? window.orientation ?? 0) * rad;
  ballState.tilt = {
    x: px * Math.cos(ang) + py * Math.sin(ang),
    y: -px * Math.sin(ang) + py * Math.cos(ang),
  };
}

// iPhone och iPad frågar om lov, och bara efter ett tryck: då frågar vi vid nästa tryck
async function ballTiltListen() {
  const S = ballState;
  if (S.tiltListening || typeof DeviceOrientationEvent === 'undefined') return;
  const ask = DeviceOrientationEvent.requestPermission;
  if (typeof ask === 'function') {
    if (!navigator.userActivation?.isActive) { ballTiltAskOnTap(); return; }
    let ok = 'denied';
    try { ok = await ask.call(DeviceOrientationEvent); } catch { ballTiltAskOnTap(); return; }
    if (ok !== 'granted') { log(t('Lutningen fick inte användas')); return; }
  }
  if (S.tiltListening) return;
  S.tiltListening = true;
  window.addEventListener('deviceorientation', ballOrientation);
}

let ballTiltAsking = false;
function ballTiltAskOnTap() {
  if (ballTiltAsking) return;
  ballTiltAsking = true;
  window.addEventListener('pointerup', () => {
    ballTiltAsking = false;
    if (ui.ballTilt.checked && ballOn()) ballTiltListen();
  }, { once: true, capture: true });
}

// ---------- Bildrutorna ----------
function ballFrame(now) {
  const S = ballState;
  S.raf = 0;
  if (!ballOn()) { ballHide(); return; }
  const surf = ballSurface();
  const rect = surf?.getBoundingClientRect();
  if (!ballActive() || !rect || rect.width < 40 || rect.height < 40) {
    // Inte på en spelsida just nu: titta efter igen om en stund (sidbyte, startrutan)
    if (S.tab) S.balls.forEach(ballLift);
    S.tab = '';
    S.layer.hidden = true;
    S.idle = setTimeout(() => { S.idle = 0; S.raf = requestAnimationFrame(ballFrame); }, 200);
    return;
  }
  const tab = document.body.dataset.tab;
  if (tab !== S.tab) { S.balls.forEach(ballLift); S.tab = tab; }
  ballPlace(rect);
  const dt = S.last ? Math.min(0.05, (now - S.last) / 1000) : 0;
  S.last = now;
  ballStep(dt);
  S.balls.forEach(ballDraw);
  ballPlay(rect);
  S.raf = requestAnimationFrame(ballFrame);
}

// Lagret täcker spelytan; ändras ytans storlek flyttas bollarna med
function ballPlace(rect) {
  const S = ballState;
  const L = S.layer;
  if (L.hidden) L.hidden = false;
  L.style.left = `${rect.left}px`;
  L.style.top = `${rect.top}px`;
  L.style.width = `${rect.width}px`;
  L.style.height = `${rect.height}px`;
  const fresh = !S.w;
  if (!fresh && (rect.width !== S.w || rect.height !== S.h)) {
    S.balls.forEach((bl) => { bl.x *= rect.width / S.w; bl.y *= rect.height / S.h; });
  }
  S.w = rect.width;
  S.h = rect.height;
  const base = Math.max(14, Math.min(34, Math.min(S.w, S.h) * 0.035));
  S.r = Math.max(6, Math.min(Math.min(S.w, S.h) / 4, base * (Number(ui.ballSize.value) || 100) / 100));
  if (fresh) S.balls.forEach(ballDrop);
  S.balls.forEach(ballClamp);
}

function ballClamp(bl) {
  const { r, w, h } = ballState;
  bl.x = Math.max(r, Math.min(w - r, bl.x));
  bl.y = Math.max(r, Math.min(h - r, bl.y));
}

// Gravitationen just nu (px/s²): nedåt på skärmen, eller dit enheten lutar
function ballGravity() {
  const g = (Number(ui.ballGravity.value) / 100) * BALL_G_MAX;
  const tl = ui.ballTilt.checked ? ballState.tilt : null;
  return tl ? { x: g * tl.x, y: g * tl.y } : { x: 0, y: g };
}

function ballStep(dt) {
  const S = ballState;
  if (!dt) return;
  const G = ballGravity();
  const e = Number(ui.ballBounce.value) / 100;
  const { r } = S;
  const free = S.balls.filter((bl) => !bl.grab); // den som hålls följer pekaren (ballPointerMove)
  // Kanterna: normalen in mot ytan. Trycker gravitationen bollen mot kanten är det "golvet":
  // under en viss fart (mindre än en pixels studs) ligger bollen still mot den, och den rullar ut.
  const walls = [
    { nx: 1, ny: 0, hit: (bl) => bl.x < r, put: (bl) => { bl.x = r; } },
    { nx: -1, ny: 0, hit: (bl) => bl.x > S.w - r, put: (bl) => { bl.x = S.w - r; } },
    { nx: 0, ny: 1, hit: (bl) => bl.y < r, put: (bl) => { bl.y = r; } },
    { nx: 0, ny: -1, hit: (bl) => bl.y > S.h - r, put: (bl) => { bl.y = S.h - r; } },
  ].map((wl) => {
    const push = -(G.x * wl.nx + G.y * wl.ny); // hur hårt gravitationen trycker mot kanten
    return { ...wl, push, rest: push > 0 ? Math.sqrt(2 * push * 1) : 0 };
  });
  for (let left = dt; left > 1e-6; left -= BALL_STEP) {
    const h = Math.min(left, BALL_STEP);
    const air = Math.exp(-BALL_AIR * h);
    for (const bl of free) {
      bl.vx = (bl.vx + G.x * h) * air;
      bl.vy = (bl.vy + G.y * h) * air;
      bl.x += bl.vx * h;
      bl.y += bl.vy * h;
      for (const wl of walls) {
        if (!wl.hit(bl)) continue;
        wl.put(bl);
        let vn = bl.vx * wl.nx + bl.vy * wl.ny; // fart in mot kanten är negativ
        if (vn < 0) { bl.vx -= (1 + e) * vn * wl.nx; bl.vy -= (1 + e) * vn * wl.ny; vn = -vn * e; }
        if (wl.push > 0 && vn <= wl.rest) {
          bl.vx -= vn * wl.nx; // ligger mot golvet
          bl.vy -= vn * wl.ny;
          const roll = Math.exp(-BALL_ROLL * h); // och rullar ut längs det
          const tx = bl.vx * wl.ny * wl.ny;
          const ty = bl.vy * wl.nx * wl.nx;
          bl.vx += tx * (roll - 1);
          bl.vy += ty * (roll - 1);
        }
      }
      // Pekare som svävar över ytan är som pinnar: bollarna studsar mot dem
      for (const p of S.pokers.values()) {
        const moving = performance.now() - p.t < 60;
        ballHit(bl, p.x, p.y, moving ? p.vx : 0, moving ? p.vy : 0, e);
      }
    }
    ballCollide(e);
  }
  for (const bl of free) {
    const v = Math.hypot(bl.vx, bl.vy);
    if (v > BALL_V_MAX) { bl.vx *= BALL_V_MAX / v; bl.vy *= BALL_V_MAX / v; }
  }
}

// Bollarna mot varandra (lika tunga). En boll som hålls i är som en vägg som rör sig med pekaren.
function ballCollide(e) {
  const S = ballState;
  const d0 = S.r * 2;
  for (let i = 0; i < S.balls.length; i++) {
    for (let j = i + 1; j < S.balls.length; j++) {
      const a = S.balls[i];
      const b = S.balls[j];
      if (a.grab && b.grab) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d >= d0) continue;
      const nx = d > 0.01 ? dx / d : 1;
      const ny = d > 0.01 ? dy / d : 0;
      const over = d0 - d;
      const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (a.grab || b.grab) {
        const [m, s] = a.grab ? [b, -1] : [a, 1]; // m: den som rör sig fritt; s: åt vilket håll normalen pekar för den
        m.x += s * nx * over;
        m.y += s * ny * over;
        ballClamp(m);
        if (vrel < 0) { const k = -(1 + e) * vrel; m.vx += s * k * nx; m.vy += s * k * ny; }
        continue;
      }
      a.x += nx * over / 2; a.y += ny * over / 2;
      b.x -= nx * over / 2; b.y -= ny * over / 2;
      ballClamp(a);
      ballClamp(b);
      if (vrel < 0) {
        const k = -(1 + e) * vrel / 2;
        a.vx += k * nx; a.vy += k * ny;
        b.vx -= k * nx; b.vy -= k * ny;
      }
    }
  }
}

// En boll mot en punkt (pekaren) som rör sig med farten pvx, pvy: skjuts ut och studsar
function ballHit(bl, px, py, pvx, pvy, e) {
  const dx = bl.x - px;
  const dy = bl.y - py;
  const d = Math.hypot(dx, dy);
  const reach = ballState.r + BALL_POKE;
  if (d >= reach) return false;
  const nx = d > 0.01 ? dx / d : 0;
  const ny = d > 0.01 ? dy / d : -1;
  bl.x = px + nx * reach;
  bl.y = py + ny * reach;
  ballClamp(bl);
  const vrel = (bl.vx - pvx) * nx + (bl.vy - pvy) * ny;
  if (vrel < 0) {
    const k = -(1 + Math.max(0.5, e)) * vrel; // en knuff studsar alltid lite, även med låg studs
    bl.vx += k * nx;
    bl.vy += k * ny;
  }
  return true;
}

function ballDraw(bl) {
  const { r } = ballState;
  bl.el.style.width = bl.el.style.height = `${r * 2}px`;
  bl.el.style.transform = `translate(${bl.x - r}px, ${bl.y - r}px)`;
}

// ---------- Spela: varje boll är en pekare ----------
const ballXyPlaying = (id) => xy.voices.has(id) || xyGrains.has(id) || xyArp.pts.has(id);

function ballPlay(rect) {
  const S = ballState;
  const moved = S.balls.filter((bl) => {
    const cx = rect.left + bl.x;
    const cy = rect.top + bl.y;
    const still = bl.played && Math.abs(bl.played.x - cx) < 0.5 && Math.abs(bl.played.y - cy) < 0.5;
    if (still && (S.tab !== 'xy' || ballXyPlaying(bl.id) || !audioCtx)) return false; // inget nytt att spela
    bl.played = { x: cx, y: cy };
    pointerXY.set(bl.id, { x: cx, y: cy });
    return true;
  });
  if (!moved.length) return;
  if (S.tab === 'xy') {
    moved.forEach((bl) => {
      const nx = bl.x / S.w;
      const ny = 1 - bl.y / S.h;
      if (!ballXyPlaying(bl.id)) xyVoiceStart(bl.id, nx, ny);
      else xyVoiceMove(bl.id, nx, ny);
      xyTrail(bl.id, bl.x / S.w, bl.y / S.h);
    });
    return;
  }
  // Rutan under bollen. Lagret och en öppen snabbruta (Effekter, Arp, Tonart …) släpper igenom träffen
  // så länge: bollar som rullar bakom snabbrutan spelar också.
  const pop = $('quick-pop');
  S.layer.style.pointerEvents = 'none';
  pop.style.pointerEvents = 'none';
  try {
    const harp = S.tab === 'chords' && ui.formation.value === 'strings' && !picker.open && !scanning();
    moved.forEach(({ id, played: { x: cx, y: cy } }) => {
      const pad = padAt(cx, cy);
      moveFinger(id, pad);
      if (pad && posOn()) posApply(pad, padPos(pad, cx, cy));
      // Harpan (Ackord, Strängar): bollen knäpper tonerna den rullar över, som ett finger
      if (harp) {
        strumOf(id).active = true;
        strumMove({ type: 'ball', pointerId: id, pointerType: 'ball', buttons: 1, clientX: cx, clientY: cy, target: S.layer });
      }
    });
  } finally {
    S.layer.style.pointerEvents = '';
    pop.style.pointerEvents = '';
  }
}

// Alla rutor har släppts (en snabbruta öppnades): bollarna som ligger på en ruta spelar den igen
function ballRetouch() {
  if (!ballState.tab || ballState.tab === 'xy') return;
  ballState.balls.forEach((bl) => {
    moveFinger(bl.id, null);
    strums.delete(bl.id);
    bl.played = null;
  });
}

// ---------- Ta tag, dra och kasta – eller knuffa ----------
function ballLocal(e) {
  const r = ballState.layer.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp || performance.now() };
}

// Närmaste boll som går att ta tag i (lite större än bollen, så att den är lätt att träffa)
function ballNearest(p, free = true) {
  let best = null;
  let bestD = ballState.r * 1.4 + 8;
  for (const bl of ballState.balls) {
    if (free && bl.grab) continue;
    const d = Math.hypot(p.x - bl.x, p.y - bl.y);
    if (d <= bestD) { bestD = d; best = bl; }
  }
  return best;
}

const ballHeld = (pointerId) => ballState.balls.find((bl) => bl.grab?.id === pointerId) || null;

function ballGrabStart(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.stopPropagation(); // rutorna, harpan och stegningen under lagret ska inte få trycket
  const p = ballLocal(e);
  const bl = ballNearest(p);
  if (!bl || ballHeld(e.pointerId)) return;
  e.preventDefault();
  bl.grab = { id: e.pointerId, dx: bl.x - p.x, dy: bl.y - p.y, pts: [p] };
  ballState.pokers.delete(e.pointerId);
  bl.vx = 0;
  bl.vy = 0;
  try { ballState.layer.setPointerCapture(e.pointerId); } catch {}
  bl.el.classList.add('held');
  ballState.layer.classList.add('grabbing');
}

function ballPointerMove(e) {
  const S = ballState;
  const p = ballLocal(e);
  const held = ballHeld(e.pointerId);
  if (held) {
    const g = held.grab;
    held.x = p.x + g.dx;
    held.y = p.y + g.dy;
    ballClamp(held);
    g.pts.push(p);
    while (g.pts.length > 2 && p.t - g.pts[0].t > 100) g.pts.shift();
    // Farten följer pekaren, så att en boll som hålls knuffar de andra rätt
    const a = g.pts[0];
    const dt = (p.t - a.t) / 1000;
    held.vx = dt > 0.005 ? (p.x - a.x) / dt : 0;
    held.vy = dt > 0.005 ? (p.y - a.y) / dt : 0;
    return;
  }
  S.layer.classList.toggle('near', !!ballNearest(p));
  // Knuff: pekaren rör sig in i en boll. Kollas längs hela sträckan sedan förra händelsen,
  // så att en snabb pekare inte hoppar över bollen.
  const prev = S.pokers.get(e.pointerId);
  const dt = prev ? (p.t - prev.t) / 1000 : 0;
  const vx = dt > 0.002 && dt < 0.1 ? (p.x - prev.x) / dt : 0;
  const vy = dt > 0.002 && dt < 0.1 ? (p.y - prev.y) / dt : 0;
  if (prev) {
    const sx = p.x - prev.x;
    const sy = p.y - prev.y;
    const len2 = sx * sx + sy * sy;
    const e2 = Number(ui.ballBounce.value) / 100;
    for (const bl of S.balls) {
      if (bl.grab) continue;
      const k = len2 ? Math.max(0, Math.min(1, ((bl.x - prev.x) * sx + (bl.y - prev.y) * sy) / len2)) : 1;
      ballHit(bl, prev.x + sx * k, prev.y + sy * k, vx, vy, e2);
    }
  }
  S.pokers.set(e.pointerId, { x: p.x, y: p.y, vx, vy, t: performance.now() });
}

function ballGrabEnd(e) {
  const S = ballState;
  const bl = ballHeld(e.pointerId);
  if (!bl) { S.pokers.delete(e.pointerId); return; }
  const g = bl.grab;
  bl.grab = null;
  bl.el.classList.remove('held');
  if (!S.balls.some((b) => b.grab)) S.layer.classList.remove('grabbing');
  // Kastet: farten de sista ~80 ms (stod pekaren still innan släppet blir det inget kast)
  const now = ballLocal(e).t;
  const pts = g.pts.filter((q) => now - q.t <= 80);
  bl.vx = 0;
  bl.vy = 0;
  if (e.type !== 'pointercancel' && pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    const dt = Math.max(0.016, (b.t - a.t) / 1000);
    bl.vx = (b.x - a.x) / dt;
    bl.vy = (b.y - a.y) / dt;
    const v = Math.hypot(bl.vx, bl.vy);
    if (v > BALL_V_MAX) { bl.vx *= BALL_V_MAX / v; bl.vy *= BALL_V_MAX / v; }
  }
}

function setupBall() {
  const S = ballState;
  const layer = document.createElement('div');
  layer.id = 'ball-layer';
  layer.hidden = true;
  document.body.append(layer);
  S.layer = layer;

  layer.addEventListener('pointerdown', ballGrabStart);
  layer.addEventListener('pointermove', ballPointerMove);
  layer.addEventListener('pointerup', ballGrabEnd);
  layer.addEventListener('pointercancel', ballGrabEnd);
  layer.addEventListener('pointerleave', (e) => {
    if (!ballHeld(e.pointerId)) S.pokers.delete(e.pointerId);
    layer.classList.remove('near');
  });
  layer.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => {
    S.balls.forEach((bl) => { bl.grab = null; bl.el.classList.remove('held'); });
    S.pokers.clear();
    layer.classList.remove('grabbing');
  });

  ui.ballOn.addEventListener('change', () => {
    if (ui.ballOn.checked) S.w = 0; // nya bollar faller in uppifrån
    ballSync();
    log(t(`Boll ${ui.ballOn.checked ? 'på' : 'av'}`));
  });
  ui.ballTilt.addEventListener('change', () => {
    ballSync();
    log(t(`Luta enheten ${ui.ballTilt.checked ? 'på' : 'av'}`));
  });
  [ui.ballCount, ui.ballSize, ui.ballGravity, ui.ballBounce].forEach((el) => el.addEventListener('input', ballSync));

  // Knappen öppnar och stänger rutan; av med brytaren i rutan. Är bollen av slås den på när rutan öppnas.
  $('ball-toggle').addEventListener('click', () => {
    if (quick.open === 'ball') { closeQuick(); return; }
    if (!ui.ballOn.checked) {
      ui.ballOn.checked = true;
      ui.ballOn.dispatchEvent(new Event('change'));
    }
    openQuick('ball');
  });
  ballSync();
}
