// Snabbknappar i spelraden: Formation (sidorna Toner och Ackord) och Tonart (Toner och Ackord).
// Ett tryck öppnar en liten ruta med valen. Det är samma inställningar som under Inställningar → Instrument.
// Arp- och Sekv-knapparna öppnar samma ruta med arpeggiatorns/sequencerns inställningar när de slås på
// (js/arp.js, js/seq.js): då flyttas själva inställningsrutan (#arp-set, #seq-set) dit, och tillbaka
// när rutan stängs.
// Tonarten gäller hela instrumentet: ackorden flyttas med till den nya tonarten (transponeras),
// oavsett vilken spelsida man byter på.

const quick = { open: '' };

function setupQuick() {
  $('quick-formation').addEventListener('click', () => toggleQuick('formation'));
  $('quick-key').addEventListener('click', () => toggleQuick('key'));
  // Klick utanför eller Esc stänger
  document.addEventListener('pointerdown', (e) => {
    if (quick.open && !e.target.closest('#quick-pop, .quick-btn, #arp-toggle, #seq-toggle, #seq-settings')) closeQuick();
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

// Inställningsrutor som flyttas in i snabbrutan: knapp, fieldset och namn
const QUICK_SETS = {
  arp: { btn: 'arp-toggle', set: 'arp-set', name: 'Arpeggiator', close: 'Stäng arpens inställningar', title: 'Stäng (arpen fortsätter)' },
  seq: { btn: 'seq-toggle', set: 'seq-set', name: 'Stegsequencer', close: 'Stäng sequencerns inställningar', title: 'Stäng (sequencern fortsätter)' },
};
const quickBtn = (kind) => $(QUICK_SETS[kind]?.btn || `quick-${kind}`);
const quickBtns = () => document.querySelectorAll('.quick-btn, #arp-toggle, #seq-toggle');

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
  quickSetHome();
  quickBtns().forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

// Inställningsrutan (arp eller sequencer) tillbaka till sin plats under Inställningar → Instrument
let quickSetSpot = null;
function quickSetHome() {
  if (!quickSetSpot) return;
  const set = $(quickSetSpot.data);
  if (set && $('quick-pop').contains(set)) quickSetSpot.replaceWith(set);
  quickSetSpot = null;
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
  const qs = QUICK_SETS[quick.open];
  if (qs) {
    pop.setAttribute('aria-label', t(qs.name));
    const set = $(qs.set);
    if (pop.contains(set)) return;
    quickSetHome();
    quickSetSpot = document.createComment(qs.set);
    set.replaceWith(quickSetSpot);
    // Stäng-knapp: lätt att träffa på mobil, där rutan täcker det mesta av spelytan
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'quick-close';
    close.setAttribute('aria-label', t(qs.close));
    close.title = t(qs.title);
    close.textContent = '✕';
    close.addEventListener('click', closeQuick);
    pop.replaceChildren(close, set);
    return;
  }
  quickSetHome();
  const chordsTab = document.body.dataset.tab === 'chords';
  if (quick.open === 'formation') {
    pop.setAttribute('aria-label', 'Formation');
    pop.innerHTML = `<div class="quick-forms" role="radiogroup" aria-label="Formation">${
      Object.entries(FORMATIONS).map(([v, name]) => `<button type="button" class="formation-btn${
        ui.formation.value === v ? ' on' : ''}" role="radio" aria-checked="${ui.formation.value === v}" data-formation="${v}">${
        FORMATION_ICONS[v]}<span>${name}</span></button>`).join('')}</div>${countRow()}`;
    pop.querySelectorAll('[data-count]').forEach((b) => b.addEventListener('click', () => {
      const el = quickCountInput();
      if (!el || el.value === b.dataset.count) return;
      el.value = b.dataset.count;
      el.dispatchEvent(new Event('change')); // sparar och bygger om rutorna
      log(`${document.body.dataset.tab === 'chords' ? 'Antal ackord' : 'Antal rutor'}: ${el.value}`);
      renderQuick();
    }));
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
        r === root ? 'on' : ''}" data-root="${r}">${n}</button>`).join('')}</div>${octaveRow()}${
      scales.length ? `<div class="quick-scales" role="radiogroup" aria-label="Skala">${
        scales.map((o) => `<button type="button" role="radio" aria-checked="${o.value === ui.scale.value}" class="${
          o.value === ui.scale.value ? 'on' : ''}" data-scale="${o.value}">${o.textContent}</button>`).join('')}</div>` : ''}${
      `<p class="hint">${chordsTab ? 'Ackorden' : 'Ackorden på sidan Ackord'} flyttas med till den nya tonarten.</p>`}`;
    pop.querySelectorAll('[data-root]').forEach((b) => b.addEventListener('click', () => setKeyRoot(Number(b.dataset.root))));
    pop.querySelectorAll('[data-octave]').forEach((b) => b.addEventListener('click', () => {
      const el = quickOctaveInput();
      if (el.value === b.dataset.octave) return;
      el.value = b.dataset.octave;
      el.dispatchEvent(new Event('change')); // sparar och stämmer om rutorna
      log(`Oktav ${el.value}`);
      renderQuick();
    }));
    pop.querySelectorAll('[data-scale]').forEach((b) => b.addEventListener('click', () => {
      ui.scale.value = b.dataset.scale;
      ui.scale.dispatchEvent(new Event('change'));
      log(`Tonart: ${NOTE_NAMES[Number(ui.root.value)]} ${scaleName()}`);
    }));
  }
}

// Antal rutor (Toner) eller ackord (Ackord) direkt i formationsrutan
const QUICK_COUNTS = { notes: [4, 8, 12, 16], chords: [2, 4, 6, 8] };
function quickCountInput() {
  const tab = document.body.dataset.tab;
  return tab === 'chords' ? ui.chordCount : tab === 'notes' ? ui.noteCount : null;
}

function countRow() {
  const el = quickCountInput();
  if (!el) return '';
  const cur = Number(el.value);
  const counts = QUICK_COUNTS[document.body.dataset.tab];
  const what = document.body.dataset.tab === 'chords' ? 'Antal ackord' : 'Antal rutor';
  return `<div class="quick-octaves quick-count" role="radiogroup" aria-label="${what}"><span>${what}</span>${
    counts.map((n) => `<button type="button" role="radio" aria-checked="${n === cur}" class="${
      n === cur ? 'on' : ''}" data-count="${n}">${n}</button>`).join('')}</div>`;
}

// Oktaven hör till sidan: Toner har sin egen, Ackord sin (XY har ett omfång i stället, ingen oktav)
function quickOctaveInput() {
  const tab = document.body.dataset.tab;
  return tab === 'chords' ? ui.chordOctave : tab === 'notes' ? ui.octave : null;
}

function octaveRow() {
  const el = quickOctaveInput();
  if (!el) return '';
  const cur = Number(el.value);
  const octs = [];
  // Oktav 7 och 8 är för höga för att vara med i snabbvalet (de finns kvar under Inställningar)
  for (let o = Number(el.min); o <= Math.min(6, Number(el.max)); o++) octs.push(o);
  return `<div class="quick-octaves" role="radiogroup" aria-label="Oktav"><span>Oktav</span>${
    octs.map((o) => `<button type="button" role="radio" aria-checked="${o === cur}" class="${
      o === cur ? 'on' : ''}" data-octave="${o}">${o}</button>`).join('')}</div>`;
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
