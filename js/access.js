// Tillgänglighet: ögonstyrning, kontakt (switch), tangentbord, storlek, kontrast och lås.
//
// Tankar bakom (universell utformning):
//  - Ögonstyrning styr muspekaren. Allt man tittar på "hovras", så rutorna behöver aktiveringstid
//    (dwell) och tålighet mot att blicken darrar över kanten (pads.js: enterPad/leavePad).
//  - Den som bara kan titta behöver kunna trycka på knappar genom att vila blicken på dem, och
//    ändra alla värden utan att dra i reglage eller öppna rullgardinsmenyer (stora − / + knappar).
//  - Tydlig återkoppling: en ring som följer pekaren och fylls, och en fyllnad på rutan.
//  - Kontakt/switch och tangentbord: stegning en ruta i taget, siffertangenter spelar direkt.
//  - Lås: bara rutorna syns, och man låser upp genom att hålla inne – inte genom att titta.

const isPlayTab = () => ['notes', 'chords'].includes(document.body.dataset.tab);
const visiblePads = () => (document.body.dataset.tab === 'notes' ? notePads
  : document.body.dataset.tab === 'chords' ? chordPads : []);
// Där tangenterna ska skriva text i stället för att spela (listor och reglage på spelraden räknas inte:
// siffrorna ska spela även om man nyss ändrat preset eller volym)
const inFormField = (el) => el instanceof Element && !!el.closest(
  'dialog, textarea, [contenteditable], input:not([type="range"]):not([type="checkbox"]):not([type="button"])');

// Siffran för en tangent (1–9, 0 = 10), både sifferraden och det numeriska tangentbordet
const keyDigit = (code) => (/^(Digit|Numpad)[0-9]$/.test(code) ? Number(code.slice(-1)) : null);

// ---------- Etiketter bredvid reglagen ----------
const secs = (v) => `${(v / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} s`;
const ACCESS_LABELS = {
  noteLength: secs,
  vibrato: (v) => (v ? `${v} cent` : 'Av'),
  dwell: (v) => (v ? secs(v) : 'Direkt'),
  releaseDelay: (v) => (v ? secs(v) : 'Av'),
  lockout: (v) => (v ? secs(v) : 'Av'),
  dwellClick: (v) => (v ? secs(v) : 'Av'),
  scanSpeed: secs,
};
let appliedZoom = null;

function refreshAccess() {
  for (const [k, fmt] of Object.entries(ACCESS_LABELS)) $(`${ui[k].id}-value`).textContent = fmt(Number(ui[k].value));
  const root = document.documentElement;
  root.classList.toggle('high-contrast', ui.highContrast.checked);
  root.classList.toggle('reduce-motion', ui.reduceMotion.checked);
  root.classList.toggle('steppers', ui.steppers.checked);
  root.classList.toggle('show-keys', ui.showKeys.checked);
  syncSegments();
  root.dataset.pointer = ui.showPointer.value;
  syncPlayModeButtons();
  document.body.dataset.playMode = ui.playMode.value;
  document.body.dataset.scan = ui.scanMode.value;
  if (ui.playMode.value !== 'latch') allPads().forEach((p) => { if (!p.hover?.on.size) release(p); });
  syncProfiles();
  restartScan();
  if (appliedZoom !== ui.uiSize.value) {
    appliedZoom = ui.uiSize.value;
    root.style.setProperty('--ui-zoom', ui.uiSize.value);
    layoutPads(); // större flikar = mindre spelyta
  }
}

// ---------- Snabbval (profiler) ----------
const ACCESS_PROFILES = [
  {
    name: 'Standard', desc: 'Mus och pekskärm. Spelar direkt.',
    set: { dwell: 0, releaseDelay: 0, lockout: 0, showPointer: 'off', dwellClick: 0, uiSize: '1', steppers: false, scanMode: 'off', playMode: 'hold', vibrato: 20 },
  },
  {
    name: 'Ögon – utforska', desc: 'Första stegen, orsak och verkan. Låter direkt där blicken landar, tål darr och har stor pekare.',
    set: { dwell: 0, releaseDelay: 400, lockout: 600, showPointer: 'xlarge', dwellClick: 0, uiSize: '1.25', steppers: true, scanMode: 'off', playMode: 'hold', padGap: 96, vibrato: 0 },
  },
  {
    name: 'Ögon – spela', desc: 'Van användare. Kort vilotid så man hinner sikta. Ögonstyrningen sköter klicken.',
    set: { dwell: 250, releaseDelay: 200, lockout: 250, showPointer: 'small', dwellClick: 0, uiSize: '1.25', steppers: true, scanMode: 'off', playMode: 'hold', vibrato: 0 },
  },
  {
    name: 'Ögon – bara titta', desc: 'Utan klick: knappar trycks genom att titta, tonen ligger kvar tills nästa ruta.',
    set: { dwell: 600, releaseDelay: 250, lockout: 400, showPointer: 'large', dwellClick: 1200, uiSize: '1.5', steppers: true, scanMode: 'off', playMode: 'latch', vibrato: 0 },
  },
  {
    name: 'Kontakt', desc: 'En kontakt (eller mellanslag) med automatisk stegning. Håll in för lång ton.',
    set: { dwell: 0, releaseDelay: 0, lockout: 0, showPointer: 'off', dwellClick: 0, uiSize: '1.25', steppers: true, scanMode: 'auto', scanSpeed: 1500, playMode: 'hold', vibrato: 0 },
  },
];

function buildProfiles() {
  const box = $('access-profiles');
  ACCESS_PROFILES.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'profile';
    b.dataset.i = i;
    b.innerHTML = '<strong></strong><small></small>';
    b.querySelector('strong').textContent = p.name;
    b.querySelector('small').textContent = p.desc;
    b.addEventListener('click', () => applyProfile(p));
    box.append(b);
  });
}

function applyProfile(p) {
  for (const [k, v] of Object.entries(p.set)) {
    if (ui[k].type === 'checkbox') ui[k].checked = v;
    else ui[k].value = v;
  }
  saveSettings();
  if ('padGap' in p.set) applyGap();
  refreshAccess();
  log(`Tillgänglighet: ${p.name}`);
}

function syncProfiles() {
  document.querySelectorAll('#access-profiles .profile').forEach((b) => {
    const p = ACCESS_PROFILES[b.dataset.i];
    const on = Object.entries(p.set).every(([k, v]) =>
      (ui[k].type === 'checkbox' ? ui[k].checked === v : String(ui[k].value) === String(v)));
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  });
}

// Öppna dialogrutor ligger i ett eget lager överst; pekaren och markeringen måste följa med dit
const topHost = () => document.querySelector('dialog[open]') || document.body;
// Returnerar värdens zoom (Storlek), så att positioner kan räknas om till dess skala
function hostIn(el, host) {
  if (el.parentElement !== host) host.append(el);
  return host === document.body ? 1 : parseFloat(getComputedStyle(host).zoom) || 1;
}

// ---------- Synlig pekare ----------
const gaze = { el: null, x: 0, y: 0, frame: 0 };

function setupGazeDot() {
  gaze.el = $('gaze-dot');
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    gaze.x = e.clientX;
    gaze.y = e.clientY;
    gaze.el.classList.add('on');
    if (!gaze.frame) {
      gaze.frame = requestAnimationFrame(() => {
        gaze.frame = 0;
        const z = hostIn(gaze.el, topHost());
        gaze.el.style.transform = `translate(${gaze.x / z}px, ${gaze.y / z}px)`;
      });
    }
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => gaze.el.classList.remove('on'));
}

// Ringen fylls under väntetiden (0 = sluta)
function gazeDwell(wait) {
  const el = gaze.el;
  if (!el) return;
  el.classList.remove('dwell');
  if (!wait) return;
  el.style.setProperty('--dwell-ms', `${wait}ms`);
  void el.offsetWidth; // starta om animationen
  el.classList.add('dwell');
}

// ---------- Klicka genom att titta (dwell-klick på knappar) ----------
const DWELL_TARGETS = 'button:not(.pad):not(:disabled):not(#unlock-btn), [role="radio"], label.check, '
  + 'label:has(> input[type="checkbox"])';
const dwellClick = { target: null, timer: 0, leave: 0 };

function setupDwellClick() {
  const box = $('dwell-box');
  const stop = () => {
    clearTimeout(dwellClick.timer);
    dwellClick.timer = 0;
    box.classList.remove('on');
    gazeDwell(0);
  };
  const start = (t) => {
    const wait = ms(ui.dwellClick);
    const z = hostIn(box, t.closest('dialog[open]') || document.body);
    const r = t.getBoundingClientRect();
    Object.assign(box.style, {
      left: `${r.left / z}px`, top: `${r.top / z}px`, width: `${r.width / z}px`, height: `${r.height / z}px`,
    });
    box.style.setProperty('--dwell-ms', `${wait}ms`);
    box.classList.remove('on');
    void box.offsetWidth;
    box.classList.add('on');
    gazeDwell(wait);
    dwellClick.timer = setTimeout(() => {
      stop();
      if (dwellClick.target !== t || !t.isConnected) return;
      t.click();
      t.classList.add('dwell-clicked');
      setTimeout(() => t.classList.remove('dwell-clicked'), 250);
      // Fortsätt titta på − / + = fortsätt stega. Andra knappar: titta bort först.
      if (t.classList.contains('step') && t.isConnected) start(t);
    }, wait);
  };
  const forget = () => { stop(); dwellClick.target = null; };

  // Bara riktig rörelse räknas (pointermove): om sidan byter utseende under en stilla pekare
  // ska inte det som råkar hamna under den klickas.
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !ms(ui.dwellClick)) { if (dwellClick.target) forget(); return; }
    const t = (e.target instanceof Element && e.target.closest(DWELL_TARGETS)) || null;
    if (t && t === dwellClick.target) { clearTimeout(dwellClick.leave); dwellClick.leave = 0; return; }
    if (t) {
      clearTimeout(dwellClick.leave);
      dwellClick.leave = 0;
      stop();
      dwellClick.target = t;
      start(t);
    } else if (dwellClick.target && !dwellClick.leave) {
      // Utanför knappen: samma darrtolerans som på rutorna
      dwellClick.leave = setTimeout(() => { dwellClick.leave = 0; forget(); }, ms(ui.releaseDelay));
    }
  });
  document.documentElement.addEventListener('mouseleave', forget);
  window.addEventListener('scroll', forget, true);
}

// ---------- Stora − / + knappar vid reglage och listor ----------
function controlName(el) {
  const own = el.getAttribute('aria-label') || el.title;
  if (own) return own;
  const lab = el.closest('label');
  if (!lab) return '';
  const lbl = lab.querySelector('.lbl');
  const text = lbl ? lbl.firstChild.textContent
    : [...lab.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
  return text.trim();
}

function stepControl(el, dir) {
  if (el.disabled) return;
  if (el.tagName === 'SELECT') {
    let i = el.selectedIndex + dir;
    while (el.options[i] && el.options[i].disabled) i += dir;
    if (!el.options[i]) return;
    el.selectedIndex = i;
  } else {
    const min = el.min === '' ? -Infinity : Number(el.min);
    const max = el.max === '' ? Infinity : Number(el.max);
    const step = Number(el.step) || 1;
    // Reglage med många steg: högst ca 20 tryck från ena änden till den andra
    const span = Number.isFinite(min) && Number.isFinite(max) && el.type === 'range' ? (max - min) / step : 0;
    const delta = step * Math.max(1, Math.ceil(span / 20));
    let v = Math.min(max, Math.max(min, Number(el.value) + dir * delta));
    if (Number.isFinite(min)) v = min + Math.round((v - min) / step) * step;
    if (String(+v.toFixed(6)) === el.value) return;
    el.value = String(+v.toFixed(6));
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function enhanceControl(el) {
  if (el.parentElement.classList.contains('stepper') || el.hasAttribute('data-no-stepper')) return;
  // Sifferfält (och listor med data-spin, t.ex. antal toner) får alltid − / +, inte bara i läget
  // "Stora − och + knappar": de små inbyggda pilarna är svåra att träffa.
  const spin = el.type === 'number' || el.hasAttribute('data-spin');
  const isSelect = el.tagName === 'SELECT' && !spin;
  const name = controlName(el);
  const wrap = document.createElement('span');
  wrap.className = `stepper${isSelect ? ' is-select' : ''}${spin ? ' spin' : ''}`;
  el.before(wrap);
  const button = (dir) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `step ${dir < 0 ? 'down' : 'up'}`;
    b.tabIndex = -1; // tangentbordet använder piltangenterna på själva reglaget
    b.textContent = isSelect ? (dir < 0 ? '◀' : '▶') : (dir < 0 ? '−' : '+');
    b.setAttribute('aria-label', `${isSelect ? (dir < 0 ? 'Föregående' : 'Nästa') : (dir < 0 ? 'Minska' : 'Öka')} ${name}`.trim());
    b.addEventListener('click', (e) => { e.preventDefault(); stepControl(el, dir); });
    return b;
  };
  // Reglaget först i koden (så att etiketten hör ihop med det), knapparna placeras med CSS
  wrap.append(el, button(-1), button(1));
}

function setupSteppers() {
  const sel = 'select, input[type="range"], input[type="number"]';
  [$('settings'), $('play-bar')].forEach((root) => {
    const scan = () => root.querySelectorAll(sel).forEach(enhanceControl);
    scan();
    new MutationObserver(scan).observe(root, { childList: true, subtree: true });
  });
}

// ---------- Lås spelytan ----------
const UNLOCK_HOLD_MS = 2000;

function setLocked(on) {
  if (document.body.classList.contains('locked') === on) return;
  document.body.classList.toggle('locked', on);
  localStorage.setItem('hoverPadsLocked', on ? '1' : '');
  if (on) {
    closeChordPicker();
    document.activeElement?.blur();
  }
  layoutPads();
}

function setupLock() {
  $('lock-btn').addEventListener('click', () => {
    setLocked(true);
    log('Spelytan är låst. Håll inne knappen i hörnet i två sekunder för att låsa upp.');
  });
  const btn = $('unlock-btn');
  let timer = 0;
  const begin = () => {
    if (timer) return;
    btn.style.setProperty('--hold-ms', `${UNLOCK_HOLD_MS}ms`);
    btn.classList.add('holding');
    timer = setTimeout(() => { timer = 0; btn.classList.remove('holding'); setLocked(false); log('Upplåst'); }, UNLOCK_HOLD_MS);
  };
  const end = () => { clearTimeout(timer); timer = 0; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch {}
    begin();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, end));
  btn.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) begin();
  });
  btn.addEventListener('keyup', end);
  btn.addEventListener('click', (e) => e.preventDefault());
  // Låst: ingen högerklicksmeny
  document.addEventListener('contextmenu', (e) => {
    if (document.body.classList.contains('locked')) e.preventDefault();
  }, true);
  if (localStorage.getItem('hoverPadsLocked')) setLocked(true);
}

// ---------- Stegning (kontakt/switch) ----------
const scan = { idx: 0, timer: 0, held: null };
const scanning = () => ui.scanMode.value !== 'off' && isPlayTab();

// Siffran som spelar rutan, visas på rutorna om "Visa tangentsiffror" är på
function markKeys() {
  allPads().forEach((p) => p.el.removeAttribute('data-key'));
  visiblePads().slice(0, 10).forEach((p, i) => p.el.setAttribute('data-key', (i + 1) % 10));
}

function markScan() {
  markKeys();
  const on = scanning();
  const current = visiblePads()[scan.idx];
  allPads().forEach((p) => p.el.classList.toggle('scan', on && p === current));
}

function scanStep() {
  const n = visiblePads().length;
  if (!n) return;
  scan.idx = (scan.idx + 1) % n;
  markScan();
}

// Anropas vid varje omplacering (byte av flik, antal rutor m.m.)
function syncScan() {
  if (!scanning()) {
    clearInterval(scan.timer);
    scan.timer = 0;
  } else {
    if (scan.idx >= visiblePads().length) scan.idx = 0;
    if (ui.scanMode.value === 'auto' && !scan.timer && !scan.held) {
      scan.timer = setInterval(scanStep, Number(ui.scanSpeed.value));
    }
  }
  markScan();
}

function restartScan() {
  clearInterval(scan.timer);
  scan.timer = 0;
  syncScan();
}

function scanPress() {
  if (scan.held) return;
  const pad = visiblePads()[scan.idx];
  if (!pad) return;
  scan.held = pad;
  clearInterval(scan.timer); // stå still medan kontakten hålls in
  scan.timer = 0;
  activate(pad);
}

function scanRelease() {
  const pad = scan.held;
  if (!pad) return;
  scan.held = null;
  if (ui.playMode.value === 'hold') release(pad);
  restartScan();
}

// ---------- Tangentbord och kontakt ----------
const keyPads = new Map(); // tangent -> ruta som hålls

function setupKeys() {
  document.addEventListener('keydown', (e) => {
    if (!isPlayTab() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (inFormField(e.target) || e.target.id === 'unlock-btn' || picker.open) return;
    const isSwitch = e.key === ' ' || e.key === 'Enter';
    if (isSwitch && e.target.matches?.('select')) return; // mellanslag öppnar listan
    if (scanning() && isSwitch) {
      e.preventDefault();
      if (e.repeat) return;
      if (ui.scanMode.value === 'two' && e.key === ' ') scanStep();
      else scanPress();
      return;
    }
    if (e.repeat) { if (isSwitch) e.preventDefault(); return; }
    let pad = null;
    const d = keyDigit(e.code);
    if (d !== null) {
      e.preventDefault(); // t.ex. en fokuserad lista ska inte byta värde
      pad = visiblePads()[d === 0 ? 9 : d - 1];
    } else if (isSwitch && e.target.classList?.contains('pad')) {
      e.preventDefault();
      pad = allPads().find((p) => p.el === e.target);
    }
    if (!pad || keyPads.has(e.code)) return;
    keyPads.set(e.code, pad);
    activate(pad);
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') scanRelease();
    const pad = keyPads.get(e.code);
    if (!pad) return;
    keyPads.delete(e.code);
    if (ui.playMode.value === 'hold') release(pad);
  });

  // En kontakt som ger ett musklick (eller ett finger) spelar den markerade rutan
  document.addEventListener('pointerdown', (e) => {
    if (!scanning() || !inPlayArea(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    scanPress();
  });
  document.addEventListener('pointerup', scanRelease);
  document.addEventListener('pointercancel', scanRelease);
  window.addEventListener('blur', () => {
    keyPads.forEach((p) => release(p));
    keyPads.clear();
    scanRelease();
  });
}

// ---------- Bekräftelseruta (går att använda med blick, kontakt och tangentbord) ----------
function askConfirm(text, yesText = 'Ja') {
  const dlg = $('confirm');
  $('confirm-text').textContent = text;
  $('confirm-yes').textContent = yesText;
  allPads().forEach(release);
  dlg.showModal();
  $('confirm-no').focus(); // säkrast som förval
  return new Promise((resolve) => {
    const done = (v) => {
      dlg.close();
      $('confirm-yes').onclick = $('confirm-no').onclick = dlg.oncancel = null;
      resolve(v);
    };
    $('confirm-yes').onclick = () => done(true);
    $('confirm-no').onclick = () => done(false);
    dlg.oncancel = (e) => { e.preventDefault(); done(false); };
  });
}

// ---------- Uppstart ----------
// Följer systemets val för rörelse och kontrast tills användaren själv väljer
function accessDefaults() {
  ui.reduceMotion.checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
  ui.highContrast.checked = matchMedia('(prefers-contrast: more)').matches;
}

function setupAccess() {
  buildProfiles();
  setupGazeDot();
  setupDwellClick();
  setupSteppers();
  setupLock();
  setupKeys();
  ['noteLength', 'dwell', 'releaseDelay', 'lockout', 'showPointer', 'dwellClick', 'uiSize', 'steppers',
    'highContrast', 'reduceMotion', 'scanMode', 'scanSpeed', 'playMode', 'showKeys', 'vibrato']
    .forEach((k) => ui[k].addEventListener('input', refreshAccess));
  // Ljudet kan ha pausats (t.ex. om Start valdes med blicken): väck det vid första riktiga tryck
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }, true));
  refreshAccess();
}
