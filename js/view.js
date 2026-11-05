// Flikar, formationer och mellanrum.

// ---------- Flikar ----------
function showTab(tab) {
  closeChordPicker();
  allPads().forEach(release);
  document.body.dataset.tab = tab;
  document.querySelectorAll('#tabs button').forEach((b) =>
    b.classList.toggle('on', b.dataset.tab === tab)
  );
  localStorage.setItem('hoverPadsTab', tab);
  layoutPads();
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
}

// ---------- Underflikar i Inställningar ----------
function showSettingsPanel(panel) {
  if (!document.querySelector(`#settings .panel[data-panel="${panel}"]`)) panel = 'play';
  document.querySelectorAll('#settings-nav button').forEach((b) =>
    b.classList.toggle('on', b.dataset.panel === panel));
  document.querySelectorAll('#settings .panel').forEach((p) =>
    p.classList.toggle('on', p.dataset.panel === panel));
  localStorage.setItem('hoverPadsSettingsTab', panel);
}

// ---------- Formation (layout.js räknar ut positionerna) ----------
// Antal kolumner i rutnätet.
function gridColumns(container, n) {
  if (FIXED_SCREEN) {
    // Fast skärm: välj det kolumnantal som ger störst rutor på den yta som finns
    const cs = getComputedStyle(container);
    const W = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = container.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const gap = parseFloat(cs.columnGap) || 0;
    let best = 1;
    let bestSide = 0;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const side = Math.min((W - (cols - 1) * gap) / cols, (H - (rows - 1) * gap) / rows);
      if (side > bestSide + 0.5) { bestSide = side; best = cols; }
    }
    return best;
  }
  const wanted = n <= 4 ? n : n <= 8 ? Math.ceil(n / 2) : n <= 16 ? 4 : n <= 24 ? 6 : 8;
  // Men aldrig så många att rutorna blir smalare än ca 60 px med valt mellanrum
  const cs = getComputedStyle(container);
  const W = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const gap = parseFloat(cs.columnGap) || 0;
  return Math.max(1, Math.min(wanted, Math.floor((W + gap) / (60 + gap))));
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

function syncFormationButtons() {
  document.querySelectorAll('.formation-btn').forEach((b) => {
    const on = b.dataset.value === ui.formation.value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
}

function formationOpts() {
  return {
    stringLength: Number(ui.stringLength.value) / 100,
    ringGap: Number(ui.ringGap.value),
    ringHole: Number(ui.ringHole.value) / 100,
  };
}

// Visar värdena bredvid reglagen och placerar om
function applyFormationOpts() {
  $('string-length-value').textContent = `${ui.stringLength.value} %`;
  $('ring-gap-value').textContent = `${ui.ringGap.value} px`;
  $('ring-hole-value').textContent = `${ui.ringHole.value} %`;
  layoutPads();
}

function layoutPads() {
  const f = ui.formation.value;
  document.body.dataset.formation = f; // styr vilka formationsreglage som syns
  ui.pads.dataset.formation = f;
  ui.chordPads.dataset.formation = f;

  const tab = document.body.dataset.tab;
  const container = tab === 'notes' ? ui.pads : tab === 'chords' ? ui.chordPads : null;
  if (!container) return; // fliken Inställningar: inget att placera
  const pads = container === ui.pads ? notePads : chordPads;
  pads.forEach((p) => {
    p.el.removeAttribute('style');
    if (p.chord) paintChordPad(p); // färgen ligger också i style
  });

  if (f === 'grid') {
    container.style.height = '';
    container.style.gridTemplateColumns = `repeat(${gridColumns(container, pads.length)}, 1fr)`;
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
  const rects = LAYOUTS[f](pads.length, W, H, Number(ui.padGap.value), formationOpts());
  pads.forEach((p, i) => {
    const r = rects[i];
    Object.assign(p.el.style, {
      left: `${left + r.x}px`,
      top: `${topPad + r.y}px`,
      width: `${r.w}px`,
      height: `${r.h}px`,
      fontSize: `${Math.max(11, r.font)}px`,
    });
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
function applyGap() {
  document.documentElement.style.setProperty('--pad-gap', `${ui.padGap.value}px`);
  $('gap-value').textContent = `${ui.padGap.value} px`;
  layoutPads();
}
