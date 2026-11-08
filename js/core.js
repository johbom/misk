// Grunddata som alla delar använder: tonnamn, skalor, ackordtyper, ui-referenser.
// Hover Pads – spelar ljud (Web Audio) och/eller skickar MIDI (Web MIDI) vid mouseover.
// Två sidor: "Toner" (en ton per ruta) och "Ackord" (2–8 rutor, valfritt ackord i varje).

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
// [suffix, namn i listan, intervall i halvtoner från grundtonen]
const CHORD_TYPES = [
  ['', 'dur', [0, 4, 7]],
  ['m', 'moll', [0, 3, 7]],
  ['7', '7', [0, 4, 7, 10]],
  ['maj7', 'maj7', [0, 4, 7, 11]],
  ['m7', 'm7', [0, 3, 7, 10]],
  ['6', '6', [0, 4, 7, 9]],
  ['m6', 'm6', [0, 3, 7, 9]],
  ['9', '9', [0, 4, 7, 10, 14]],
  ['add9', 'add9', [0, 4, 7, 14]],
  ['sus2', 'sus2', [0, 2, 7]],
  ['sus4', 'sus4', [0, 5, 7]],
  ['dim', 'dim', [0, 3, 6]],
  ['dim7', 'dim7', [0, 3, 6, 9]],
  ['m7b5', 'm7b5', [0, 3, 6, 10]],
  ['aug', 'aug', [0, 4, 8]],
];
const CHORD_INTERVALS = Object.fromEntries(CHORD_TYPES.map(([s, , iv]) => [s, iv]));
const MAX_CHORDS = 8;
// Standard: C G Am F Dm Em E7 Bb
const DEFAULT_CHORDS = [[0, ''], [7, ''], [9, 'm'], [5, ''], [2, 'm'], [4, 'm'], [4, '7'], [10, '']]
  .map(([root, type]) => ({ root, type }));
// Färdig färgpreset: 1 röd, 2 gul, 3 grön, 4 blå, 5 orange, 6 lila, 7 rosa, 8 turkos
const CHORD_PALETTE = ['#e5484d', '#f5c518', '#3fb950', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#14b8a6'];

const NOTE_COUNT_MIN = 1;
const NOTE_COUNT_DEFAULT = 12;
const NOTE_COUNT_MAX = 32;
const ONESHOT_MS = 300;

const $ = (id) => document.getElementById(id);
const ui = {
  outAudio: $('out-audio'),
  outMidi: $('out-midi'),
  outOsc: $('out-osc'),
  oscUrl: $('osc-url'),
  oscPrefix: $('osc-prefix'),
  playMode: $('play-mode'),
  noteLength: $('note-length'),
  vibrato: $('vibrato'),
  xyOctaves: $('xy-octaves'),
  arpOn: $('arp-on'),
  arpPattern: $('arp-pattern'),
  arpBpm: $('arp-bpm'),
  arpRate: $('arp-rate'),
  arpOctaves: $('arp-octaves'),
  arpGate: $('arp-gate'),
  arpRetrig: $('arp-retrig'),
  xySound: $('xy-sound'),
  xyReverb: $('xy-reverb'),
  dwell: $('dwell'),
  releaseDelay: $('release-delay'),
  lockout: $('lockout'),
  showPointer: $('show-pointer'),
  dwellClick: $('dwell-click'),
  uiSize: $('ui-size'),
  steppers: $('steppers'),
  highContrast: $('high-contrast'),
  reduceMotion: $('reduce-motion'),
  scanMode: $('scan-mode'),
  scanSpeed: $('scan-speed'),
  showKeys: $('show-keys'),
  padGap: $('pad-gap'),
  stringLength: $('string-length'),
  ringGap: $('ring-gap'),
  ringHole: $('ring-hole'),
  hexOrder: $('hex-order'),
  formation: $('formation'),
  root: $('root'),
  notesKind: $('notes-kind'),
  drumKit: $('drum-kit'),
  octave: $('octave'),
  scale: $('scale'),
  noteCount: $('note-count'),
  chordCount: $('chord-count'),
  chordOctave: $('chord-octave'),
  chordBass: $('chord-bass'),
  chordAdvanced: $('chord-advanced'),
  preset: $('preset'),
  volume: $('volume'),
  midiOut: $('midi-out'),
  midiCh: $('midi-ch'),
  velocity: $('velocity'),
  panic: $('panic'),
  midiStatus: $('midi-status'),
  pads: $('pads'),
  chordPads: $('chord-pads'),
  log: $('log'),
};

// Mobil och iPad: hela sidan ryms på skärmen och scrollar inte (bara Inställningar scrollar inuti).
// (?fast i adressen slår på det även på dator.)
const FIXED_SCREEN = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1
  || new URLSearchParams(location.search).has('fast');

function log(msg) {
  ui.log.textContent = msg;
  // ▶ ♪ ■ = det som spelas just nu; döljs under Inställningar (style.css)
  ui.log.dataset.kind = /^[▶♪■]/.test(msg) ? 'play' : 'info';
}
