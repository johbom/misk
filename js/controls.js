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
// Symboler för arpeggiatorns mönster
const arpDot = (x, y) => `<circle cx="${x}" cy="${y}" r="2.3" fill="currentColor" stroke="none"/>`;
const ARP_ICONS = {
  up: `<path d="M5 18.5 12 12.5 19 6.5" opacity=".45"/>${arpDot(5, 18.5)}${arpDot(12, 12.5)}${arpDot(19, 6.5)}`,
  down: `<path d="M5 6.5 12 12.5 19 18.5" opacity=".45"/>${arpDot(5, 6.5)}${arpDot(12, 12.5)}${arpDot(19, 18.5)}`,
  updown: `<path d="M3.5 18.5 12 6l8.5 12.5" opacity=".45"/>${arpDot(3.5, 18.5)}${arpDot(7.8, 12.3)}${arpDot(12, 6)}${arpDot(16.2, 12.3)}${arpDot(20.5, 18.5)}`,
  random: '<path d="M3 7h3c4.5 0 6.5 10 11 10h3.5M3 17h3c4.5 0 6.5-10 11-10h3.5"/><path d="M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5"/>',
  order: '<path d="M7 5.5v13M4.5 8 7 5.5"/><path d="M11.5 9a2.6 2.6 0 0 1 5 1c0 2.3-5 4.5-5 8.5h5.5"/>',
};
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
  segmentSelect(ui.xyOctaves, 'seg-count');
  segmentSelect(ui.arpPattern, '', ARP_ICONS);
  segmentSelect(ui.arpRate);
  segmentSelect(ui.hexOrder, '', ORDER_ICONS);
  segmentSelect(ui.arpOctaves, 'seg-count');
  segmentSelect(ui.arpRetrig, 'seg-count');
  segmentSelect(ui.xySound, 'seg-xy', WAVE_ICONS);
  segmentSelect(synthInputs.model.input);
}
