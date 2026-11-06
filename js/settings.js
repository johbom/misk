// Inställningar som sparas i webbläsaren.

// ---------- Inställningar ----------
const SAVED = ['outAudio', 'outMidi', 'playMode', 'padGap', 'stringLength', 'ringGap', 'ringHole', 'formation', 'noteCount', 'root', 'octave', 'scale',
  'chordCount', 'chordOctave', 'chordBass', 'chordAdvanced', 'volume', 'midiCh', 'velocity',
  // Tillgänglighet
  'noteLength', 'dwell', 'releaseDelay', 'lockout', 'showPointer', 'dwellClick', 'uiSize', 'steppers',
  'highContrast', 'reduceMotion', 'scanMode', 'scanSpeed', 'showKeys'];

function loadSettings() {
  const s = JSON.parse(localStorage.getItem('hoverPads') || '{}');
  for (const k of SAVED) {
    if (!(k in s)) continue;
    if (ui[k].type === 'checkbox') ui[k].checked = s[k];
    else ui[k].value = s[k];
  }
}

function saveSettings() {
  const s = {};
  for (const k of SAVED) s[k] = ui[k].type === 'checkbox' ? ui[k].checked : ui[k].value;
  localStorage.setItem('hoverPads', JSON.stringify(s));
  localStorage.setItem('midiOut', ui.midiOut.value);
}
