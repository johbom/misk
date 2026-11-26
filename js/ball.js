// Boll som pekare (bara i den avancerade versionen).
//
// En boll rör sig "fysiskt" över spelytan (Toner, Ackord och XY): den faller med gravitationen, studsar mot
// kanterna och spelar det den rör sig över – precis som ett finger. Rutan under bollen spelar, harpan
// knäpps när bollen rullar längs en sträng, och på XY är bollen en egen röst.
//  - Ta tag i bollen (tryck och dra): den följer med pekaren. Släpp i farten så kastas den.
//  - Med bara pekaren (hover, blick): för pekaren in i bollen så knuffas den. Pekaren är som en pinne
//    som bollen studsar mot – står pekaren still kan bollen till och med vila på den.
// Medan bollen är på spelar pekaren inte själv: ett genomskinligt lager över spelytan tar emot den,
// så att det bara är bollen som spelar.

const BALL_ID = 'ball';
const BALL_G_MAX = 3000; // px/s² vid 100 % (40 %: faller en vanlig spelyta på knappt en sekund)
const BALL_V_MAX = 6000; // px/s, högsta fart
const BALL_STEP = 1 / 240; // s, fysikens tidssteg (flera per bildruta: inga studsar missas)
const BALL_AIR = 0.15; // luftmotstånd per sekund
const BALL_ROLL = 1.4; // rullmotstånd per sekund när bollen ligger på golvet
const BALL_POKE = 6; // px: pekarens "tjocklek" när den knuffar bollen

const ball = {
  x: 0, y: 0, vx: 0, vy: 0, r: 20, // i spelytans px, från övre vänstra hörnet
  w: 0, h: 0, // spelytans storlek (bollen flyttas med när den ändras)
  tab: '', // sidan bollen spelar på just nu
  raf: 0, idle: 0, last: 0,
  grab: null, // { id, dx, dy, pts } när någon håller i bollen
  pokers: new Map(), // pointerId -> { x, y, vx, vy, t }: pekare som svävar över spelytan (knuffar)
  played: null, // { x, y } där bollen senast spelade (för att inte skicka samma läge igen)
  layer: null, el: null,
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
  $('ball-gravity-value').textContent = `${ui.ballGravity.value} %`;
  $('ball-bounce-value').textContent = `${ui.ballBounce.value} %`;
  if (on && !ball.raf && !ball.idle) { ball.last = 0; ball.raf = requestAnimationFrame(ballFrame); }
  if (!on) ballHide();
}

function ballHide() {
  ballLift();
  ball.layer.hidden = true;
  ball.grab = null;
  ball.pokers.clear();
  ball.tab = '';
  if (ball.raf) { cancelAnimationFrame(ball.raf); ball.raf = 0; }
  clearTimeout(ball.idle);
  ball.idle = 0;
}

// Bollen slutar spela (byte av sida, av, startrutan)
function ballLift() {
  liftFinger(BALL_ID);
  xyVoiceStop(BALL_ID);
  const tr = xy.trails.get(BALL_ID);
  if (tr) { xy.trails.delete(BALL_ID); xy.trails.set(`${BALL_ID}-${performance.now()}`, tr); } // spåret bleknar för sig
  strums.delete(BALL_ID);
  pointerXY.delete(BALL_ID);
  ball.played = null;
}

// Ny boll: överst på mitten, så att den faller ned
function ballDrop() {
  ball.x = ball.w / 2;
  ball.y = ball.r + 4;
  ball.vx = (Math.random() - 0.5) * 120;
  ball.vy = 0;
}

// ---------- Bildrutorna ----------
function ballFrame(now) {
  ball.raf = 0;
  if (!ballOn()) { ballHide(); return; }
  const surf = ballSurface();
  const rect = surf?.getBoundingClientRect();
  if (!ballActive() || !rect || rect.width < 40 || rect.height < 40) {
    // Inte på en spelsida just nu: titta efter igen om en stund (sidbyte, startrutan)
    if (ball.tab) ballLift();
    ball.tab = '';
    ball.layer.hidden = true;
    ball.idle = setTimeout(() => { ball.idle = 0; ball.raf = requestAnimationFrame(ballFrame); }, 200);
    return;
  }
  const tab = document.body.dataset.tab;
  if (tab !== ball.tab) { ballLift(); ball.tab = tab; }
  ballPlace(rect);
  const dt = ball.last ? Math.min(0.05, (now - ball.last) / 1000) : 0;
  ball.last = now;
  ballStep(dt);
  ballDraw();
  ballPlay(rect);
  ball.raf = requestAnimationFrame(ballFrame);
}

// Lagret täcker spelytan; ändras ytans storlek flyttas bollen med
function ballPlace(rect) {
  const L = ball.layer;
  if (L.hidden) L.hidden = false;
  L.style.left = `${rect.left}px`;
  L.style.top = `${rect.top}px`;
  L.style.width = `${rect.width}px`;
  L.style.height = `${rect.height}px`;
  const fresh = !ball.w;
  if (!fresh && (rect.width !== ball.w || rect.height !== ball.h)) {
    ball.x *= rect.width / ball.w;
    ball.y *= rect.height / ball.h;
  }
  ball.w = rect.width;
  ball.h = rect.height;
  ball.r = Math.max(14, Math.min(34, Math.min(ball.w, ball.h) * 0.035));
  if (fresh) ballDrop();
  ballClamp();
}

function ballClamp() {
  ball.x = Math.max(ball.r, Math.min(ball.w - ball.r, ball.x));
  ball.y = Math.max(ball.r, Math.min(ball.h - ball.r, ball.y));
}

function ballStep(dt) {
  if (ball.grab || !dt) return; // någon håller i bollen: den följer pekaren (ballGrabMove)
  const g = (Number(ui.ballGravity.value) / 100) * BALL_G_MAX;
  const e = Number(ui.ballBounce.value) / 100;
  // Under den här farten studsar bollen inte mot golvet (mindre än en pixel): den ligger still i stället
  const rest = Math.sqrt(2 * g * 1);
  const { r } = ball;
  for (let left = dt; left > 1e-6; left -= BALL_STEP) {
    const h = Math.min(left, BALL_STEP);
    ball.vy += g * h;
    const air = Math.exp(-BALL_AIR * h);
    ball.vx *= air;
    ball.vy *= air;
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    if (ball.x < r) { ball.x = r; if (ball.vx < 0) ball.vx = -ball.vx * e; }
    else if (ball.x > ball.w - r) { ball.x = ball.w - r; if (ball.vx > 0) ball.vx = -ball.vx * e; }
    if (ball.y < r) { ball.y = r; if (ball.vy < 0) ball.vy = -ball.vy * e; }
    else if (ball.y >= ball.h - r) {
      ball.y = ball.h - r;
      if (ball.vy > 0) ball.vy = -ball.vy * e;
      if (g > 0 && Math.abs(ball.vy) <= rest) ball.vy = 0; // ligger på golvet
      if (g > 0 && ball.vy === 0) ball.vx *= Math.exp(-BALL_ROLL * h); // och rullar ut
    }
    // Pekare som svävar över ytan är som pinnar: bollen studsar mot dem
    for (const p of ball.pokers.values()) {
      const moving = performance.now() - p.t < 60;
      ballHit(p.x, p.y, moving ? p.vx : 0, moving ? p.vy : 0, e);
    }
  }
  const v = Math.hypot(ball.vx, ball.vy);
  if (v > BALL_V_MAX) { ball.vx *= BALL_V_MAX / v; ball.vy *= BALL_V_MAX / v; }
}

// Bollen mot en punkt (pekaren) som rör sig med farten pvx, pvy: skjuts ut och studsar
function ballHit(px, py, pvx, pvy, e) {
  const dx = ball.x - px;
  const dy = ball.y - py;
  const d = Math.hypot(dx, dy);
  const reach = ball.r + BALL_POKE;
  if (d >= reach) return false;
  const nx = d > 0.01 ? dx / d : 0;
  const ny = d > 0.01 ? dy / d : -1;
  ball.x = px + nx * reach;
  ball.y = py + ny * reach;
  ballClamp();
  const vrel = (ball.vx - pvx) * nx + (ball.vy - pvy) * ny;
  if (vrel < 0) {
    const k = -(1 + Math.max(0.5, e)) * vrel; // en knuff studsar alltid lite, även med låg studs
    ball.vx += k * nx;
    ball.vy += k * ny;
  }
  return true;
}

function ballDraw() {
  ball.el.style.width = ball.el.style.height = `${ball.r * 2}px`;
  ball.el.style.transform = `translate(${ball.x - ball.r}px, ${ball.y - ball.r}px)`;
}

// ---------- Spela: bollen är en pekare ----------
function ballPlay(rect) {
  const cx = rect.left + ball.x;
  const cy = rect.top + ball.y;
  if (ball.played && Math.abs(ball.played.x - cx) < 0.5 && Math.abs(ball.played.y - cy) < 0.5) {
    if (ball.tab !== 'xy' || ballXyPlaying() || !audioCtx) return; // still: inget nytt att spela
  }
  ball.played = { x: cx, y: cy };
  pointerXY.set(BALL_ID, { x: cx, y: cy });
  if (ball.tab === 'xy') {
    const nx = ball.x / ball.w;
    const ny = 1 - ball.y / ball.h;
    if (!ballXyPlaying()) xyVoiceStart(BALL_ID, nx, ny);
    else xyVoiceMove(BALL_ID, nx, ny);
    xyTrail(BALL_ID, ball.x / ball.w, ball.y / ball.h);
    return;
  }
  // Rutan under bollen (lagret släpper igenom träffen så länge)
  ball.layer.style.pointerEvents = 'none';
  try {
    const pad = padAt(cx, cy);
    moveFinger(BALL_ID, pad);
    if (pad && posOn()) posApply(pad, padPos(pad, cx, cy));
    // Harpan (Ackord, Strängar): bollen knäpper tonerna den rullar över, som ett finger
    if (ball.tab === 'chords' && ui.formation.value === 'strings' && !picker.open && !scanning()) {
      strumOf(BALL_ID).active = true;
      strumMove({ type: 'ball', pointerId: BALL_ID, pointerType: 'ball', buttons: 1, clientX: cx, clientY: cy, target: ball.layer });
    }
  } finally {
    ball.layer.style.pointerEvents = '';
  }
}

const ballXyPlaying = () => xy.voices.has(BALL_ID) || xyGrains.has(BALL_ID) || xyArp.pts.has(BALL_ID);

// ---------- Ta tag, dra och kasta – eller knuffa ----------
function ballLocal(e) {
  const r = ball.layer.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp || performance.now() };
}

const ballNear = (p) => Math.hypot(p.x - ball.x, p.y - ball.y) <= ball.r * 1.4 + 8;

function ballGrabStart(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.stopPropagation(); // rutorna, harpan och stegningen under lagret ska inte få trycket
  const p = ballLocal(e);
  if (!ballNear(p) || ball.grab) return;
  e.preventDefault();
  ball.grab = { id: e.pointerId, dx: ball.x - p.x, dy: ball.y - p.y, pts: [p] };
  ball.pokers.delete(e.pointerId);
  ball.vx = 0;
  ball.vy = 0;
  try { ball.layer.setPointerCapture(e.pointerId); } catch {}
  ball.layer.classList.add('grabbing');
}

function ballPointerMove(e) {
  const p = ballLocal(e);
  const g = ball.grab;
  if (g && e.pointerId === g.id) {
    ball.x = p.x + g.dx;
    ball.y = p.y + g.dy;
    ballClamp();
    g.pts.push(p);
    while (g.pts.length > 2 && p.t - g.pts[0].t > 100) g.pts.shift();
    return;
  }
  ball.layer.classList.toggle('near', !ball.grab && ballNear(p));
  // Knuff: pekaren rör sig in i bollen. Kollas längs hela sträckan sedan förra händelsen,
  // så att en snabb pekare inte hoppar över bollen.
  const prev = ball.pokers.get(e.pointerId);
  const dt = prev ? (p.t - prev.t) / 1000 : 0;
  const vx = dt > 0.002 && dt < 0.1 ? (p.x - prev.x) / dt : 0;
  const vy = dt > 0.002 && dt < 0.1 ? (p.y - prev.y) / dt : 0;
  if (prev && !ball.grab) {
    const sx = p.x - prev.x;
    const sy = p.y - prev.y;
    const len2 = sx * sx + sy * sy;
    const k = len2 ? Math.max(0, Math.min(1, ((ball.x - prev.x) * sx + (ball.y - prev.y) * sy) / len2)) : 1;
    ballHit(prev.x + sx * k, prev.y + sy * k, vx, vy, Number(ui.ballBounce.value) / 100);
  }
  ball.pokers.set(e.pointerId, { x: p.x, y: p.y, vx, vy, t: performance.now() });
}

function ballGrabEnd(e) {
  const g = ball.grab;
  if (!g || e.pointerId !== g.id) { ball.pokers.delete(e.pointerId); return; }
  ball.grab = null;
  ball.layer.classList.remove('grabbing');
  // Kastet: farten de sista ~80 ms (stod pekaren still innan släppet blir det inget kast)
  const now = ballLocal(e).t;
  const pts = g.pts.filter((q) => now - q.t <= 80);
  ball.vx = 0;
  ball.vy = 0;
  if (e.type !== 'pointercancel' && pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    const dt = Math.max(0.016, (b.t - a.t) / 1000);
    ball.vx = (b.x - a.x) / dt;
    ball.vy = (b.y - a.y) / dt;
    const v = Math.hypot(ball.vx, ball.vy);
    if (v > BALL_V_MAX) { ball.vx *= BALL_V_MAX / v; ball.vy *= BALL_V_MAX / v; }
  }
  ball.last = performance.now(); // ingen gammal tid i nästa steg
}

function setupBall() {
  const layer = document.createElement('div');
  layer.id = 'ball-layer';
  layer.hidden = true;
  layer.innerHTML = '<div id="ball" aria-hidden="true"></div>';
  document.body.append(layer);
  ball.layer = layer;
  ball.el = layer.firstChild;

  layer.addEventListener('pointerdown', ballGrabStart);
  layer.addEventListener('pointermove', ballPointerMove);
  layer.addEventListener('pointerup', ballGrabEnd);
  layer.addEventListener('pointercancel', ballGrabEnd);
  layer.addEventListener('pointerleave', (e) => {
    if (ball.grab?.id !== e.pointerId) ball.pokers.delete(e.pointerId);
    layer.classList.remove('near');
  });
  layer.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => { ball.grab = null; ball.pokers.clear(); layer.classList.remove('grabbing'); });

  ui.ballOn.addEventListener('change', () => {
    if (ui.ballOn.checked) { ball.w = 0; } // en ny boll faller in uppifrån
    ballSync();
    log(t(`Boll ${ui.ballOn.checked ? 'på' : 'av'}`));
  });
  [ui.ballGravity, ui.ballBounce].forEach((el) => el.addEventListener('input', ballSync));

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
