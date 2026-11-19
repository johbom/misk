// Joystick och spelkontroll (Gamepad API).
//
// Varje knapp och varje riktning på spaken eller styrkorset blir en "tangent" med en egen kod
// (Gamepad0 … Gamepad15, GamepadUp/Down/Left/Right). Det betyder att de går att lära in precis som
// tangenter: som Kontakt 1 eller 2 (Tillgänglighet → Kontakt) och för enskilda rutor (→ Tangentbord).
// Inlärda knappar skickas vidare som tangenttryck, så allt som fungerar med tangentbordet fungerar.
//
// Knappar som inte är inlärda har ett förval:
//  - Stegning på (kontaktläget): spaken framåt (höger/ned) stegar, bakåt (vänster/upp) stegar tillbaka,
//    och knapparna A, B, X, Y väljer – som kontakt 2.
//  - Annars: stega och bekräfta. Spaken eller styrkorset flyttar en markering mellan rutorna och knapparna
//    på spelsidan (åt det håll man trycker). A, B, X, Y spelar den markerade rutan så länge knappen hålls
//    in, eller trycker på den markerade knappen. B stänger en öppen snabbruta.
// (Ljudet måste ändå startas med ett tryck eller klick på startrutan – webbläsarna tillåter inte att en
// spelkontroll startar ljud.)

const GP_AXIS = 0.5; // så långt spaken ska föras för att räknas som en riktning
const GP_REPEAT_DELAY = 420; // ms innan en riktning som hålls börjar upprepas
const GP_REPEAT = 200; // ms mellan upprepningarna
const GP_FACE = new Set([0, 1, 2, 3]); // A, B, X, Y (standardlayout)
const GP_DIRS = { 12: 'GamepadUp', 13: 'GamepadDown', 14: 'GamepadLeft', 15: 'GamepadRight' }; // styrkorset

const gp = {
  down: new Set(), // koder som hålls just nu
  repeat: new Map(), // riktning -> { next }
  held: new Map(), // kod -> ruta som spelas (förval: markeringen)
  markEl: null, // markerad ruta eller knapp (stega och bekräfta)
  names: [], // anslutna kontroller
  raf: 0,
};

const gpConnected = () => [...(navigator.getGamepads?.() || [])].filter(Boolean);

// Knappens namn att visa (keyName i js/access.js använder det)
function gamepadName(code) {
  const dir = { GamepadUp: 'upp', GamepadDown: 'ned', GamepadLeft: 'vänster', GamepadRight: 'höger' }[code];
  if (dir) return t(`Joystick ${dir}`);
  const m = code.match(/^Gamepad(\d+)$/);
  if (!m) return null;
  const i = Number(m[1]);
  const std = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3'][i];
  return std ? t(`Knapp ${std}`) : t(`Knapp ${i + 1}`);
}

// Vad som är nedtryckt på alla anslutna kontroller just nu (knappar och fyra riktningar)
function gpReadState() {
  const now = new Set();
  for (const pad of gpConnected()) {
    pad.buttons.forEach((b, i) => {
      if (!(b.pressed || b.value > 0.5)) return;
      now.add(GP_DIRS[i] && pad.mapping === 'standard' ? GP_DIRS[i] : `Gamepad${i}`);
    });
    const [x = 0, y = 0] = pad.axes;
    if (x < -GP_AXIS) now.add('GamepadLeft');
    if (x > GP_AXIS) now.add('GamepadRight');
    if (y < -GP_AXIS) now.add('GamepadUp');
    if (y > GP_AXIS) now.add('GamepadDown');
  }
  return now;
}

// Skicka som tangenttryck (inlärda knappar och inlärningen själv)
function gpKey(type, code) {
  document.body.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
}

// Är knappen inlärd någonstans (kontakt eller ruta på sidan som visas)?
function gpLearned(code) {
  if (switchOf(code) || shortcutOf(code)) return true;
  return ['notes', 'chords'].includes(document.body.dataset.tab) && !!padOfKey(document.body.dataset.tab, code);
}

const gpIsDir = (code) => code.startsWith('GamepadUp') || code.startsWith('GamepadDown')
  || code.startsWith('GamepadLeft') || code.startsWith('GamepadRight');
const gpFace = (code) => { const m = code.match(/^Gamepad(\d+)$/); return !!m && GP_FACE.has(Number(m[1])); };

function gpPress(code) {
  if (learning || gpLearned(code)) { gpKey('keydown', code); return; }
  if (!isPlayTab() || !$('start-overlay').classList.contains('hidden') || document.querySelector('dialog[open]')) return;
  if (scanning()) {
    // Förval i stegningen: framåt stegar, bakåt stegar tillbaka, A/B/X/Y väljer
    if (code === 'GamepadRight' || code === 'GamepadDown') scanStep();
    else if (code === 'GamepadLeft' || code === 'GamepadUp') scanBack();
    else if (gpFace(code)) { scanPress(); gp.held.set(code, 'scan'); }
    return;
  }
  if (gpIsDir(code)) { gpMove(code); return; }
  if (!gpFace(code)) return;
  // B: tillbaka – stänger en öppen snabbruta (annars som de andra)
  if (code === 'Gamepad1' && quick.open) {
    const btn = quickBtn(quick.open);
    closeQuick();
    gpMark(btn && gpUsable(btn) ? btn : null);
    return;
  }
  const el = gp.markEl && gpItems().includes(gp.markEl) ? gp.markEl : null;
  if (!el) { gpMark(gpItems()[0] || null); return; } // första trycket: markera
  const pad = allPads().find((p) => p.el === el);
  if (pad) { gp.held.set(code, pad); activate(pad); return; } // en ruta spelar så länge knappen hålls in
  el.click(); // en knapp: tryck på den (Arp, Seq, ◀ ▶, en flik, ett val i en snabbruta …)
  // Öppnades en snabbruta? Markera dess första val. Försvann knappen? Markera det första som finns.
  requestAnimationFrame(() => {
    const items = gpItems();
    if (quick.open && !$('quick-pop').contains(gp.markEl)) gpMark(items[0] || null);
    else if (!items.includes(gp.markEl)) gpMark(items[0] || null);
  });
}

function gpRelease(code) {
  if (gp.held.has(code)) {
    const pad = gp.held.get(code);
    gp.held.delete(code);
    if (pad === 'scan') scanRelease();
    else if (ui.playMode.value === 'hold') release(pad);
    return;
  }
  if (learning || gpLearned(code)) gpKey('keyup', code);
}

// ---------- Markeringen (stega och bekräfta, utan kontaktläget) ----------
// Markeringen går mellan rutorna och knapparna på spelsidan: flikarna Toner/Ackord/XY, spelradens knappar
// och sequencerns rad – eller, när en snabbruta är öppen, valen i den.
const gpUsable = (el) => !el.disabled && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'
  && el.getClientRects().length > 0;
function gpItems() {
  if (quick.open) return [...$('quick-pop').querySelectorAll('button')].filter(gpUsable);
  const pads = visiblePads().map((p) => p.el);
  const ctls = [...document.querySelectorAll('#tabs button[data-tab="notes"], #tabs button[data-tab="chords"], #tabs button[data-tab="xy"], #play-bar button, #seq-bar button')]
    .filter(gpUsable);
  return [...pads, ...ctls];
}

function gpLabel(el) {
  const pad = allPads().find((p) => p.el === el);
  if (pad) return pad.label();
  return (el.getAttribute('aria-label') || el.textContent || el.title || '').replace(/\s+/g, ' ').trim();
}

function gpMark(el) {
  gp.markEl?.classList.remove('gp-mark');
  gp.markEl = el;
  if (!el) return;
  el.classList.add('gp-mark');
  if (!el.classList.contains('pad')) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  log(t(`Markerad: ${gpLabel(el)}`));
}

// Närmaste åt det håll man trycker (efter platsen på skärmen, så det fungerar i alla formationer)
function gpMove(code) {
  const items = gpItems();
  if (!items.length) return;
  const cur = items.includes(gp.markEl) ? gp.markEl : null;
  if (!cur) { gpMark(items.find((el) => el.classList.contains('pad')) || items[0]); return; }
  const c = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const [x0, y0] = c(cur);
  const [dx, dy] = { GamepadUp: [0, -1], GamepadDown: [0, 1], GamepadLeft: [-1, 0], GamepadRight: [1, 0] }[code];
  let best = null;
  let bestScore = Infinity;
  items.forEach((el) => {
    if (el === cur) return;
    const [x, y] = c(el);
    const along = (x - x0) * dx + (y - y0) * dy; // hur långt åt rätt håll
    if (along <= 1) return;
    const across = Math.abs((x - x0) * dy) + Math.abs((y - y0) * dx); // hur långt vid sidan om
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  });
  // Inget åt det hållet: vänster/höger går runt i ordningen (som stegningen)
  if (!best && (code === 'GamepadRight' || code === 'GamepadLeft')) {
    const i = items.indexOf(cur);
    best = items[(i + (code === 'GamepadRight' ? 1 : -1) + items.length) % items.length];
  }
  if (best) gpMark(best);
}

// Markeringen försvinner när det markerade inte längre finns (byte av sida, rutorna byggs om)
function gpSyncMark() {
  if (gp.markEl && (!gp.markEl.isConnected || scanning() || !gpItems().includes(gp.markEl))) gpMark(null);
}

// ---------- Läsning ----------
function gpLoop() {
  gp.raf = 0;
  if (!gpConnected().length) { gp.down.forEach(gpRelease); gp.down.clear(); return; }
  const now = gpReadState();
  const t0 = performance.now();
  for (const code of now) {
    if (!gp.down.has(code)) {
      gpPress(code);
      if (gpIsDir(code)) gp.repeat.set(code, t0 + GP_REPEAT_DELAY);
    } else if (gp.repeat.has(code) && t0 >= gp.repeat.get(code) && !learning && !gpLearned(code)) {
      gpPress(code); // riktningen hålls: fortsätt flytta
      gp.repeat.set(code, t0 + GP_REPEAT);
    }
  }
  for (const code of gp.down) {
    if (!now.has(code)) { gpRelease(code); gp.repeat.delete(code); }
  }
  gp.down = now;
  gp.raf = requestAnimationFrame(gpLoop);
}

function gpStatus() {
  const list = gpConnected();
  const el = $('gamepad-status');
  if (el) el.textContent = list.length ? t(`Ansluten: ${list.map((g) => g.id.replace(/\s*\(.*$/, '')).join(', ')}`) : t('Ingen joystick eller spelkontroll ansluten.');
}

function setupGamepad() {
  if (!navigator.getGamepads) { gpStatus(); return; }
  window.addEventListener('gamepadconnected', (e) => {
    gpStatus();
    log(t(`Joystick ansluten: ${e.gamepad.id.replace(/\s*\(.*$/, '')}`));
    if (!gp.raf) gp.raf = requestAnimationFrame(gpLoop);
  });
  window.addEventListener('gamepaddisconnected', () => { gpStatus(); log(t('Joysticken kopplades bort.')); });
  // (en kontroll som redan var ansluten syns först när man trycker på en knapp)
  if (gpConnected().length && !gp.raf) gp.raf = requestAnimationFrame(gpLoop);
  gpStatus();
}
