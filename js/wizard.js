// Startguide: frågar steg för steg om det viktigaste (vad man spelar, tonart, ackordmall,
// spelsätt, formation och ljud) och ställer sedan in allt på en gång.
// Ackordmallarna räknas ut från tonarten med funktionsanalys:
// T = tonika, S = subdominant, D = dominant, p/P = parallell (dur: mollparallellerna Tp Sp Dp).

// Funktion -> [halvtoner från tonartens grundton, ackordtyp]
const FUNC_MAJOR = {
  T: [0, ''], S: [5, ''], D: [7, ''],
  Tp: [9, 'm'], Sp: [2, 'm'], Dp: [4, 'm'],
  D7: [7, '7'], DD: [2, ''], T7: [0, '7'], S7: [5, '7'],
  Tmaj7: [0, 'maj7'], Sp7: [2, 'm7'], Tp7: [9, 'm7'],
};
// Moll: små bokstäver för mollackord, dominanten är dur (harmonisk moll), parallellerna är dur
const FUNC_MINOR = {
  t: [0, 'm'], s: [5, 'm'], D: [7, ''], d: [7, 'm'],
  tP: [3, ''], sP: [8, ''], dP: [10, ''], D7: [7, '7'],
};

const PROGRESSIONS = {
  major: [
    { name: 'Grundackorden', funcs: ['T', 'S', 'D'], desc: 'Tonika, subdominant och dominant – grunden i nästan all musik.' },
    { name: 'Pop', funcs: ['T', 'D', 'Tp', 'S'], desc: 'Den vanligaste poplåten: grundackorden och mollparallellen.' },
    { name: '50-tal', funcs: ['T', 'Tp', 'S', 'D'], desc: 'Doo-wop och ballader. Tonikan går till sin mollparallell.' },
    { name: 'Visa', funcs: ['T', 'S', 'D7', 'Tp'], desc: 'Snälla visackord med dominantseptima som leder hem.' },
    { name: 'Alla sex', funcs: ['T', 'Sp', 'Dp', 'S', 'D', 'Tp'], desc: 'Hela tonarten: grundackorden och alla tre mollparallellerna.' },
    { name: 'Jazz II–V–I', funcs: ['Sp7', 'D7', 'Tmaj7', 'Tp7'], desc: 'Subdominantparallell, dominant och tonika med septimor.' },
    { name: 'Blues', funcs: ['T7', 'S7', 'D7'], desc: 'Tre septimackord för tolvtaktsblues.' },
    { name: 'Hela tonarten', funcs: ['T', 'S', 'D', 'Tp', 'Sp', 'Dp', 'D7', 'DD'], desc: 'Åtta rutor: grundackord, mollparalleller, D7 och dubbeldominanten.' },
  ],
  minor: [
    { name: 'Grundackorden', funcs: ['t', 's', 'D'], desc: 'Moll-tonika, moll-subdominant och dur-dominant.' },
    { name: 'Moll-pop', funcs: ['t', 'sP', 'tP', 'dP'], desc: 'Vemodig pop med durparallellerna.' },
    { name: 'Andalusisk', funcs: ['t', 'dP', 'sP', 'D'], desc: 'Nedåtgående flamencokadens.' },
    { name: 'Ballad', funcs: ['t', 'sP', 's', 'D'], desc: 'Tonika, parallell, subdominant och en dominant som drar hem.' },
    { name: 'Alla sex', funcs: ['t', 's', 'D', 'tP', 'sP', 'dP'], desc: 'Hela molltonarten: grundackorden och alla tre parallellerna.' },
    { name: 'Hela tonarten', funcs: ['t', 's', 'D', 'tP', 'sP', 'dP', 'D7', 'd'], desc: 'Åtta rutor: grundackord, paralleller, D7 och moll-dominanten.' },
  ],
};
const KEEP_CHORDS = -1; // "Egen ackordrunda": ställs in ackord för ackord i guiden

// Ackordets funktion i tonarten (t.ex. "Tp"), eller tomt om det inte är ett av mallarnas ackord
function funcOf(c, mode, root) {
  const hit = Object.entries(funcTable(mode)).find(([, [off, type]]) => (root + off) % 12 === c.root && type === c.type);
  return hit ? hit[0] : '';
}
const customChords = (d) => d.custom.slice(0, d.customCount);

const WIZ_NOTE_COUNTS = [5, 7, 8, 12, 16, 24];
const WIZ_SCALES = { major: 'Dur', minor: 'Moll', pentatonic: 'Pentatonisk', blues: 'Blues', chromatic: 'Kromatisk' };
const WIZ_TABS = { notes: 'Toner', chords: 'Ackord', xy: 'XY' };
// XY: rumsklangens nivåer i guiden (reglaget under Inställningar är steglöst)
const WIZ_REVERBS = [[0, 'Torr'], [0.2, 'Lite'], [0.35, 'Mellan'], [0.6, 'Mycket']];
// XY:s högerkant är C7; omfånget räknas nedåt därifrån
const xyRangeName = (n) => `C${7 - n}–C7`;

const progMode = (scale) => (scale === 'minor' || scale === 'blues' ? 'minor' : 'major');
const funcTable = (mode) => (mode === 'minor' ? FUNC_MINOR : FUNC_MAJOR);
// Funktionsnamnet med upphöjd siffra/tillägg, t.ex. D⁷
const funcLabel = (f) => f.replace(/^([A-Za-z]+?)(maj7|7)$/, '$1<sup>$2</sup>');

function progChords(prog, mode, root) {
  const table = funcTable(mode);
  return prog.funcs.map((f) => ({ root: (root + table[f][0]) % 12, type: table[f][1] }));
}

// Mallen fyller de första rutorna; resten fylls med andra ackord i tonarten (om man ökar antalet senare)
function progFill(prog, mode, root) {
  const used = progChords(prog, mode, root);
  const all = progChords(PROGRESSIONS[mode].at(-1), mode, root);
  const key = (c) => `${c.root}${c.type}`;
  const rest = all.filter((c) => !used.some((u) => key(u) === key(c)));
  while (used.length + rest.length < MAX_CHORDS) rest.push(...all);
  return [...used, ...rest].slice(0, MAX_CHORDS);
}

const wiz = {
  el: null,
  step: 0,
  draft: null,
  orig: null, // ljudet innan guiden (återställs om man avbryter)
  fromStart: false,
  stops: [],
};

// Stegen beror på vad man valt att spela. XY glider steglöst i tonhöjd och har egen klang:
// där frågas inte om tonart, spelsätt, formation eller MIDI, utan om klang, omfång och rumsklang.
function wizSteps() {
  const t = wiz.draft.tab;
  if (t === 'xy') return ['tab', 'sound', 'xyfeel', 'done'];
  return ['tab', 'key', ...(t === 'chords' ? ['prog'] : []), 'mode',
    ...(t === 'xy' ? [] : ['formation']), 'sound', 'done'];
}

function openWizard(fromStart = false) {
  allPads().forEach(release);
  if (!audioCtx) {
    try { initAudio(); } catch {}
  }
  const last = localStorage.getItem('hoverPadsPlayTab') || 'notes';
  const scale = ui.scale.value in WIZ_SCALES ? ui.scale.value : 'major';
  wiz.draft = {
    tab: last in WIZ_TABS ? last : 'notes',
    root: Number(ui.root.value),
    scale,
    noteCount: Number(ui.noteCount.value),
    prog: 1, // Pop / Moll-pop
    // Egen ackordrunda: utgår från de ackord man har nu
    custom: chords.map((c) => ({ root: Number(c.root), type: c.type })),
    customCount: Number(ui.chordCount.value),
    playMode: ui.playMode.value,
    arpOn: ui.arpOn.checked,
    formation: ui.formation.value,
    sound: QUICK_NAMES.includes(synthPreset) ? synthPreset : null,
    drumKit: drumKitOn() ? ui.drumKit.value : '',
    xySound: ui.xySound.value,
    xyOctaves: Number(ui.xyOctaves.value),
    xyReverb: WIZ_REVERBS.reduce((a, b) =>
      (Math.abs(b[0] - Number(ui.xyReverb.value)) < Math.abs(a[0] - Number(ui.xyReverb.value)) ? b : a))[0],
    outAudio: ui.outAudio.checked,
    outMidi: ui.outMidi.checked,
  };
  wiz.orig = { params: { ...synthParams }, preset: synthPreset, lib: { ...synthLib }, xySound: ui.xySound.value };
  wiz.step = 0;
  wiz.fromStart = fromStart;
  renderWizard();
  wiz.el.showModal();
}

function wizStopPreview() {
  wiz.stops.forEach((s) => s());
  wiz.stops = [];
}

// Spelar en följd ackord (listor med toner), ett i taget
function wizPlay(seq, dur = 0.6) {
  if (!engine || !audioCtx) return;
  if (audioCtx.state !== 'running') audioCtx.resume();
  wizStopPreview();
  const t0 = audioCtx.currentTime + 0.05;
  seq.forEach((notes, i) => {
    notes.forEach((n) => {
      const stop = engine.noteOn(n, 0.45, t0 + i * dur);
      stop(t0 + (i + 0.92) * dur);
      wiz.stops.push(() => stop());
    });
  });
  setTimeout(() => { wiz.stops = []; }, (seq.length * dur + 0.5) * 1000);
}

const wizChordNotes = (c) => {
  const base = 48 + c.root;
  return [base - 12, ...CHORD_INTERVALS[c.type].map((i) => base + i)].map(clampNote);
};

function wizPreviewSound() {
  const d = wiz.draft;
  const mode = progMode(d.scale);
  if (d.tab === 'chords' && d.prog !== KEEP_CHORDS) {
    wizPlay(progChords(PROGRESSIONS[mode][d.prog], mode, d.root).slice(0, 2).map(wizChordNotes), 0.7);
  } else if (d.tab === 'chords') {
    wizPlay(customChords(d).slice(0, 2).map(wizChordNotes), 0.7);
  } else {
    // En kort skalslinga i tonarten
    const sc = SCALES[d.scale];
    const notes = [0, 2, 4, 7].map((k) => 60 + d.root + 12 * Math.floor(k / sc.length) + sc[k % sc.length]);
    wizPlay([...notes.map((n) => [n]), [notes[0], notes[2]]], 0.22);
  }
}

// Trumset: en kort takt (bastrumma, hihat, virvel …)
function wizPreviewDrums(kit) {
  if (!audioCtx) return;
  if (audioCtx.state !== 'running') audioCtx.resume();
  const t0 = audioCtx.currentTime + 0.05;
  const step = 0.16;
  [0, 2, 1, 2, 0, 0, 1, 3].forEach((i, k) => drumHit(drumPiece(kit, i), t0 + k * step));
}

// XY: en kort glidning med vald klang, nerifrån och upp på ytan (filtret öppnas)
function wizPreviewXY() {
  if (!audioCtx) return;
  if (audioCtx.state !== 'running') audioCtx.resume();
  wizStopPreview();
  const t = audioCtx.currentTime + 0.05;
  const v = xyMakeVoice(220, 0.3, t);
  v.oscs.forEach((o) => o.frequency.exponentialRampToValueAtTime(440, t + 0.9));
  xyVoiceEnd(v, t + 1.2);
  wiz.stops.push(() => xyVoiceEnd(v));
  setTimeout(() => { wiz.stops = []; }, 1700);
}

// Ett ackord i en mall: färgen på rutan, namnet och funktionen
const wizChordCell = (c, k, f) => `<span class="wiz-chord"><i style="background:${chords[k].color || '#3a3f55'}"></i><b>${
  chordName({ root: c.root, type: c.type, bass: BASS_ROOT })}</b><em>${f ? funcLabel(f) : '&nbsp;'}</em></span>`;

// Egen ackordrunda: antal och grundton + typ för varje ackord
function wizCustomEditor(d, mode) {
  const slots = customChords(d).map((c, k) => {
    const f = funcOf(c, mode, d.root);
    return `<div class="wiz-slot" style="--cr:${chords[k].color || 'var(--border)'}">
      <span class="wiz-slot-num">${k + 1}</span>
      <select data-slot="${k}" data-field="root" data-no-stepper aria-label="Grundton, ackord ${k + 1}">${
        CHORD_ROOTS.map((n, r) => `<option value="${r}"${r === c.root ? ' selected' : ''}>${n}</option>`).join('')}</select>
      <select data-slot="${k}" data-field="type" data-no-stepper aria-label="Typ, ackord ${k + 1}">${
        CHORD_TYPES.map(([suf, name]) => `<option value="${suf}"${suf === c.type ? ' selected' : ''}>${name}</option>`).join('')}</select>
      <em class="wiz-slot-func" title="Funktion i tonarten">${f ? funcLabel(f) : ''}</em>
    </div>`;
  }).join('');
  return `<div class="wiz-custom" role="group" aria-label="Egen ackordrunda">
    <div class="wiz-custom-top">
      <span>Antal ackord</span>
      <button type="button" class="wiz-step" data-act="cnt-" aria-label="Färre ackord"${d.customCount <= 2 ? ' disabled' : ''}>−</button>
      <output>${d.customCount}</output>
      <button type="button" class="wiz-step" data-act="cnt+" aria-label="Fler ackord"${d.customCount >= MAX_CHORDS ? ' disabled' : ''}>+</button>
      <button type="button" class="wiz-listen" data-act="listenCustom">▶ Lyssna</button>
    </div>
    <div class="wiz-slots">${slots}</div>
  </div>`;
}

// Knapp i en valgrupp
function wizOption(key, value, inner, on, extra = '') {
  return `<button type="button" class="wiz-opt ${extra}" role="radio" aria-checked="${on}" data-key="${key}" data-value="${value}">${inner}</button>`;
}

function renderWizard() {
  const d = wiz.draft;
  const steps = wizSteps();
  const step = steps[wiz.step];
  const body = $('wiz-body');
  const mode = progMode(d.scale);
  let title = '';
  let html = '';

  if (step === 'tab') {
    title = 'Vad vill du spela?';
    html = `<div class="wiz-grid wiz-big" role="radiogroup" aria-label="Spela">${
      Object.entries(WIZ_TABS).map(([t, name]) => {
        const icon = document.querySelector(`#tabs button[data-tab="${t}"] svg`).outerHTML;
        const sub = { notes: 'En ton per ruta', chords: 'Ett ackord per ruta', xy: 'Glid fritt i tonhöjd' }[t];
        return wizOption('tab', t, `${icon}<b>${name}</b><small>${sub}</small>`, d.tab === t);
      }).join('')}</div>`;
  } else if (step === 'key') {
    title = 'Vilken tonart?';
    const scales = d.tab === 'chords' ? { major: 'Dur', minor: 'Moll' } : WIZ_SCALES;
    if (!(d.scale in scales)) d.scale = 'major';
    html = `<h4>Grundton</h4><div class="wiz-keys" role="radiogroup" aria-label="Grundton">${
      CHORD_ROOTS.map((n, r) => wizOption('root', r, n, d.root === r)).join('')}</div>
      <h4>${d.tab === 'chords' ? 'Dur eller moll' : 'Skala'}</h4>
      <div class="wiz-row" role="radiogroup" aria-label="Skala">${
      Object.entries(scales).map(([s, name]) => wizOption('scale', s, name, d.scale === s)).join('')}</div>`;
    if (d.tab === 'notes') {
      html += `<h4>Antal rutor</h4><div class="wiz-row" role="radiogroup" aria-label="Antal rutor">${
        WIZ_NOTE_COUNTS.map((n) => wizOption('noteCount', n, n, d.noteCount === n)).join('')}</div>`;
    }
    html += `<p class="wiz-now">Tonart: <b>${CHORD_ROOTS[d.root]} ${WIZ_SCALES[d.scale].toLowerCase()}</b>
      <button type="button" class="wiz-listen" data-act="listen">▶ Lyssna</button></p>`;
  } else if (step === 'prog') {
    title = `Ackordmall i ${CHORD_ROOTS[d.root]} ${mode === 'minor' ? 'moll' : 'dur'}`;
    const list = PROGRESSIONS[mode];
    if (d.prog >= list.length) d.prog = 1;
    html = `<p class="wiz-hint">T = tonika, S = subdominant, D = dominant, p = parallell${
      mode === 'minor' ? '. Små bokstäver är mollackord.' : ' (mollparallellerna).'} Tryck för att lyssna.</p>
      <div class="wiz-progs" role="radiogroup" aria-label="Ackordmall">
      ${wizOption('prog', KEEP_CHORDS, `<span class="wiz-prog-head"><b>Egen ackordrunda</b><small>${d.customCount} ackord</small></span>
        <span class="wiz-chords">${customChords(d).map((c, k) => wizChordCell(c, k, funcOf(c, mode, d.root))).join('')}</span>
        <small class="wiz-desc">${d.prog === KEEP_CHORDS ? 'Ställ in varje ackord här under.' : 'Välj för att ställa in egna ackord, ett i taget.'}</small>`,
        d.prog === KEEP_CHORDS, 'wiz-prog')}
      ${d.prog === KEEP_CHORDS ? wizCustomEditor(d, mode) : ''}
      ${list.map((p, i) => {
        const cs = progChords(p, mode, d.root);
        const cells = cs.map((c, k) => wizChordCell(c, k, p.funcs[k])).join('');
        return wizOption('prog', i, `<span class="wiz-prog-head"><b>${p.name}</b><small>${cs.length} ackord</small></span>
          <span class="wiz-chords">${cells}</span><small class="wiz-desc">${p.desc}</small>`, d.prog === i, 'wiz-prog');
      }).join('')}
      </div>`;
  } else if (step === 'mode') {
    title = 'Hur ska tonerna låta när du spelar?';
    html = `<div class="wiz-grid" role="radiogroup" aria-label="Spelsätt">${
      Object.entries(PLAY_MODES).map(([v, m]) =>
        wizOption('playMode', v, `${m.icon}<b>${m.name}</b><small>${m.desc}</small>`, d.playMode === v)).join('')}</div>
      <button type="button" class="wiz-toggle" role="switch" aria-checked="${d.arpOn}" data-act="arp">
        ${$('arp-toggle').querySelector('svg')?.outerHTML || ''}<span><b>Arpeggiator</b><small>Tonerna spelas en i taget, i takt.</small></span><i class="wiz-switch"></i>
      </button>`;
  } else if (step === 'formation') {
    title = 'Hur ska rutorna ligga?';
    html = `<div class="wiz-grid wiz-forms" role="radiogroup" aria-label="Formation">${
      Object.entries(FORMATIONS).map(([v, name]) =>
        wizOption('formation', v, `${FORMATION_ICONS[v]}<b>${name}</b>`, d.formation === v)).join('')}</div>`;
    if (d.formation === 'strings' && d.tab === 'chords') {
      html += '<p class="wiz-hint">Strängar: dra över ackordet som på en harpa.</p>';
    }
  } else if (step === 'sound') {
    if (d.tab === 'xy') {
      title = 'Vilken klang på XY-plattan?';
      html = `<p class="wiz-hint">På XY glider tonhöjden steglöst från vänster till höger, och uppåt blir ljudet ljusare. Tryck för att lyssna.</p>
        <div class="wiz-row wiz-wrap" role="radiogroup" aria-label="Klang">${
        [...ui.xySound.options].map((o) => wizOption('xySound', o.value,
          `${WAVE_ICONS?.[o.value] ? segIconSvg(WAVE_ICONS[o.value]) : ''}${o.textContent}`, d.xySound === o.value, 'wiz-wave')).join('')}</div>`;
    } else {
      title = 'Vilket ljud?';
      const drums = d.tab === 'notes' ? `<h4>Trumset</h4><p class="wiz-hint">Varje ruta blir en trumma.</p>
        <div class="wiz-sounds wiz-kits" role="radiogroup" aria-label="Trumset">${
        Object.entries(DRUM_KITS).map(([id, k]) => wizOption('drumKit', id, k.name, d.drumKit === id)).join('')}</div>
        <h4>Toner</h4>` : '';
      const cur = d.sound === null && !d.drumKit ? `<p class="wiz-hint">Nu: ${$('sound-now-name')?.textContent || 'eget ljud'}. Välj ett nytt eller gå vidare för att behålla det.</p>` : '';
      html = `${drums}${cur}${QUICK_SOUNDS.map(([engineName, names]) => `<h5 class="wiz-engine">${engineName}</h5>
        <div class="wiz-sounds" role="radiogroup" aria-label="Ljud: ${engineName}">${
        names.map((n) => wizOption('sound', n, n, !d.drumKit && d.sound === n)).join('')}</div>`).join('')}
        <p class="wiz-hint">Tryck för att lyssna. Alla 500 ljud finns under Inställningar → Ljud.</p>`;
    }
  } else if (step === 'xyfeel') {
    title = 'Omfång och rumsklang';
    html = `<h4>Omfång i oktaver</h4><p class="wiz-hint">Hur många oktaver plattan räcker över. Färre oktaver gör det lättare att träffa rätt ton.</p>
      <div class="wiz-octs" role="radiogroup" aria-label="Omfång i oktaver">${
      [1, 2, 3, 4, 5].map((n) => wizOption('xyOctaves', n,
        `<b>${n}</b><small>${xyRangeName(n)}</small>`, d.xyOctaves === n)).join('')}</div>
      <h4>Rumsklang</h4>
      <div class="wiz-row" role="radiogroup" aria-label="Rumsklang">${
      WIZ_REVERBS.map(([v, name]) => wizOption('xyReverb', v, name, d.xyReverb === v)).join('')}</div>
      <button type="button" class="wiz-toggle" role="switch" aria-checked="${d.arpOn}" data-act="arp">
        ${$('arp-toggle').querySelector('svg')?.outerHTML || ''}<span><b>Arpeggiator</b><small>Varje finger upprepas i takt, över oktaverna.</small></span><i class="wiz-switch"></i>
      </button>`;
  } else if (step === 'done' && d.tab === 'xy') {
    title = 'Klart att spela!';
    const rows = [
      ['Spela', 'XY'],
      ['Klang', ui.xySound.querySelector(`option[value="${d.xySound}"]`).textContent],
      ['Omfång', `${d.xyOctaves} oktav${d.xyOctaves > 1 ? 'er' : ''} (${xyRangeName(d.xyOctaves)})`],
      ['Rumsklang', WIZ_REVERBS.find(([v]) => v === d.xyReverb)?.[1] || ''],
      ['Arpeggiator', d.arpOn ? 'På' : 'Av'],
    ];
    html = `<dl class="wiz-summary">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <p class="wiz-hint">Allt går att ändra senare: klangen på XY-sidan, resten under Inställningar. Guiden finns kvar under knappen Guide.</p>`;
  } else if (step === 'done') {
    title = 'Klart att spela!';
    const rows = [
      ['Spela', WIZ_TABS[d.tab]],
      ['Tonart', `${CHORD_ROOTS[d.root]} ${WIZ_SCALES[d.scale].toLowerCase()}`],
    ];
    if (d.tab === 'notes' && d.drumKit) rows.pop(); // trummor har ingen tonart
    if (d.tab === 'notes') rows.push(['Rutor', d.noteCount]);
    if (d.tab === 'chords') {
      rows.push(['Ackord', d.prog === KEEP_CHORDS ? customChords(d).map((c) => chordName({ ...c, bass: BASS_ROOT })).join(' ')
        : progChords(PROGRESSIONS[mode][d.prog], mode, d.root).map((c) => chordName({ ...c, bass: BASS_ROOT })).join(' ')]);
    }
    rows.push(['Spelsätt', PLAY_MODES[d.playMode].name + (d.arpOn ? ' + arpeggiator' : '')]);
    if (d.tab !== 'xy') rows.push(['Formation', FORMATIONS[d.formation]]);
    rows.push(['Ljud', d.tab === 'xy' ? ui.xySound.querySelector(`option[value="${d.xySound}"]`).textContent
      : d.tab === 'notes' && d.drumKit ? `Trumset: ${DRUM_KITS[d.drumKit].name}`
        : d.sound || $('sound-now-name')?.textContent || 'eget ljud']);
    html = `<dl class="wiz-summary">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <h4>Ut</h4>
      <div class="wiz-row">
        <button type="button" class="wiz-toggle small" role="switch" aria-checked="${d.outAudio}" data-act="outAudio"><span><b>Ljud i appen</b></span><i class="wiz-switch"></i></button>
        <button type="button" class="wiz-toggle small" role="switch" aria-checked="${d.outMidi}" data-act="outMidi"><span><b>Skicka MIDI</b></span><i class="wiz-switch"></i></button>
      </div>
      <p class="wiz-hint">Allt går att ändra senare under Inställningar, och guiden finns kvar under knappen Guide.</p>`;
  }

  $('wiz-title').textContent = title;
  $('wiz-progress').innerHTML = steps.map((_, i) =>
    `<i class="${i < wiz.step ? 'past' : i === wiz.step ? 'now' : ''}"></i>`).join('');
  $('wiz-progress').setAttribute('aria-label', `Steg ${wiz.step + 1} av ${steps.length}`);
  $('wiz-count').textContent = `Steg ${wiz.step + 1} av ${steps.length}`;
  body.innerHTML = html;
  body.dataset.step = step;
  $('wiz-back').disabled = wiz.step === 0;
  $('wiz-next').textContent = step === 'done' ? 'Börja spela' : 'Nästa →';
}

function wizChoose(key, raw) {
  const d = wiz.draft;
  const num = ['root', 'noteCount', 'prog', 'xyOctaves', 'xyReverb'].includes(key);
  d[key] = num ? Number(raw) : raw;
  if (key === 'tab' && raw === 'chords' && !(d.scale in { major: 1, minor: 1 })) d.scale = progMode(d.scale);
  if (key === 'scale') d.prog = 1;
  if (key === 'sound') {
    d.drumKit = '';
    synthLib = { name: '', edited: false };
    applySynth(presetParams(raw), raw);
  }
  renderWizard();
  // Fokus kvar på det valda (tangentbord och kontakt)
  $('wiz-body').querySelector(`.wiz-opt[data-key="${key}"][data-value="${CSS.escape(String(d[key]))}"]`)?.focus();
  if (key === 'root' || key === 'scale') wizPreviewSound();
  if (key === 'prog') {
    const mode = progMode(d.scale);
    wizPlay((d.prog === KEEP_CHORDS ? customChords(d) : progChords(PROGRESSIONS[mode][d.prog], mode, d.root))
      .map(wizChordNotes));
  }
  if (key === 'sound') wizPreviewSound();
  if (key === 'drumKit') wizPreviewDrums(raw);
  if (key === 'xySound') {
    ui.xySound.value = raw; // provlyssning; sparas först när guiden är klar
    wizPreviewXY();
  }
}

function wizAct(act) {
  const d = wiz.draft;
  if (act === 'listen') { wizPreviewSound(); return; }
  if (act === 'listenCustom') { wizPlay(customChords(d).map(wizChordNotes)); return; }
  if (act === 'cnt-') d.customCount = Math.max(2, d.customCount - 1);
  if (act === 'cnt+') d.customCount = Math.min(MAX_CHORDS, d.customCount + 1);
  if (act === 'arp') d.arpOn = !d.arpOn;
  if (act === 'outAudio') d.outAudio = !d.outAudio;
  if (act === 'outMidi') d.outMidi = !d.outMidi;
  renderWizard();
  const again = $('wiz-body').querySelector(`[data-act="${act}"]`);
  (again && !again.disabled ? again : $('wiz-body').querySelector('.wiz-custom-top [data-act]:not(:disabled)'))?.focus();
}

// Egen ackordrunda: ett ackord ändrades
function wizSlotChange(sel) {
  const d = wiz.draft;
  const k = Number(sel.dataset.slot);
  const c = d.custom[k];
  if (sel.dataset.field === 'root') c.root = Number(sel.value);
  else c.type = sel.value;
  d.prog = KEEP_CHORDS;
  renderWizard();
  $('wiz-body').querySelector(`select[data-slot="${k}"][data-field="${sel.dataset.field}"]`)?.focus();
  wizPlay([wizChordNotes(c)], 0.9);
}

// Ställer in allt på en gång (samma väg som när ett sparat preset laddas)
function finishWizard() {
  const d = wiz.draft;
  wizStopPreview();
  const data = snapshot();
  if (d.tab === 'xy') {
    // XY: bara det XY använder (tonart, spelsätt, formation och utgångar lämnas orörda)
    Object.assign(data.settings, {
      arpOn: d.arpOn, xySound: d.xySound, xyOctaves: String(d.xyOctaves), xyReverb: String(d.xyReverb),
    });
  } else {
    Object.assign(data.settings, {
      root: String(d.root), scale: d.scale, playMode: d.playMode, arpOn: d.arpOn,
      outAudio: d.outAudio, outMidi: d.outMidi,
    });
  }
  if (d.tab === 'notes') {
    data.settings.noteCount = String(d.noteCount);
    data.settings.notesKind = d.drumKit ? 'drums' : 'tones';
    if (d.drumKit) data.settings.drumKit = d.drumKit;
  }
  if (d.tab !== 'xy') data.settings.formation = d.formation;
  if (d.tab === 'chords' && d.prog === KEEP_CHORDS) {
    data.settings.chordCount = String(d.customCount);
    data.chords = chords.map((old, i) => {
      const c = { ...old, ...d.custom[i] };
      if (c.root !== Number(old.root)) c.bass = BASS_ROOT; // ny grundton: ingen gammal snedstrecksbas
      if (!voicingAllowed(c.voicing, c)) c.voicing = 'root';
      return c;
    });
  } else if (d.tab === 'chords') {
    const mode = progMode(d.scale);
    const prog = PROGRESSIONS[mode][d.prog];
    data.settings.chordCount = String(prog.funcs.length);
    data.chords = progFill(prog, mode, d.root).map((c, i) => ({
      ...chords[i], root: c.root, type: c.type, voicing: 'root', shift: 0, bass: BASS_ROOT,
    }));
  }
  applySnapshot(data);
  // XY:s stödlinjer följer med direkt (rumsklangen sköter applySnapshot)
  ui.xyOctaves.dispatchEvent(new Event('change'));
  // Det är inte längre det sparade presetet
  localStorage.removeItem(USER_PRESET_ACTIVE_KEY);
  renderUserPresets();
  closeWizard(true);
  if (wiz.fromStart) startApp(d.tab);
  else showTab(d.tab);
  log(d.tab === 'xy' ? 'Guiden klar: XY'
    : `Guiden klar: ${CHORD_ROOTS[d.root]} ${WIZ_SCALES[d.scale].toLowerCase()}, ${WIZ_TABS[d.tab]}`);
}

function setupWizard() {
  wiz.el = $('wizard');
  $('wizard-btn').addEventListener('click', () => openWizard(false));
  $('start-wizard').addEventListener('click', () => openWizard(true));
  $('wiz-body').addEventListener('click', (e) => {
    const opt = e.target.closest('.wiz-opt');
    if (opt) { wizChoose(opt.dataset.key, opt.dataset.value); return; }
    const act = e.target.closest('[data-act]');
    if (act) wizAct(act.dataset.act);
  });
  $('wiz-body').addEventListener('change', (e) => {
    if (e.target.matches('select[data-slot]')) wizSlotChange(e.target);
  });
  $('wiz-back').addEventListener('click', () => {
    if (wiz.step > 0) { wiz.step--; renderWizard(); }
  });
  $('wiz-next').addEventListener('click', () => {
    if (wiz.step < wizSteps().length - 1) { wiz.step++; renderWizard(); $('wiz-next').focus(); }
    else finishWizard();
  });
  $('wiz-cancel').addEventListener('click', () => closeWizard(false));
  // Esc
  wiz.el.addEventListener('cancel', (e) => { e.preventDefault(); closeWizard(false); });
}

// Avbruten: ljudet man provlyssnade på återställs
function closeWizard(finished) {
  wizStopPreview();
  if (!finished) {
    synthLib = { ...wiz.orig.lib };
    ui.xySound.value = wiz.orig.xySound;
    applySynth(wiz.orig.params, wiz.orig.preset);
  }
  wiz.el.close();
}
