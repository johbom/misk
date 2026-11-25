// Kortkommandon: tangenter och joystickknappar för viktiga funktioner (Inställningar → Kortkommandon).
//
// Varje funktion har en tangent och en joystickknapp (js/gamepad.js gör knapparna till "tangenter").
// Båda går att lära om (tryck på rutan och sedan på tangenten/knappen) eller ta bort. Ändringarna sparas
// med inställningarna (dolda fältet #shortcut-keys, JSON med bara det som skiljer sig från förvalet).
// Kortkommandona gäller på spelsidorna (Toner, Ackord, XY), inte medan man skriver i ett fält.
// Rutornas tangenter och kontakterna går före: en tangent kan bara ha en uppgift.

const SHORTCUTS = [
  // id, namn, förval tangent, förval joystick, upprepas när den hålls in
  { id: 'soundPrev', name: 'Föregående ljud', key: 'ArrowLeft', pad: 'Gamepad4', rep: true },
  { id: 'soundNext', name: 'Nästa ljud', key: 'ArrowRight', pad: 'Gamepad5', rep: true },
  { id: 'presetPrev', name: 'Föregående preset (Mina presets)', key: 'ArrowUp', pad: 'Gamepad6', rep: true },
  { id: 'presetNext', name: 'Nästa preset (Mina presets)', key: 'ArrowDown', pad: 'Gamepad7', rep: true },
  { id: 'tabNotes', name: 'Sidan Toner', key: 'KeyT', pad: '' },
  { id: 'tabChords', name: 'Sidan Ackord', key: 'KeyK', pad: '' },
  { id: 'tabXY', name: 'Sidan XY', key: 'KeyX', pad: '' },
  { id: 'arp', name: 'Arpeggiator på/av', key: 'KeyA', pad: 'Gamepad8' },
  { id: 'seqPlay', name: 'Sequencer: Start/Stopp', key: 'KeyS', pad: 'Gamepad9', adv: true },
  { id: 'seqRec', name: 'Sequencer: Spela in', key: 'KeyR', pad: '', adv: true },
  { id: 'seqRest', name: 'Sequencer: Paus', key: 'KeyP', pad: '', adv: true },
  { id: 'volUp', name: 'Volym upp', key: 'NumpadAdd', pad: '', rep: true },
  { id: 'volDown', name: 'Volym ned', key: 'NumpadSubtract', pad: '', rep: true },
  { id: 'panic', name: 'Tysta allt', key: 'Backspace', pad: '' },
];
const SHORTCUT_BY_ID = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s]));
const isPadCode = (code) => /^Gamepad/.test(code || '');

// Ändringar mot förvalet: { id: { key, pad } } ('' = borttagen)
function shortcutOverrides() {
  try { const o = JSON.parse(ui.shortcutKeys.value || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
function shortcutCode(id, col) {
  const o = shortcutOverrides()[id];
  if (o && typeof o[col] === 'string') return o[col];
  return SHORTCUT_BY_ID[id][col];
}
function setShortcutCode(id, col, code) {
  const all = shortcutOverrides();
  const cur = { ...(all[id] || {}) };
  if (code === SHORTCUT_BY_ID[id][col]) delete cur[col]; else cur[col] = code;
  if (Object.keys(cur).length) all[id] = cur; else delete all[id];
  ui.shortcutKeys.value = Object.keys(all).length ? JSON.stringify(all) : '';
  saveSettings();
  renderShortcuts();
}
// Vilken funktion har koden? (null = ingen)
function shortcutOf(code) {
  if (!code) return null;
  return SHORTCUTS.find((s) => shortcutCode(s.id, isPadCode(code) ? 'pad' : 'key') === code) || null;
}

// ---------- Funktionerna ----------
// Ljudlistan: alla val utom Eget, i ordning (på Toner också trumseten)
function stepSound(dir) {
  const opts = [...ui.preset.options].filter((o) => o.value !== CUSTOM && !o.disabled);
  if (!opts.length) return;
  const i = opts.findIndex((o) => o.value === ui.preset.value);
  const next = opts[i < 0 ? 0 : (i + dir + opts.length) % opts.length];
  ui.preset.value = next.value;
  ui.preset.dispatchEvent(new Event('change'));
  log(t(`Ljud: ${next.textContent}`));
}

function runShortcut(id) {
  const click = (sel) => { const el = $(sel); if (el && !el.disabled && el.offsetParent !== null) { el.click(); return true; } return false; };
  const tab = (name) => document.querySelector(`#tabs [data-tab="${name}"]`)?.click();
  switch (id) {
    case 'soundPrev': if (document.body.dataset.tab === 'xy') stepXySound(-1); else stepSound(-1); break;
    case 'soundNext': if (document.body.dataset.tab === 'xy') stepXySound(1); else stepSound(1); break;
    case 'presetPrev':
    case 'presetNext':
      if (!loadUserPresets().length) { log(t('Det finns inga sparade presets (Inställningar → Mina presets).')); break; }
      stepUserPreset(id === 'presetNext' ? 1 : -1); break;
    case 'tabNotes': tab('notes'); break;
    case 'tabChords': tab('chords'); break;
    case 'tabXY': tab('xy'); break;
    case 'arp': click('arp-toggle'); break;
    case 'seqPlay':
    case 'seqRec':
    case 'seqRest':
      if (!seqOn() || !seqTab()) { log(t('Slå på stegsequencern (Seq) på Toner eller Ackord först.')); break; }
      click({ seqPlay: 'seq-play', seqRec: 'seq-rec', seqRest: 'seq-rest' }[id]); break;
    case 'volUp':
    case 'volDown': {
      const v = Math.max(0, Math.min(1, Number(ui.volume.value) + (id === 'volUp' ? 0.05 : -0.05)));
      ui.volume.value = v;
      ui.volume.dispatchEvent(new Event('input', { bubbles: true }));
      ui.volume.dispatchEvent(new Event('change', { bubbles: true }));
      log(t(`Volym ${Math.round(v * 100)} %`));
      break;
    }
    case 'panic': seqStopAll(); arpReset(); xyStopAll(); panic(); log(t('Allt tystat.')); break;
    default:
  }
}

// XY: klangerna i tur och ordning
function stepXySound(dir) {
  // (Inspelning finns inte i den enkla versionen)
  const opts = [...ui.xySound.options].filter((o) => o.value !== 'rec' || document.body.dataset.level !== 'simple');
  const i = opts.findIndex((o) => o.value === ui.xySound.value);
  const next = opts[(i + dir + opts.length) % opts.length];
  ui.xySound.value = next.value;
  ui.xySound.dispatchEvent(new Event('change'));
  if (typeof syncSegment === 'function' && ui.xySound.segBox) syncSegment(ui.xySound);
  log(t(`Klang: ${next.textContent}`));
}

// Anropas från tangenthanteraren (js/access.js). Sant = tangenten var ett kortkommando.
function handleShortcut(e) {
  const s = shortcutOf(e.code);
  if (!s) return false;
  e.preventDefault();
  if (e.repeat && !s.rep) return true;
  runShortcut(s.id);
  return true;
}

// ---------- Inställningssidan ----------
function renderShortcuts() {
  const box = $('shortcut-list');
  if (!box) return;
  if (!box.children.length) {
    box.replaceChildren(...SHORTCUTS.map((s) => {
      const row = document.createElement('div');
      row.className = 'sc-row';
      row.dataset.id = s.id;
      if (s.adv) row.classList.add('sc-adv');
      row.innerHTML = `<span class="sc-name"></span>
        <button type="button" class="key-cell sc-cell" data-col="key"><kbd></kbd><span class="kc-learn"></span></button>
        <button type="button" class="key-cell sc-cell" data-col="pad"><kbd></kbd><span class="kc-learn"></span></button>
        <button type="button" class="sc-clear" aria-label="">✕</button>`;
      row.querySelector('.sc-name').textContent = t(s.name);
      row.querySelectorAll('.sc-cell').forEach((b) => b.addEventListener('click', () => {
        const col = b.dataset.col;
        startLearning('shortcut', s.id, b, 'shortcut-msg',
          t(col === 'pad' ? `Tryck nu på joystickknappen för "${s.name}". Esc avbryter.` : `Tryck nu på tangenten för "${s.name}". Esc avbryter.`), col);
      }));
      row.querySelector('.sc-clear').addEventListener('click', () => {
        stopLearning();
        setShortcutCode(s.id, 'key', '');
        setShortcutCode(s.id, 'pad', '');
        $('shortcut-msg').textContent = t(`"${s.name}" har inget kortkommando nu.`);
      });
      return row;
    }));
  }
  box.querySelectorAll('.sc-row').forEach((row) => {
    const s = SHORTCUT_BY_ID[row.dataset.id];
    row.querySelectorAll('.sc-cell').forEach((b) => {
      const code = shortcutCode(s.id, b.dataset.col);
      if (!b.classList.contains('learning')) {
        b.querySelector('kbd').textContent = code ? codeName(code) : '–';
        b.querySelector('.kc-learn').textContent = t('Lär');
      }
      b.setAttribute('aria-label', t(`${s.name}, ${b.dataset.col === 'pad' ? 'joystick' : 'tangent'}: ${code ? codeName(code) : 'ingen'}`));
    });
    row.querySelector('.sc-clear').setAttribute('aria-label', t(`Ta bort kortkommandot för ${s.name}`));
    row.querySelector('.sc-clear').disabled = !shortcutCode(s.id, 'key') && !shortcutCode(s.id, 'pad');
  });
  $('shortcut-reset').disabled = !ui.shortcutKeys.value;
}

// Inlärning (startLearning('shortcut', id, …, col) i js/access.js anropar den här)
function learnShortcut(code) {
  const { n: id, page: col } = learning;
  const s = SHORTCUT_BY_ID[id];
  const msg = $('shortcut-msg');
  const name = codeName(code);
  if (col === 'pad' && !isPadCode(code)) { msg.textContent = t('Tryck på en knapp eller spak på joysticken (eller Esc för att avbryta).'); return; }
  if (col === 'key' && isPadCode(code)) { msg.textContent = t('Det där var joysticken – tryck på en tangent (eller Esc för att avbryta).'); return; }
  if (MODIFIER_KEY.test(code)) { msg.textContent = t(`${name} går inte att använda. Tryck på en annan tangent.`); return; }
  if (keyDigit(code) !== null) { msg.textContent = t(`${name} spelar en ruta. Tryck på en annan tangent.`); return; }
  if (switchOf(code)) { msg.textContent = t(`${name} används redan av kontakt ${switchOf(code)}. Tryck på en annan.`); return; }
  const padUse = ['notes', 'chords'].find((pg) => padKeyList(pg).includes(code));
  if (padUse) { msg.textContent = t(`${name} spelar redan en ruta på ${padUse === 'chords' ? 'Ackord' : 'Toner'}. Tryck på en annan.`); return; }
  const other = shortcutOf(code);
  if (other && other.id !== id) { msg.textContent = t(`${name} används redan av "${other.name}". Tryck på en annan.`); return; }
  stopLearning(t(`"${s.name}" är nu ${name}.`));
  setShortcutCode(id, col, code); // (efter inlärningen, så att rutan visar den nya knappen)
  log(t(`${s.name}: ${name}`));
}

function setupShortcuts() {
  $('shortcut-reset').addEventListener('click', () => {
    stopLearning();
    ui.shortcutKeys.value = '';
    saveSettings();
    renderShortcuts();
    $('shortcut-msg').textContent = t('Kortkommandona är som från början igen.');
  });
  // Ett valt ljud i listan ska inte fånga piltangenterna (de stegar ljuden)
  ui.preset.addEventListener('change', () => ui.preset.blur());
  renderShortcuts();
}
