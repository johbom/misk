// Snabbknappar i spelraden: Formation (sidorna Toner och Ackord) och Tonart (alla spelsidor).
// Ett tryck öppnar en liten ruta med valen. Det är samma inställningar som under Inställningar → Spel.
// Arp-knappen öppnar samma ruta med arpeggiatorns inställningar när arpen slås på (js/arp.js):
// då flyttas själva inställningsrutan (#arp-set) dit, och tillbaka när rutan stängs.
// Tonarten gäller hela instrumentet: ackorden flyttas med till den nya tonarten (transponeras),
// oavsett vilken spelsida man byter på.

const quick = { open: '' };

function setupQuick() {
  $('quick-formation').addEventListener('click', () => toggleQuick('formation'));
  $('quick-key').addEventListener('click', () => toggleQuick('key'));
  // Klick utanför eller Esc stänger
  document.addEventListener('pointerdown', (e) => {
    if (quick.open && !e.target.closest('#quick-pop, .quick-btn, #arp-toggle')) closeQuick();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeQuick(); });
  [ui.formation, ui.root, ui.scale].forEach((el) => el.addEventListener('change', syncQuick));
  syncQuick();
}

const scaleName = () => ui.scale.selectedOptions[0]?.textContent.toLowerCase() || '';

// Knapparnas text följer inställningarna
function syncQuick() {
  const f = ui.formation.value;
  $('quick-formation').innerHTML = `${FORMATION_ICONS[f] || ''}<span>${FORMATIONS[f] || ''}</span>`;
  $('quick-key').innerHTML = `<b>${NOTE_NAMES[Number(ui.root.value)]}</b><span>${scaleName()}</span>`;
  $('quick-formation').setAttribute('aria-label', `Formation: ${FORMATIONS[f] || ''}`);
  $('quick-key').setAttribute('aria-label', `Tonart: ${NOTE_NAMES[Number(ui.root.value)]} ${scaleName()}`);
  if (quick.open) renderQuick();
}

const quickBtn = (kind) => $(kind === 'arp' ? 'arp-toggle' : `quick-${kind}`);
const quickBtns = () => document.querySelectorAll('.quick-btn, #arp-toggle');

function toggleQuick(kind) {
  if (quick.open === kind) { closeQuick(); return; }
  openQuick(kind);
}

function openQuick(kind) {
  if (quick.open === kind) return;
  allPads().forEach(release);
  quick.open = kind;
  renderQuick();
  $('quick-pop').hidden = false;
  placeQuick();
  quickBtns().forEach((b) => b.setAttribute('aria-expanded', b === quickBtn(kind)));
}

function closeQuick() {
  if (!quick.open) return;
  quick.open = '';
  $('quick-pop').hidden = true;
  arpSetHome();
  quickBtns().forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

// Arpens inställningar tillbaka till sin plats under Inställningar → Spel
let arpSetSpot = null;
function arpSetHome() {
  const set = $('arp-set');
  if (!arpSetSpot || !$('quick-pop').contains(set)) return;
  arpSetSpot.replaceWith(set);
  arpSetSpot = null;
}

// Rutan hamnar under sin knapp, men aldrig utanför spelraden (och inte nedanför skärmen)
function placeQuick() {
  const pop = $('quick-pop');
  const btn = quickBtn(quick.open);
  const bar = $('play-bar');
  pop.style.top = `${btn.offsetTop + btn.offsetHeight + 6}px`;
  pop.style.left = `${Math.max(8, Math.min(btn.offsetLeft, bar.clientWidth - pop.offsetWidth - 8))}px`;
  pop.style.maxHeight = `${Math.max(160, innerHeight - btn.getBoundingClientRect().bottom - 16)}px`;
}

function renderQuick() {
  const pop = $('quick-pop');
  if (quick.open === 'arp') {
    pop.setAttribute('aria-label', 'Arpeggiator');
    const set = $('arp-set');
    if (pop.contains(set)) return;
    arpSetSpot = document.createComment('arp-set');
    set.replaceWith(arpSetSpot);
    pop.replaceChildren(set);
    return;
  }
  arpSetHome();
  const chordsTab = document.body.dataset.tab === 'chords';
  if (quick.open === 'formation') {
    pop.setAttribute('aria-label', 'Formation');
    pop.innerHTML = `<div class="quick-forms" role="radiogroup" aria-label="Formation">${
      Object.entries(FORMATIONS).map(([v, name]) => `<button type="button" class="formation-btn${
        ui.formation.value === v ? ' on' : ''}" role="radio" aria-checked="${ui.formation.value === v}" data-formation="${v}">${
        FORMATION_ICONS[v]}<span>${name}</span></button>`).join('')}</div>`;
    pop.querySelectorAll('[data-formation]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.formation;
      if (ui.formation.value !== v) {
        ui.formation.value = v;
        ui.formation.dispatchEvent(new Event('change')); // sparar och placerar om
        syncFormationButtons();
        log(`Formation: ${FORMATIONS[v]}`);
      }
      closeQuick();
    }));
  } else {
    pop.setAttribute('aria-label', 'Tonart');
    const root = Number(ui.root.value);
    const scales = chordsTab ? [] : [...ui.scale.options];
    pop.innerHTML = `<div class="quick-roots" role="radiogroup" aria-label="Grundton">${
      NOTE_NAMES.map((n, r) => `<button type="button" role="radio" aria-checked="${r === root}" class="${
        r === root ? 'on' : ''}" data-root="${r}">${n}</button>`).join('')}</div>${
      scales.length ? `<div class="quick-scales" role="radiogroup" aria-label="Skala">${
        scales.map((o) => `<button type="button" role="radio" aria-checked="${o.value === ui.scale.value}" class="${
          o.value === ui.scale.value ? 'on' : ''}" data-scale="${o.value}">${o.textContent}</button>`).join('')}</div>` : ''}${
      `<p class="hint">${chordsTab ? 'Ackorden' : 'Ackorden på sidan Ackord'} flyttas med till den nya tonarten.</p>`}`;
    pop.querySelectorAll('[data-root]').forEach((b) => b.addEventListener('click', () => setKeyRoot(Number(b.dataset.root))));
    pop.querySelectorAll('[data-scale]').forEach((b) => b.addEventListener('click', () => {
      ui.scale.value = b.dataset.scale;
      ui.scale.dispatchEvent(new Event('change'));
      log(`Tonart: ${NOTE_NAMES[Number(ui.root.value)]} ${scaleName()}`);
    }));
  }
}

// Ny grundton. Alla ackord flyttas lika många halvtoner.
function setKeyRoot(r) {
  const old = Number(ui.root.value);
  if (r === old) return;
  transposeChords(r - old);
  ui.root.value = r;
  ui.root.dispatchEvent(new Event('change'));
  log(`Tonart: ${NOTE_NAMES[r]} ${scaleName()}`);
}

function transposeChords(d) {
  const t = (v) => (((Number(v) + d) % 12) + 12) % 12;
  chordPads.forEach(release);
  chords.forEach((c) => {
    c.root = t(c.root);
    if (c.bass >= 0) c.bass = t(c.bass);
  });
  saveChords();
  updateChordLabels();
  buildChordEditor();
}
