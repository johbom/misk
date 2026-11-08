// Inställningar som sparas i webbläsaren.

// ---------- Inställningar ----------
const SAVED = ['outAudio', 'outMidi', 'outOsc', 'oscUrl', 'oscPrefix', 'playMode', 'padSpace', 'stringLength', 'ringSpace', 'ringHole', 'hexOrder', 'stringDir', 'formation', 'noteCount', 'notesKind', 'drumKit', 'root', 'octave', 'scale',
  'chordCount', 'chordOctave', 'chordBass', 'chordAdvanced', 'volume', 'midiCh', 'velocity',
  // Tillgänglighet
  'noteLength', 'vibrato', 'arpOn', 'arpPattern', 'arpBpm', 'arpRate', 'arpOctaves', 'arpGate', 'arpRetrig', 'xyOctaves', 'xySound', 'xyReverb', 'dwell', 'releaseDelay', 'lockout', 'showPointer', 'dwellClick', 'uiSize', 'steppers',
  'highContrast', 'reduceMotion', 'scanMode', 'scanSpeed', 'showKeys'];

// Äldre värden som bytt namn (sparade inställningar och presets)
function normalizeSetting(k, v) {
  if (k === 'playMode' && v === 'oneshot') return 'fixed';
  if (k === 'drumKit' && !(v in DRUM_KITS)) return 'acoustic'; // (förr betydde tomt "toner")
  return v;
}

// Förr angavs mellanrummen i px; nu i procent av rutans (eller sektorns) storlek.
// Omräkningen utgår från en vanlig rutstorlek (ca 150 px) och sektorbredd (ca 120 px).
function migrateSpace(s) {
  if (!('padSpace' in s) && 'padGap' in s) ui.padSpace.value = Math.round(Number(s.padGap) / 1.5 / 5) * 5;
  if (!('ringSpace' in s) && 'ringGap' in s) ui.ringSpace.value = Math.min(75, Math.round(Number(s.ringGap) / 1.2));
}

function loadSettings() {
  const s = JSON.parse(localStorage.getItem('hoverPads') || '{}');
  for (const k of SAVED) {
    if (!(k in s)) continue;
    if (ui[k].type === 'checkbox') ui[k].checked = s[k];
    else ui[k].value = normalizeSetting(k, s[k]);
  }
  migrateNotesKind(s);
  migrateSpace(s);
}

// Förr låg "toner" och trumseten i samma val: ett valt trumset betydde trummor
function migrateNotesKind(s) {
  if (!('notesKind' in s) && s.drumKit in DRUM_KITS) ui.notesKind.value = 'drums';
}

function saveSettings() {
  const s = {};
  for (const k of SAVED) s[k] = ui[k].type === 'checkbox' ? ui[k].checked : ui[k].value;
  localStorage.setItem('hoverPads', JSON.stringify(s));
  localStorage.setItem('midiOut', ui.midiOut.value);
}
