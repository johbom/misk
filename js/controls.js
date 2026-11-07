// Knappgrupper ("segmenterade reglage") i stället för korta rullgardinslistor.
// Alla val syns på en gång och träffas lätt med finger, mus, blick och tangentbord.
// Värdet ligger kvar i den (dolda) listan, så att sparande, presets och profiler fungerar som förut.

const segmented = []; // listor som visas som knappar

function segmentSelect(sel, cls = '') {
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
    b.textContent = o.text;
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
  segmentSelect(ui.chordCount, 'seg-count');
  segmentSelect(ui.showPointer);
  segmentSelect(ui.uiSize);
  segmentSelect(ui.scanMode);
  segmentSelect(ui.xyOctaves, 'seg-count');
  segmentSelect(ui.arpPattern);
  segmentSelect(ui.arpRate);
  segmentSelect(ui.arpOctaves, 'seg-count');
  segmentSelect(ui.xySound, 'seg-xy');
}
