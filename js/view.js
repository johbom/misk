// Flikar, formationer och mellanrum.

// ---------- Flikar ----------
function showTab(tab) {
  closeChordPicker();
  if (typeof closeQuick === 'function') closeQuick();
  resetHover();
  allPads().forEach(release);
  arpReset();
  seqStop();
  document.body.dataset.tab = tab;
  syncSoundSelect(); // trumseten finns i listan Ljud bara på sidan Toner
  if (tab === 'settings') setLocked(false);
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) =>
    b.classList.toggle('on', b.dataset.tab === tab)
  );
  localStorage.setItem('hoverPadsTab', tab);
  if (tab !== 'settings') localStorage.setItem('hoverPadsPlayTab', tab); // senaste spelsidan
  layoutPads();
  xyShow(tab === 'xy');
  renderSeq(); // Toner och Ackord har var sitt mönster
}

// ---------- Om-rutan ----------
function setupAbout() {
  const dlg = $('about');
  $('about-btn').addEventListener('click', () => {
    allPads().forEach(release);
    dlg.showModal();
  });
  // Klick utanför rutan stänger den
  dlg.addEventListener('click', (e) => {
    const r = dlg.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dlg.close();
  });
  // Radera allt appen sparat i localStorage (inställningar, presets, ackord, flikar, språk).
  // Cachen med appens filer får ligga kvar, så att appen fortfarande fungerar utan internet.
  $('about-erase').addEventListener('click', () => {
    if (!confirm(t('Radera alla inställningar, presets och egna ackord på den här enheten? Det går inte att ångra.'))) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('hoverPads') || k === 'midiOut')
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ingen lagring att radera */ }
    location.replace(`${location.pathname}?lang=${LANG}`); // behåll språket som visas nu
  });
}

// ---------- Underflikar i Inställningar ----------
function showSettingsPanel(panel) {
  if (['notes', 'chords', 'surfaces'].includes(panel)) panel = 'play'; // gamla flikar (Spelytor ligger nu under Instrument)
  if (!document.querySelector(`#settings .panel[data-panel="${panel}"]`)) panel = 'play';
  document.querySelectorAll('#settings-nav button').forEach((b) =>
    b.classList.toggle('on', b.dataset.panel === panel));
  document.querySelectorAll('#settings .panel').forEach((p) =>
    p.classList.toggle('on', p.dataset.panel === panel));
  localStorage.setItem('hoverPadsSettingsTab', panel);
}

// ---------- Formation (layout.js räknar ut positionerna) ----------
// Rutnätet med mellanrummet gap (px): antal kolumner och rutornas bredd.
function gridFit(container, n, gap) {
  const cs = getComputedStyle(container);
  const W = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (FIXED_SCREEN) {
    // Fast skärm: välj det kolumnantal som ger störst rutor på den yta som finns
    const H = container.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    let best = 1;
    let bestSide = 0;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const side = Math.min((W - (cols - 1) * gap) / cols, (H - (rows - 1) * gap) / rows);
      if (side > bestSide + 0.5) { bestSide = side; best = cols; }
    }
    return { cols: best, size: Math.max(0, bestSide) };
  }
  const wanted = n <= 4 ? n : n <= 8 ? Math.ceil(n / 2) : n <= 16 ? 4 : n <= 24 ? 6 : 8;
  // Men aldrig så många att rutorna blir smalare än ca 60 px med valt mellanrum
  const cols = Math.max(1, Math.min(wanted, Math.floor((W + gap) / (60 + gap))));
  return { cols, size: Math.max(0, (W - (cols - 1) * gap) / cols) };
}

// Mellanrummet anges i procent av rutornas storlek. Rutorna krymper när mellanrummet växer,
// så rätt mellanrum i px (gap = andel × storlek) letas fram med halvering.
function solveGap(sizeFor, max) {
  const share = Number(ui.padSpace.value) / 100;
  if (!(share > 0)) return 0;
  let lo = 0;
  let hi = max;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (share * sizeFor(mid) > mid) lo = mid; else hi = mid;
  }
  return lo;
}

// Knappar med en liten bild per formation; valet sparas i det dolda fältet #formation.
function buildFormationButtons() {
  const box = $('formation-buttons');
  const valid = ui.formation.value in FORMATIONS;
  if (!valid) ui.formation.value = 'grid';
  Object.entries(FORMATIONS).forEach(([value, text]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'formation-btn';
    b.dataset.value = value;
    b.setAttribute('role', 'radio');
    b.innerHTML = `${FORMATION_ICONS[value]}<span>${text}</span>`;
    b.addEventListener('click', () => {
      if (ui.formation.value === value) return;
      ui.formation.value = value;
      ui.formation.dispatchEvent(new Event('change')); // sparar och placerar om
      syncFormationButtons();
    });
    box.append(b);
  });
  syncFormationButtons();
}

// Knappar med symbol per spelsätt; värdet ligger i den dolda listan #play-mode.
function buildPlayModeButtons() {
  const box = $('play-mode-buttons');
  Object.entries(PLAY_MODES).forEach(([value, m]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'formation-btn mode-btn';
    b.dataset.value = value;
    b.setAttribute('role', 'radio');
    b.title = m.desc;
    b.innerHTML = `${m.icon}<span>${m.name}</span>`;
    b.addEventListener('click', () => {
      if (ui.playMode.value === value) return;
      ui.playMode.value = value;
      ui.playMode.dispatchEvent(new Event('input')); // tillgänglighet m.m.
      ui.playMode.dispatchEvent(new Event('change')); // sparar
    });
    box.append(b);
  });
  syncPlayModeButtons();
}

// Anropas också när spelsättet ändras på annat sätt (profiler, presets, uppstart)
function syncPlayModeButtons() {
  if (!(ui.playMode.value in PLAY_MODES)) ui.playMode.value = 'hold';
  document.querySelectorAll('#play-mode-buttons .mode-btn').forEach((b) => {
    const on = b.dataset.value === ui.playMode.value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
  $('play-mode-desc').textContent = PLAY_MODES[ui.playMode.value].desc;
}

function syncFormationButtons() {
  document.querySelectorAll('#formation-buttons .formation-btn').forEach((b) => {
    const on = b.dataset.value === ui.formation.value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
}

function formationOpts() {
  return {
    stringLength: Number(ui.stringLength.value) / 100,
    ringSpace: Number(ui.ringSpace.value) / 100,
    ringHole: Number(ui.ringHole.value) / 100,
    hexOrder: ui.hexOrder.value,
    stringDir: ui.stringDir.value,
  };
}

// Visar värdena bredvid reglagen och placerar om
function applyFormationOpts() {
  $('string-length-value').textContent = `${ui.stringLength.value} %`;
  $('ring-gap-value').textContent = `${ui.ringSpace.value} %`;
  $('ring-hole-value').textContent = `${ui.ringHole.value} %`;
  layoutPads();
}

function layoutPads() {
  const f = ui.formation.value;
  document.body.dataset.formation = f; // styr vilka formationsreglage som syns
  syncScan(); // stegningen följer flik och antal rutor
  ui.pads.dataset.formation = f;
  ui.chordPads.dataset.formation = f;

  const tab = document.body.dataset.tab;
  const container = tab === 'notes' ? ui.pads : tab === 'chords' ? ui.chordPads : null;
  if (!container) return; // fliken Inställningar: inget att placera
  const pads = container === ui.pads ? notePads : chordPads;
  ui.pads.dataset.dir = ui.chordPads.dataset.dir = ui.stringDir.value; // strängarnas riktning (CSS)
  if (!pads.length) return; // vid uppstart finns inga rutor än
  pads.forEach((p) => {
    p.el.removeAttribute('style');
    if (p.chord) paintChordPad(p); // färgen ligger också i style
  });

  if (f === 'grid') {
    container.style.height = '';
    const n = pads.length;
    const gap = solveGap((g) => gridFit(container, n, g).size, container.clientWidth);
    container.style.setProperty('--pad-gap', `${gap.toFixed(1)}px`);
    container.style.gridTemplateColumns = `repeat(${gridFit(container, n, gap).cols}, 1fr)`;
    return;
  }

  let height;
  if (FIXED_SCREEN) {
    // Fast skärm: ytan får den höjd som blir över (CSS flex), ingen scroll
    container.style.height = '';
    height = container.clientHeight;
  } else {
    // Fyll höjden ner till sidfoten
    const top = container.getBoundingClientRect().top + window.scrollY;
    const footer = document.querySelector('footer').offsetHeight;
    height = Math.max(360, window.innerHeight - top - footer - 8);
    container.style.height = `${height}px`;
  }
  container.style.gridTemplateColumns = '';

  const cs = getComputedStyle(container);
  const left = parseFloat(cs.paddingLeft);
  const topPad = parseFloat(cs.paddingTop);
  const W = container.clientWidth - left - parseFloat(cs.paddingRight);
  const H = height - topPad - parseFloat(cs.paddingBottom);
  const opts = formationOpts();
  const layout = (g) => LAYOUTS[f](pads.length, W, H, g, opts);
  // Rutans storlek = den kortaste sidan (bollens diameter, strängens bredd)
  const gap = f === 'ring' ? 0 : solveGap((g) => { const r = layout(g)[0]; return Math.min(r.w, r.h); }, Math.max(W, H));
  const rects = layout(gap);
  pads.forEach((p, i) => {
    const r = rects[i];
    Object.assign(p.el.style, {
      left: `${left + r.x}px`,
      top: `${topPad + r.y}px`,
      width: `${r.w}px`,
      height: `${r.h}px`,
      fontSize: `${Math.max(11, r.font)}px`,
    });
    // Trumnamn ("Bastrumma") är längre än tonnamn ("C4"): krymp texten tills namnet ryms
    if (p.drum) {
      let fs = Math.max(11, r.font);
      while (fs > 10 && p.el.scrollWidth > p.el.clientWidth) {
        fs *= 0.9;
        p.el.style.fontSize = `${fs}px`;
      }
    }
    if (r.clip) {
      // Formen (t.ex. en ringsektor) – klippningen styr också var man träffar rutan
      p.el.style.clipPath = r.clip;
      p.el.style.webkitClipPath = r.clip;
    }
    if (r.label) {
      // Flytta texten till punkten label genom att lägga padding på rätt sidor
      const { x, y } = r.label;
      p.el.style.padding = `${Math.max(0, 2 * y - r.h)}px ${Math.max(0, r.w - 2 * x)}px `
        + `${Math.max(0, r.h - 2 * y)}px ${Math.max(0, 2 * x - r.w)}px`;
    }
  });
  // Viloplatsen i mitten av ringen markeras med en svag cirkel
  if (rects.hole) {
    container.style.setProperty('--hole-x', `${left + rects.hole.x}px`);
    container.style.setProperty('--hole-y', `${topPad + rects.hole.y}px`);
    container.style.setProperty('--hole-r', `${rects.hole.r}px`);
  }
}

// Tomrum mellan rutorna – där kan musen röra sig utan att något spelas.
// Reglaget är logaritmiskt: läge 0 = inget mellanrum, 1–100 = 1–300 % (varje steg lika stor ökning i procent).
const GAP_MAX = 300;
function gapFromSlider(p) {
  if (p <= 0) return 0;
  const v = Math.pow(GAP_MAX, (p - 1) / 99);
  const r = v < 20 ? 1 : v < 100 ? 5 : 10; // jämna tal
  return Math.min(GAP_MAX, Math.max(1, Math.round(v / r) * r));
}
const sliderFromGap = (v) => (v <= 0 ? 0 : Math.round(1 + (99 * Math.log(Math.max(1, v))) / Math.log(GAP_MAX)));

function setupGapSlider() {
  const slider = $('pad-space-slider');
  const set = (type) => {
    const v = gapFromSlider(Number(slider.value));
    if (type === 'input' && String(v) === ui.padSpace.value) return;
    ui.padSpace.value = v;
    ui.padSpace.dispatchEvent(new Event(type, { bubbles: true })); // input: rita om, change: spara
  };
  slider.addEventListener('input', () => set('input'));
  slider.addEventListener('change', () => set('change'));
}

function applyGap() {
  const v = Number(ui.padSpace.value);
  const slider = $('pad-space-slider');
  if (gapFromSlider(Number(slider.value)) !== v) slider.value = sliderFromGap(v);
  slider.setAttribute('aria-valuetext', `${v} %`);
  $('gap-value').textContent = `${v} %`;
  layoutPads();
}
