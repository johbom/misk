// Knappgrupper ("segmenterade reglage") i stället för korta rullgardinslistor.
// Alla val syns på en gång och träffas lätt med finger, mus, blick och tangentbord.
// Värdet ligger kvar i den (dolda) listan, så att sparande, presets och profiler fungerar som förut.

const segmented = []; // listor som visas som knappar

// Symboler för vågformerna (XY:s klang)
const WAVE_ICONS = {
  sine: '<path d="M2 12c2.5-8 7.5-8 10 0s7.5 8 10 0"/>',
  triangle: '<path d="M2 12l5-6 10 12 5-6"/>',
  warm: '<path d="M2 17c4-1 7-5 9-10v10c4-1 7-5 9-10v10"/>',
  sawtooth: '<path d="M2 17l9-10v10l9-10v10"/>',
  square: '<path d="M2 17V7h5v10h5V7h5v10h5"/>',
  supersaw: '<path d="M2 18l9-10v10l9-10v10"/><path d="M4 14l9-10v10l9-10" opacity=".5"/>',
};
// Symboler för bikupans tonordning (pilar)
const ORDER_ICONS = {
  rows: '<path d="M4 7h15M16 4l3 3-3 3M4 17h15M16 14l3 3-3 3"/>',
  snake: '<path d="M4 5.5h13.5a3.25 3.25 0 0 1 0 6.5H6.5a3.25 3.25 0 0 0 0 6.5H20"/><path d="M17 15.5l3 3-3 3"/>',
  cols: '<path d="M7 4v15M4 16l3 3 3-3M17 4v15M14 16l3 3 3-3"/>',
};
// Symboler för strängarnas riktning
const STRING_DIR_ICONS = {
  v: '<path d="M6 4v16M12 4v16M18 4v16"/>',
  h: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
// Symboler för arpeggiatorns mönster
const arpDot = (x, y) => `<circle cx="${x}" cy="${y}" r="2.3" fill="currentColor" stroke="none"/>`;
const ARP_ICONS = {
  up: `<path d="M5 18.5 12 12.5 19 6.5" opacity=".45"/>${arpDot(5, 18.5)}${arpDot(12, 12.5)}${arpDot(19, 6.5)}`,
  down: `<path d="M5 6.5 12 12.5 19 18.5" opacity=".45"/>${arpDot(5, 6.5)}${arpDot(12, 12.5)}${arpDot(19, 18.5)}`,
  updown: `<path d="M3.5 18.5 12 6l8.5 12.5" opacity=".45"/>${arpDot(3.5, 18.5)}${arpDot(7.8, 12.3)}${arpDot(12, 6)}${arpDot(16.2, 12.3)}${arpDot(20.5, 18.5)}`,
  random: '<path d="M3 7h3c4.5 0 6.5 10 11 10h3.5M3 17h3c4.5 0 6.5-10 11-10h3.5"/><path d="M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5"/>',
  order: '<path d="M7 5.5v13M4.5 8 7 5.5"/><path d="M11.5 9a2.6 2.6 0 0 1 5 1c0 2.3-5 4.5-5 8.5h5.5"/>',
  // Strum: hela ackordet på varje slag (två slag)
  strum: `${arpDot(4.5, 18)}${arpDot(7, 12)}${arpDot(9.5, 6)}${arpDot(14.5, 18)}${arpDot(17, 12)}${arpDot(19.5, 6)}`,
  strumud: `${arpDot(4.5, 18)}${arpDot(7, 12)}${arpDot(9.5, 6)}${arpDot(14.5, 6)}${arpDot(17, 12)}${arpDot(19.5, 18)}`,
};
// ---------- Symbolstöd under Inställningar ----------
// Underflikarna, rubrikerna (legend med data-icon) och profilerna får en symbol framför texten.
// Toner, Ackord, XY, Arp och Seq använder samma symboler som menyn och spelraden.
const ICON_EYE = '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>';
const ICON_SPEAKER = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>';
const ICON_SWITCH = '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/>';
const ICON_MIDI = '<circle cx="12" cy="12" r="9"/><path d="M10.5 21v-2h3v2"/>'
  + [[7, 12.5], [8.5, 9], [12, 7.5], [15.5, 9], [17, 12.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="currentColor" stroke="none"/>`).join('');
const SETTINGS_ICONS = {
  instrument: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9 19.5v-5M15 19.5v-5"/>'
    + '<rect x="7.5" y="4.5" width="3" height="10" rx=".6" fill="currentColor" stroke="none"/><rect x="13.5" y="4.5" width="3" height="10" rx=".6" fill="currentColor" stroke="none"/>',
  sound: ICON_SPEAKER,
  access: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="7.2" r="1.5" fill="currentColor" stroke="none"/><path d="M7.5 10.2h9M12 10.2v4M12 14.2l-2.6 4M12 14.2l2.6 4"/>',
  midi: ICON_MIDI,
  mine: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  vibrato: '<path d="M2.5 12c1.6-4 3.2-4 4.8 0s3.2 4 4.8 0 3.2-4 4.8 0 3.2 4 4.6 0"/>',
  pos: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="15" cy="9" r="2.3" fill="currentColor" stroke="none"/><path d="M7 17l5-5" opacity=".55"/>',
  quick: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  eye: ICON_EYE,
  view: '<path d="M3 18.5 7.5 6l4.5 12.5M4.7 14h5.6"/><circle cx="17" cy="15.3" r="3"/><path d="M20 12v6.5"/>',
  switch: ICON_SWITCH,
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h0M10 10h0M14 10h0M17.5 10h0M7.5 14h9"/>',
  library: '<rect x="3.5" y="4" width="4.5" height="16" rx="1"/><rect x="9.5" y="4" width="4.5" height="16" rx="1"/><path d="m15.6 5.6 3.6-1 3.3 14.4-3.6 1z"/>',
  tweak: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5l3.6-3.6M3.6 6l1.6 1.6M20.4 6l-1.6 1.6M12 2.5v2.2"/>',
  output: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10"/>',
  osc: '<circle cx="5" cy="12" r="2.3"/><circle cx="19" cy="6" r="2.3"/><circle cx="19" cy="18" r="2.3"/><path d="M7.1 11 16.9 7M7.1 13l9.8 4"/>',
  pointer: '<path d="M5.5 3.5 19 12l-6.2 1.6L9.5 20z"/>',
};
// Symboler som redan finns på sidan (menyn och spelraden)
const ICONS_FROM_PAGE = {
  notes: '#tabs [data-tab="notes"] svg', chords: '#tabs [data-tab="chords"] svg', xy: '#tabs [data-tab="xy"] svg',
  arp: '#arp-toggle svg', seq: '#seq-toggle svg',
};
function settingsIcon(name) {
  if (ICONS_FROM_PAGE[name]) {
    const svg = document.querySelector(ICONS_FROM_PAGE[name])?.cloneNode(true);
    if (!svg) return '';
    svg.setAttribute('class', 'set-icon');
    return svg.outerHTML;
  }
  if (name === 'formation') return FORMATION_ICONS.grid.replace('<svg ', '<svg class="set-icon wide" ');
  if (name === 'playmode') return PLAY_MODES.hold.icon.replace('<svg ', '<svg class="set-icon wide" ');
  const inner = SETTINGS_ICONS[name];
  return inner ? `<svg class="set-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>` : '';
}
function setupSettingsIcons() {
  document.querySelectorAll('#settings [data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', settingsIcon(el.dataset.icon)));
}

const segIconSvg = (inner) =>
  `<svg class="seg-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

function segmentSelect(sel, cls = '', icons = null) {
  sel.hidden = true;
  sel.setAttribute('data-no-stepper', ''); // inga − / + på den dolda listan
  const box = document.createElement('div');
  box.className = `seg ${cls}`.trim();
  box.setAttribute('role', 'radiogroup');
  const lab = sel.closest('label');
  const name = sel.getAttribute('aria-label') || (lab && (lab.querySelector('.lbl') || lab).firstChild.textContent.trim()) || '';
  if (name) box.setAttribute('aria-label', name);
  [...sel.options].forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    if (icons && icons[o.value]) {
      b.innerHTML = `${segIconSvg(icons[o.value])}<span>${o.text}</span>`;
      b.classList.add('has-icon');
      b.title = o.text;
    } else b.textContent = o.text;
    b.dataset.value = o.value;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', (e) => {
      e.preventDefault(); // knappen ligger i en label: inget annat ska hända
      if (sel.value === o.value) return;
      sel.value = o.value;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      syncSegment(sel);
    });
    box.append(b);
  });
  // Piltangenter flyttar mellan valen, som i en vanlig radioknappsgrupp
  box.addEventListener('keydown', (e) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const btns = [...box.children];
    const i = btns.indexOf(document.activeElement);
    const next = btns[(i + dir + btns.length) % btns.length];
    next.focus();
    next.click();
  });
  sel.after(box);
  sel.segBox = box;
  segmented.push(sel);
  sel.addEventListener('change', () => syncSegment(sel));
  syncSegment(sel);
}

function syncSegment(sel) {
  [...sel.segBox.children].forEach((b) => {
    const on = b.dataset.value === sel.value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
    b.tabIndex = on ? 0 : -1; // en tabbstopp per grupp
  });
}

// Anropas när värden ändrats utan händelser (profiler, presets, uppstart)
const syncSegments = () => segmented.forEach(syncSegment);

function setupSegments() {
  segmentSelect(ui.root, 'seg-notes');
  segmentSelect(ui.scale);
  segmentSelect(ui.notesKind);
  segmentSelect(ui.drumKit);
  segmentSelect(ui.chordCount, 'seg-count');
  segmentSelect(ui.showPointer);
  segmentSelect(ui.uiSize);
  segmentSelect(ui.scanMode);
  // Hjälpmedel → Tangentbord: Toner / Ackord, med menyns symboler
  const tabIcon = (tab) => document.querySelector(`#tabs [data-tab="${tab}"] svg`)?.innerHTML || '';
  segmentSelect(ui.keyPage, 'seg-pages', { notes: tabIcon('notes'), chords: tabIcon('chords') });
  segmentSelect(ui.xyOctaves, 'seg-count');
  segmentSelect(ui.arpPattern, '', ARP_ICONS);
  segmentSelect(ui.arpRate);
  segmentSelect(ui.hexOrder, '', ORDER_ICONS);
  segmentSelect(ui.stringDir, '', STRING_DIR_ICONS);
  segmentSelect(ui.arpOctaves, 'seg-count');
  segmentSelect(ui.arpRetrig, 'seg-count');
  segmentSelect(ui.seqSteps, 'seg-count');
  segmentSelect(ui.seqRate);
  segmentSelect(ui.xySound, 'seg-xy', WAVE_ICONS);
  segmentSelect(synthInputs.model.input);
}
