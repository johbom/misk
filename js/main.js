// Uppstart: fyller menyer, läser sparade inställningar och kopplar alla händelser.

// ---------- Uppstart ----------
document.documentElement.classList.toggle('fixed-screen', FIXED_SCREEN);
NOTE_NAMES.forEach((n, i) => ui.root.append(new Option(n, i)));
for (let n = NOTE_COUNT_MIN; n <= NOTE_COUNT_MAX; n++) ui.noteCount.append(new Option(n, n));
ui.noteCount.value = NOTE_COUNT_DEFAULT;
accessDefaults();
loadSettings();
buildFormationButtons();
buildPlayModeButtons();
document.body.classList.toggle('advanced', isAdvanced());
applyGap();
applyFormationOpts();
showSettingsPanel(localStorage.getItem('hoverPadsSettingsTab') || 'play');
setupSynthUi();
buildNotePads();
buildChordPicker();
buildChordPads();
setupStrum();
setupTouch();
setupVibrato();
setupOsc();
setupXY();
setupUserPresets();
setupPwa();
setupAbout();
setupSegments();
setupAccess();
showTab(localStorage.getItem('hoverPadsTab') || 'notes');

for (const k of SAVED) ui[k].addEventListener('change', saveSettings);
[ui.root, ui.octave, ui.scale].forEach((el) => el.addEventListener('change', updateNotes));
ui.chordCount.addEventListener('change', buildChordPads);
$('chord-colors-preset').addEventListener('click', () => setChordColors(CHORD_PALETTE));
$('chord-colors-none').addEventListener('click', () => setChordColors(CHORD_PALETTE.map(() => '')));
ui.noteCount.addEventListener('change', buildNotePads);
[ui.chordOctave, ui.chordBass].forEach((el) => el.addEventListener('change', updateChordLabels));
ui.padGap.addEventListener('input', applyGap);
[ui.stringLength, ui.ringGap, ui.ringHole].forEach((el) => el.addEventListener('input', applyFormationOpts));
document.querySelectorAll('#settings-nav button').forEach((b) =>
  b.addEventListener('click', () => showSettingsPanel(b.dataset.panel)));
ui.formation.addEventListener('change', layoutPads);
ui.chordAdvanced.addEventListener('change', onAdvancedChange);
let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(layoutPads);
});
ui.volume.addEventListener('input', () => engine && engine.setVolume(Number(ui.volume.value)));
ui.midiOut.addEventListener('change', () => { panic(); updateMidiStatus(); saveSettings(); });
ui.outMidi.addEventListener('change', () => { if (!ui.outMidi.checked) panic(); });
ui.midiCh.addEventListener('change', panic);
ui.panic.addEventListener('click', panic);
document.querySelectorAll('#tabs button').forEach((b) =>
  b.addEventListener('click', () => showTab(b.dataset.tab))
);
window.addEventListener('blur', () => { fingers.clear(); resetHover(); allPads().forEach(release); });

// Start: släpp alltid förbi, även om ljudet inte går att starta (då syns felet i loggen)
$('start-btn').addEventListener('click', async () => {
  $('start-overlay').classList.add('hidden');
  try {
    initAudio();
  } catch (err) {
    log(`Kunde inte starta ljudet: ${err.message}`);
  }
  await initMidi();
});
