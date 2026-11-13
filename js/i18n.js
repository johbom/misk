// Språk: appen är skriven på svenska, och den engelska versionen översätts när sidan körs.
// Varje text i sidan (även den som skapas senare av skripten) slås upp i EN nedan. Texter som byggs ihop
// med siffror och namn översätts med mönstren i EN_PATTERNS. Längre stycken med länkar och fetstil
// (data-i18n i index.html) byts ut i sin helhet mot EN_HTML.
// Språket väljs med ?lang=en eller ?lang=sv, med knapparna Svenska/English (startrutan och Om-rutan),
// annars efter webbläsarens språk. Den som redan använt den svenska appen behåller svenska.
// Laddas först av alla skript, i <head>.

const LANG_KEY = 'hoverPadsLang';
const LANG = (() => {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'sv' || q === 'en') { localStorage.setItem(LANG_KEY, q); return q; }
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'sv' || saved === 'en') return saved;
    if (localStorage.getItem('hoverPadsTab')) return 'sv'; // har använt appen innan det fanns en engelsk version
  } catch { /* privat läge utan localStorage */ }
  return (navigator.languages || [navigator.language || '']).some((l) => /^sv\b/i.test(l)) ? 'sv' : 'en';
})();
const EN_MODE = LANG === 'en';

function setLang(l) {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* ingen lagring: gäller bara nu */ }
  const url = new URL(location.href);
  url.searchParams.set('lang', l);
  location.replace(url);
}

// TFH: den svenska appen länkar till TFH Sensory, den engelska till TFH i Storbritannien
const TFH_URL = EN_MODE ? 'https://specialneedstoys.com' : 'https://tfhsensory.se';

const EN = {
  // ---------- Startrutan, flikar och spelraden ----------
  'Hover Pads – ljud & MIDI': 'Hover Pads – sound & MIDI',
  'Var vill du börja?': 'Where do you want to start?',
  'Startguide': 'Setup guide',
  'Ställ in tonart, ackord, spelsätt och ljud steg för steg': 'Set up key, chords, playing style and sound step by step',
  'eller börja med ett sparat preset': 'or start with a saved preset',
  'Hover Pads går att installera som app': 'Hover Pads can be installed as an app',
  '– den startar då från hemskärmen och fungerar utan internet.': '– it then starts from the home screen and works without internet.',
  'Installera': 'Install',
  'Med stöd från': 'Supported by',
  'TFH Sensory': 'TFH',
  'tfhsensory.se': 'specialneedstoys.com',
  'Hover Pads från TFH Sensory – tfhsensory.se': 'Hover Pads from TFH – specialneedstoys.com',
  'TFH Sensory (öppnar tfhsensory.se)': 'TFH (opens specialneedstoys.com)',
  'Toner': 'Notes',
  'Ackord': 'Chords',
  'Inställningar': 'Settings',
  'Startguide: ställ in allt steg för steg': 'Setup guide: set everything up step by step',
  'Guide': 'Guide',
  'Om appen': 'About the app',
  'Om': 'About',
  'Installera Hover Pads som app': 'Install Hover Pads as an app',
  'Lås spelytan: bara rutorna syns': 'Lock the play area: only the pads are shown',
  '🔒 Lås': '🔒 Lock',
  'MIDI: ej ansluten': 'MIDI: not connected',
  'Mina presets': 'My presets',
  'Föregående preset': 'Previous preset',
  'Nästa preset': 'Next preset',
  'Ljud': 'Sound',
  'Klang': 'Tone',
  'Varm': 'Warm',
  'Bred': 'Wide',
  'Tonart': 'Key',
  'Reverb för XY': 'Reverb for XY',
  'Arpeggiator på/av (inställningar under Spel)': 'Arpeggiator on/off (settings under Play)',
  'Volym': 'Volume',
  'Senast använd': 'Last used',
  'Svenska': 'Svenska',
  'English': 'English',
  'Språk': 'Language',

  // ---------- Inställningar: Spel ----------
  'Spel': 'Play',
  'Tillgänglighet': 'Accessibility',
  'Ut, MIDI & OSC': 'Output, MIDI & OSC',
  'Hur rutorna på Toner och Ackord ligger.': 'How the pads on Notes and Chords are laid out.',
  'Tomrum mellan rutorna, i procent av rutornas storlek (50 % = halva rutan). Musen kan flyttas där utan att trigga något. Följer med när skärmen är större eller mindre.':
    'Empty space between the pads, as a percentage of the pad size (50% = half a pad). The mouse can move there without triggering anything. Scales with the screen size.',
  'Mellanrum': 'Spacing',
  'Lodrätt: lägsta tonen till vänster. Vågrätt: lägsta tonen längst ned.': 'Vertical: lowest note on the left. Horizontal: lowest note at the bottom.',
  'Riktning': 'Direction',
  'Strängarnas riktning': 'Direction of the strings',
  'Lodrätt': 'Vertical',
  'Vågrätt': 'Horizontal',
  'Stränglängd': 'String length',
  'I vilken ordning tonerna (eller ackorden) ligger i bikupan': 'The order of the notes (or chords) in the honeycomb',
  'Tonordning': 'Note order',
  'Slingrande': 'Winding',
  'Hur tätt sektorerna ligger, i procent av sektorns bredd': 'How closely the sectors sit, as a percentage of the sector width',
  'Mellanrum mellan sektorer': 'Space between sectors',
  'Den tomma vilytan i mitten': 'The empty resting area in the middle',
  'Hålets storlek': 'Hole size',
  'Spelsätt': 'Playing style',
  'Håll': 'Hold',
  'Bestämd längd': 'Fixed length',
  'Längd': 'Length',
  'Ligg kvar': 'Latch',
  'Tonlängd': 'Note length',
  'Låter så länge pekaren är kvar på rutan (gated).': 'Sounds as long as the pointer stays on the pad (gated).',
  'Ett anslag som klingar ut av sig självt. Ljudfiler spelas hela.': 'One strike that rings out by itself. Sound files play in full.',
  'Låter exakt den tonlängd du väljer.': 'Sounds for exactly the note length you choose.',
  'Låter tills nästa ruta. Samma ruta igen tystar.': 'Sounds until the next pad. The same pad again silences it.',
  'Toner, eller ett trumset där varje ruta är en trumma': 'Notes, or a drum kit where each pad is a drum',
  'Rutorna spelar': 'The pads play',
  'Trumset': 'Drum kit',
  'Antal': 'Number',
  'Grundton': 'Root',
  'Oktav': 'Octave',
  'Skala': 'Scale',
  'Dur': 'Major',
  'Moll': 'Minor',
  'Pentatonisk': 'Pentatonic',
  'Kromatisk': 'Chromatic',
  'Bas': 'Bass',
  'Visar voicing och oktavläge per ackord': 'Shows voicing and octave position for each chord',
  'Avancerat (voicing)': 'Advanced (voicing)',
  'Färger': 'Colours',
  '1 röd, 2 gul, 3 grön, 4 blå, 5 orange, 6 lila, 7 rosa, 8 turkos': '1 red, 2 yellow, 3 green, 4 blue, 5 orange, 6 purple, 7 pink, 8 turquoise',
  'Standardfärger': 'Standard colours',
  'Ingen färg': 'No colour',
  'Tonerna spelas en i taget, i takt – med alla spelsätt.': 'The notes are played one at a time, in time – with every playing style.',
  'Mönster': 'Pattern',
  'Upp': 'Up',
  'Ner': 'Down',
  'Upp & ner': 'Up & down',
  'Slump': 'Random',
  'Spelordning': 'Played order',
  'Strum ner & upp': 'Strum down & up',
  'Strum: alla toner i ackordet på varje slag, snabbt efter varandra som på en gitarr. Ner & upp: vartannat slag åt andra hållet.':
    'Strum: every note of the chord on each beat, quickly one after another like on a guitar. Down & up: every other beat the other way.',
  'Tryck i takt – två tryck räcker, fler gör tempot jämnare': 'Tap in time – two taps are enough, more make the tempo steadier',
  'Hur stor del av varje steg tonen låter – kort = staccato': 'How much of each step the note sounds – short = staccato',
  'Notvärde': 'Note value',
  '1/8 triol': '1/8 triplet',
  'En ensam ton arpeggieras över oktaverna': 'A single note is arpeggiated across the octaves',
  'Oktaver': 'Octaves',
  'På: varje ny ruta, nytt ackord eller nytt finger på XY börjar om mönstret och takten från första tonen. Av: takten löper vidare och nya rutor hakar på i takt.':
    'On: every new pad, new chord or new finger on XY restarts the pattern and the beat from the first note. Off: the beat keeps running and new pads join in time.',
  'Retrigg': 'Retrigger',
  'Av': 'Off',
  'På': 'On',
  'På: varje ny ruta börjar om från första tonen, direkt.': 'On: every new pad starts again from the first note, straight away.',
  'Vicka pekaren eller fingret fram och tillbaka (eller upp och ned) på en ruta som låter': 'Wiggle the pointer or finger back and forth (or up and down) on a pad that is sounding',
  'Djup': 'Depth',
  'Vicka pekaren fram och tillbaka på en ruta som låter.': 'Wiggle the pointer back and forth on a pad that is sounding.',
  'Läge på rutan': 'Position on the pad',
  'avancerat': 'advanced',
  'Var på rutan pekaren är styr ljudet medan rutan låter': 'Where the pointer is on the pad controls the sound while the pad is sounding',
  'Styr': 'Controls',
  'Filter: mörkt → ljust': 'Filter: dark → bright',
  'Volym: svagt → starkt': 'Volume: soft → loud',
  'Vibrato: inget → mycket': 'Vibrato: none → a lot',
  'Tonhöjd: böj upp en helton': 'Pitch: bend up a whole tone',
  'Ljudmotorns egna': 'Sound engine’s own',
  'Ljudmotorn': 'Sound engine',
  'Klang 1': 'Tone 1',
  'Klang 2': 'Tone 2',
  'XY-platta': 'XY pad',
  'Tonhöjden glider steglöst från vänster till höger och slutar på C7 – omfånget räknas nedåt därifrån (5 oktaver = C2–C7)':
    'The pitch glides smoothly from left to right and ends at C7 – the range counts down from there (5 octaves = C2–C7)',
  'Omfång': 'Range',
  '1 oktav': '1 octave',
  'XY har egen reverb – rutornas ljud och effekter påverkar inte XY': 'XY has its own reverb – the pads’ sound and effects do not affect XY',

  // ---------- Inställningar: Tillgänglighet ----------
  'Snabbval': 'Quick choice',
  'Aktivering – blick och svävande mus': 'Activation – gaze and hovering mouse',
  'Gäller svävande pekare. Trycker eller drar man spelar det direkt.': 'Applies to a hovering pointer. Pressing or dragging plays straight away.',
  'Aktiveringstid': 'Dwell time',
  'Direkt': 'Instant',
  'Hur länge blicken eller pekaren vilar innan rutan spelar.': 'How long the gaze or pointer rests before the pad plays.',
  'Darrtolerans': 'Tremor tolerance',
  'Hur länge pekaren får glida utanför kanten utan att tonen släpps.': 'How long the pointer may drift past the edge without the note being released.',
  'Spärrtid': 'Lockout time',
  'Samma ruta kan inte spelas om förrän tiden gått.': 'The same pad cannot be played again until the time has passed.',
  'Klicka genom att titta': 'Click by looking',
  'Knappar trycks när pekaren vilat på dem. Av om ögonstyrningen redan klickar.': 'Buttons are pressed when the pointer has rested on them. Off if the eye-gaze system already clicks.',
  'Visning och reglage': 'Display and controls',
  'Storlek': 'Size',
  'Normal': 'Normal',
  'Stor': 'Large',
  'Extra stor': 'Extra large',
  'Större flikar, knappar och text.': 'Larger tabs, buttons and text.',
  'Synlig pekare': 'Visible pointer',
  'Liten': 'Small',
  'En ring som följer pekaren och fylls under väntetiden.': 'A ring that follows the pointer and fills during the dwell time.',
  'Hög kontrast': 'High contrast',
  'Svart bakgrund, vita kanter, gul markering.': 'Black background, white borders, yellow highlight.',
  'Minska rörelse': 'Reduce motion',
  'Inga zoom- och studseffekter.': 'No zoom or bounce effects.',
  'Stora − och + knappar': 'Large − and + buttons',
  'Ändra alla värden utan att dra eller öppna listor.': 'Change every value without dragging or opening lists.',
  'Kontakt och tangentbord': 'Switch and keyboard',
  'Stegning': 'Scanning',
  'En kontakt': 'One switch',
  'Två kontakter': 'Two switches',
  'Rutorna markeras en i taget och spelas med en kontakt. Pekaren spelar inte då.': 'The pads are highlighted one at a time and played with a switch. The pointer does not play then.',
  'Steghastighet': 'Scan speed',
  'Tid på varje ruta.': 'Time on each pad.',
  'Visa tangentsiffror på rutorna': 'Show key numbers on the pads',
  'Visar vilken kontakt eller tangent som spelar vilken ruta.': 'Shows which switch or key plays which pad.',
  'Vilka tangenter gör vad?': 'Which keys do what?',
  'Mellanslag': 'Space',
  'Standard': 'Standard',
  'Mus och pekskärm. Spelar direkt.': 'Mouse and touch screen. Plays straight away.',
  'Ögon – utforska': 'Eyes – explore',
  'Första stegen, orsak och verkan. Låter direkt där blicken landar, tål darr och har stor pekare.':
    'First steps, cause and effect. Sounds straight away where the gaze lands, tolerates tremor and has a large pointer.',
  'Ögon – spela': 'Eyes – play',
  'Van användare. Kort vilotid så man hinner sikta. Ögonstyrningen sköter klicken.': 'Experienced user. A short dwell time to allow aiming. The eye-gaze system handles the clicks.',
  'Ögon – bara titta': 'Eyes – just look',
  'Utan klick: knappar trycks genom att titta, tonen ligger kvar tills nästa ruta.': 'No clicks: buttons are pressed by looking, the note keeps sounding until the next pad.',
  'Kontakt': 'Switch',
  'En kontakt (eller mellanslag) med automatisk stegning. Håll in för lång ton.': 'One switch (or the space bar) with automatic scanning. Hold for a long note.',
  'Föregående': 'Previous',
  'Nästa': 'Next',
  'Minska': 'Decrease',
  'Öka': 'Increase',
  'Spelytan är låst. Håll inne knappen i hörnet i två sekunder för att låsa upp.': 'The play area is locked. Hold the button in the corner for two seconds to unlock.',
  'Upplåst': 'Unlocked',
  'Lås upp – håll inne i två sekunder': 'Unlock – hold for two seconds',
  '🔓 Håll inne för att låsa upp': '🔓 Hold to unlock',

  // ---------- Inställningar: Ljud ----------
  'Valt ljud': 'Current sound',
  'Gäller Toner och Ackord – XY har egen klang.': 'Applies to Notes and Chords – XY has its own tone.',
  'Återställ': 'Reset',
  'Slumpa ljud': 'Random sound',
  'Färdiga ljud': 'Ready-made sounds',
  'ljud – klicka för att ladda och provlyssna. Skruva sedan vidare nedan om du vill.': 'sounds – click to load and preview. Then tweak further below if you like.',
  'Motor': 'Engine',
  'Sök ljud …': 'Search sounds …',
  'Sök bland färdiga ljud': 'Search the ready-made sounds',
  'Inga ljud matchar sökningen.': 'No sounds match the search.',
  'Skruva själv': 'Tweak it yourself',
  'Alla': 'All',
  'Eget': 'Custom',
  'Eget ljud': 'Custom sound',
  'eget ljud': 'custom sound',
  'ändrat': 'edited',
  'Slumpade ett nytt ljud': 'Picked a random new sound',
  'hörs': 'audible',

  // ---------- Inställningar: Ut, MIDI & OSC ----------
  'Utgång': 'Output',
  'Brygga': 'Bridge',
  'Adressprefix': 'Address prefix',
  'Skicka test': 'Send test',
  'Meddelanden': 'Messages',
  'ton (MIDI-nummer), styrka (0 = släpp)': 'note (MIDI number), velocity (0 = release)',
  'sida (notes/chords), ruta (1–), 1 = på / 0 = av': 'page (notes/chords), pad (1–), 1 = on / 0 = off',
  'ackordnamn, ruta': 'chord name, pad',
  'sida, ruta, djup i cent': 'page, pad, depth in cents',
  'Enhet': 'Device',
  '– ingen –': '– none –',
  'Kanal': 'Channel',
  'Skicka All Notes Off – tystar allt som hänger kvar': 'Send All Notes Off – silences anything left hanging',
  'Panik': 'Panic',
  'Panik: All Notes Off skickat': 'Panic: All Notes Off sent',
  'stöds ej i denna webbläsare': 'not supported in this browser',
  'åtkomst nekad': 'access denied',
  'ingen enhet vald': 'no device selected',
  'Ogiltig adress': 'Invalid address',
  'Ansluter …': 'Connecting …',
  'Ingen kontakt med bryggan – försöker igen …': 'No contact with the bridge – trying again …',
  'OSC: inte ansluten – starta bryggan och kryssa i OSC.': 'OSC: not connected – start the bridge and tick OSC.',
  'OSC: skickade /test': 'OSC: sent /test',

  // ---------- Mina presets ----------
  'Sparar allt – ljud, ackord, färger, formation och inställningar – under ett namn.': 'Saves everything – sound, chords, colours, formation and settings – under one name.',
  'Namn, t.ex. Kvällsjam': 'Name, e.g. Evening jam',
  'Spara': 'Save',
  'Visa på spelsidan': 'Show on the play page',
  'Byt preset med ◀ ▶ medan du spelar.': 'Switch presets with ◀ ▶ while you play.',
  'Exportera alla till fil': 'Export all to file',
  'Importera från fil': 'Import from file',
  'Inga sparade presets än. Ställ in allt som du vill ha det, skriv ett namn och tryck Spara.': 'No saved presets yet. Set everything up the way you want it, type a name and press Save.',
  'Ladda': 'Load',
  'Skriv över': 'Overwrite',
  'Spara nuvarande inställningar under det här namnet': 'Save the current settings under this name',
  'Ta bort': 'Delete',
  '– välj –': '– choose –',
  'Det finns inga presets att exportera.': 'There are no presets to export.',
  'Nej': 'No',
  'Ja': 'Yes',

  // ---------- Startguiden ----------
  'Avbryt guiden': 'Cancel the guide',
  '← Tillbaka': '← Back',
  'Nästa →': 'Next →',
  'Börja spela': 'Start playing',
  'Vad vill du spela?': 'What do you want to play?',
  'Spela': 'Play',
  'En ton per ruta': 'One note per pad',
  'Ett ackord per ruta': 'One chord per pad',
  'Glid fritt i tonhöjd': 'Glide freely in pitch',
  'Vilken tonart?': 'Which key?',
  'Dur eller moll': 'Major or minor',
  'Antal rutor': 'Number of pads',
  '▶ Lyssna': '▶ Listen',
  'Ackordmall': 'Chord template',
  'Egen ackordrunda': 'Your own chord set',
  'Antal ackord': 'Number of chords',
  'Färre ackord': 'Fewer chords',
  'Fler ackord': 'More chords',
  'Funktion i tonarten': 'Function in the key',
  'Ställ in varje ackord här under.': 'Set each chord below.',
  'Välj för att ställa in egna ackord, ett i taget.': 'Choose to set your own chords, one at a time.',
  'T = tonika, S = subdominant, D = dominant, p = parallell (mollparallellerna). Tryck för att lyssna.':
    'I = tonic, IV = subdominant, V = dominant; lower case = minor chords. Tap to listen.',
  'T = tonika, S = subdominant, D = dominant, p = parallell. Små bokstäver är mollackord. Tryck för att lyssna.':
    'i = tonic, iv = subdominant, V = dominant; lower case = minor chords. Tap to listen.',
  'Grundackorden': 'The primary chords',
  'Tonika, subdominant och dominant – grunden i nästan all musik.': 'Tonic, subdominant and dominant – the basis of nearly all music.',
  'Pop': 'Pop',
  'Den vanligaste poplåten: grundackorden och mollparallellen.': 'The most common pop song: the primary chords and the relative minor.',
  '50-tal': '50s',
  'Doo-wop och ballader. Tonikan går till sin mollparallell.': 'Doo-wop and ballads. The tonic goes to its relative minor.',
  'Visa': 'Folk song',
  'Snälla visackord med dominantseptima som leder hem.': 'Gentle folk-song chords with a dominant seventh that leads home.',
  'Alla sex': 'All six',
  'Hela tonarten: grundackorden och alla tre mollparallellerna.': 'The whole key: the primary chords and all three minor chords.',
  'Subdominantparallell, dominant och tonika med septimor.': 'ii, V and I with sevenths.',
  'Tre septimackord för tolvtaktsblues.': 'Three seventh chords for twelve-bar blues.',
  'Hela tonarten': 'The whole key',
  'Åtta rutor: grundackord, mollparalleller, D7 och dubbeldominanten.': 'Eight pads: primary chords, minor chords, V7 and the secondary dominant.',
  'Moll-tonika, moll-subdominant och dur-dominant.': 'Minor tonic, minor subdominant and major dominant.',
  'Moll-pop': 'Minor pop',
  'Vemodig pop med durparallellerna.': 'Wistful pop with the relative major chords.',
  'Andalusisk': 'Andalusian',
  'Nedåtgående flamencokadens.': 'Descending flamenco cadence.',
  'Ballad': 'Ballad',
  'Tonika, parallell, subdominant och en dominant som drar hem.': 'Tonic, relative major, subdominant and a dominant that pulls home.',
  'Hela molltonarten: grundackorden och alla tre parallellerna.': 'The whole minor key: the primary chords and all three relative major chords.',
  'Åtta rutor: grundackord, paralleller, D7 och moll-dominanten.': 'Eight pads: primary chords, relative majors, V7 and the minor dominant.',
  'Hur ska tonerna låta när du spelar?': 'How should the notes sound when you play?',
  'Tonerna spelas en i taget, i takt.': 'The notes are played one at a time, in time.',
  'Hur ska rutorna ligga?': 'How should the pads be laid out?',
  'Strängar: dra över ackordet som på en harpa.': 'Strings: sweep across the chord like on a harp.',
  'Vilken klang på XY-plattan?': 'Which tone on the XY pad?',
  'På XY glider tonhöjden steglöst från vänster till höger, och uppåt blir ljudet ljusare. Tryck för att lyssna.':
    'On XY the pitch glides smoothly from left to right, and the sound gets brighter upwards. Tap to listen.',
  'Vilket ljud?': 'Which sound?',
  'Varje ruta blir en trumma.': 'Each pad becomes a drum.',
  'Tryck för att lyssna. Alla 560 ljud finns under Inställningar → Ljud.': 'Tap to listen. All 560 sounds are under Settings → Sound.',
  'Omfång och reverb': 'Range and reverb',
  'Omfång i oktaver': 'Range in octaves',
  'Hur många oktaver plattan räcker över. Färre oktaver gör det lättare att träffa rätt ton.': 'How many octaves the pad spans. Fewer octaves make it easier to hit the right note.',
  'Varje finger upprepas i takt, över oktaverna.': 'Each finger repeats in time, across the octaves.',
  'Torr': 'Dry',
  'Lite': 'A little',
  'Mellan': 'Medium',
  'Mycket': 'A lot',

  // ---------- Snabbknapparna, ackord och övrigt ----------
  'Stäng arpens inställningar': 'Close the arpeggiator settings',
  'Stäng (arpen fortsätter)': 'Close (the arpeggiator keeps going)',
  'Ackorden flyttas med till den nya tonarten.': 'The chords move along to the new key.',
  'Ackorden på sidan Ackord flyttas med till den nya tonarten.': 'The chords on the Chords page move along to the new key.',
  'Arpeggiator på': 'Arpeggiator on',
  'Arpeggiator av': 'Arpeggiator off',
  'Grundläge': 'Root position',
  'Grund': 'Basic',
  '1:a omvändning': '1st inversion',
  '2:a omvändning': '2nd inversion',
  '3:e omvändning': '3rd inversion',
  '1:a omv': '1st inv', '2:a omv': '2nd inv', '3:e omv': '3rd inv',
  'Öppen': 'Open',
  'Typ': 'Type',
  'Oktavläge': 'Octave position',
  'Samma som grundtonen': 'Same as the root',
  'Stäng (Esc)': 'Close (Esc)',
  'Stäng': 'Close',
  'XY-platta: vänster–höger tonhöjd, nedåt–uppåt filter som öppnar': 'XY pad: left–right pitch, down–up filter opening',
  'Mer vibrato →': 'More vibrato →',
  'Filter öppnas →': 'Filter opens →',
  'Dra en ljudfil (wav/mp3) till en ruta på sidan Toner för att byta dess ljud.': 'Drag a sound file (wav/mp3) onto a pad on the Notes page to change its sound.',
  'ljudfil borttagen': 'sound file removed',
  'Starta först, sedan kan du släppa ljudfiler.': 'Start first, then you can drop sound files.',
  'Fel': 'Error',
  'En ny version av appen är installerad – ladda om när det passar.': 'A new version of the app is installed – reload when it suits you.',
  'Hover Pads är installerad som app.': 'Hover Pads is installed as an app.',
  'Du kör redan Hover Pads som installerad app.': 'You are already running Hover Pads as an installed app.',
  'Tryck på Dela (fyrkanten med en pil uppåt) och välj Lägg till på hemskärmen.': 'Tap Share (the square with an arrow pointing up) and choose Add to Home Screen.',
  'Öppna webbläsarens meny ⋮ och välj Installera app.': 'Open the browser menu ⋮ and choose Install app.',
  'Öppna sidan i Chrome, Edge eller Safari för att installera.': 'Open the page in Chrome, Edge or Safari to install.',
  'I Safari: välj Arkiv → Lägg till i Dock.': 'In Safari: choose File → Add to Dock.',
  'Använd installera-ikonen i adressfältet eller webbläsarens meny (Installera Hover Pads). Finns inget sådant val kan appen redan vara installerad.':
    'Use the install icon in the address bar or the browser menu (Install Hover Pads). If there is no such option, the app may already be installed.',
  'Om Hover Pads': 'About Hover Pads',
  'En app från': 'An app from',
  'Installera som app': 'Install as an app',
  'Startar från hemskärmen och fungerar utan internet': 'Starts from the home screen and works without internet',
  'När du är uppkopplad hämtar appen själv den senaste versionen.': 'When you are online, the app fetches the latest version by itself.',
  'Sinnesupplevelser för alla! Alla har rätt till lek, oavsett förutsättningar.': 'Overcoming obstacles to play. Sensory, calming and skill-building toys, chosen with care.', // TFH UK:s egen devis
  'Besök': 'Visit',
  'Tips': 'Tip',
  'Integritet och GDPR': 'Privacy and GDPR',
  'Radera sparade uppgifter': 'Erase stored data',
  'Radera alla inställningar, presets och egna ackord på den här enheten? Det går inte att ångra.': 'Erase all settings, presets and your own chords on this device? This cannot be undone.',
  'Öppna Hover Pads på en annan enhet': 'Open Hover Pads on another device',
  'Skanna QR-koden med kameran i en mobil eller surfplatta.': 'Scan the QR code with the camera on a phone or tablet.',
  'QR-kod till johbom.github.io/misk': 'QR code for johbom.github.io/misk',
  'Version': 'Version',

  // ---------- Formationer, motorer och ljudreglage ----------
  'Rutnät': 'Grid',
  'Cirkel': 'Circle',
  'Ring': 'Ring',
  'Bikupa': 'Honeycomb',
  'Strängar': 'Strings',
  'Båge': 'Arc',
  'Oscillatorer': 'Oscillators',
  'Sträng': 'String',
  'Resonans': 'Resonance',
  'Röst': 'Voice',
  'Blås': 'Winds',
  'Granulär': 'Granular',
  'Sinus': 'Sine',
  'Triangel': 'Triangle',
  'Fyrkant': 'Square',
  'Sågtand': 'Sawtooth',
  'Puls (25 %)': 'Pulse (25%)',
  'Orgel': 'Organ',
  'Vibrafon': 'Vibraphone',
  'Glas': 'Glass',
  'Klocka': 'Bell',
  'Trumma': 'Drum',
  'Metallstav': 'Metal bar',
  'Klangskål': 'Singing bowl',
  'Trä': 'Wood',
  '3 · 3→2→1 och 4→1': '3 · 3→2→1 and 4→1',
  '4 · 4→3→1 och 2→1': '4 · 4→3→1 and 2→1',
  '5 · Två par: 2→1, 4→3': '5 · Two pairs: 2→1, 4→3',
  '6 · 4→1, 2 och 3': '6 · 4→1, 2 and 3',
  '7 · 4→3, 1 och 2 hörs': '7 · 4→3, 1 and 2 audible',
  '8 · Alla fyra hörs (orgel)': '8 · All four audible (organ)',
  'Puls': 'Pulse',
  'Vokal': 'Vowel',
  'Synk': 'Sync',
  'Veck': 'Fold',
  'Tenor': 'Tenor',
  'Alt': 'Alto',
  'Sopran': 'Soprano',
  'Barn': 'Child',
  'Kör (u → i)': 'Choir (u → i)',
  'Stråkar': 'Strings',
  'Vind': 'Wind',
  'Regn': 'Rain',
  'Bäck': 'Stream',
  'Fåglar': 'Birds',
  'Oscillator 2 (nivå eller FM-djup)': 'Oscillator 2 (level or FM depth)',
  'Wah (resonansfilter)': 'Wah (resonant filter)',
  'Ljushet': 'Brightness',
  'Dämpning (klingtid)': 'Damping (ring time)',
  'Ljushet (övertonerna)': 'Brightness (overtones)',
  'Modulationsdjup': 'Modulation depth',
  'Detune (med flera röster)': 'Detune (with several voices)',
  'Vokal u → i': 'Vowel u → i',
  'Luft': 'Air',
  'Blåstryck': 'Breath pressure',
  'Andning': 'Breath noise',
  'Position i källan': 'Position in the source',
  'Täthet': 'Density',
  'Förhållande': 'Ratio',
  'Nivå': 'Level',
  'Anslag': 'Exciter',
  'Knäppt': 'Plucked',
  'Slagen': 'Struck',
  'Stråke': 'Bow',
  'Kropp': 'Body',
  'Klingtid': 'Ring time',
  'Anslagspunkt': 'Strike point',
  'Vid kanten': 'At the edge',
  'Mitten': 'Middle',
  'Algoritm': 'Algorithm',
  'Tabell': 'Table',
  'Rörelse': 'Movement',
  'Rörelsetid': 'Movement time',
  'Svängning': 'Swing',
  'Takt': 'Rate',
  'Röstläge': 'Voice type',
  'Vokalglidning': 'Vowel glide',
  'Sångvibrato': 'Singing vibrato',
  'Röster': 'Voices',
  'Solo': 'Solo',
  'Instrument': 'Instrument',
  'Flöjt': 'Flute',
  'Rörblad (klarinett)': 'Reed (clarinet)',
  'Anblåsning': 'Attack (breath)',
  'Källa': 'Source',
  'Vandring': 'Scan',
  'Står still': 'Still',
  'Spridning': 'Spread',
  'Kornstorlek': 'Grain size',
  'Tonslump': 'Pitch jitter',
  'Stereobredd': 'Stereo width',
  'Vågform': 'Waveform',
  'Läge': 'Mode',
  'FM → osc 1': 'FM → osc 1',
  'FM-djup': 'FM depth',
  'Transp.': 'Transp.',
  'Fin': 'Fine',
  'Brus': 'Noise',
  'Lågpass': 'Low-pass',
  'Högpass': 'High-pass',
  'Bandpass': 'Band-pass',
  'Env-mängd': 'Env amount',
  'Volymkurva': 'Envelope',
  'Tonhöjd (vibrato)': 'Pitch (vibrato)',
  'Filter (wah)': 'Filter (wah)',
  'Volym (tremolo)': 'Volume (tremolo)',
  'Hastighet': 'Rate',
  'Effekter': 'Effects',
  'Delaytid': 'Delay time',
  'Rumsstorlek': 'Room size',

  // ---------- Trumset och ljudeffekter ----------
  'Trumset och ljudeffekter': 'Drum kits and sound effects',
  'Ljudeffekter': 'Sound effects',
  'Set': 'Set',
  'Toner, eller ett trumset där varje ruta är en trumma eller en ljudeffekt': 'Notes, or a kit where each pad is a drum or a sound effect',
  'Varje ruta blir en ljudeffekt: sirén, lufthorn, laser, boing …': 'Each pad becomes a sound effect: siren, air horn, laser, boing …',
  'Tecknat & lek': 'Cartoon & play',
  'Syntrumma': 'Syndrum', 'Hög syntrumma': 'High syndrum', 'Syntrumvirvel': 'Syndrum roll', 'Dubbellaser': 'Double laser',
  'Disco-visselpipa': 'Disco whistle', 'Sirén': 'Siren', 'Orkesterslag': 'Orchestra hit', 'Stor handklapp': 'Big handclap',
  'Uppsvep': 'Upsweep', 'Nedsvep': 'Downsweep', 'Rymdbubbla': 'Space bubble', 'Glitterregn': 'Glitter rain',
  'Dubsirén': 'Dub siren', 'Snabb dubsirén': 'Fast dub siren', 'Stigande sirén': 'Rising siren', 'Sirénpip': 'Siren beeps',
  'Lufthorn': 'Air horn', 'Långt lufthorn': 'Long air horn', 'Skott': 'Gunshot', 'Bomb': 'Bomb', 'Fallande bomb': 'Falling bomb',
  'Dubvirvel': 'Dub snare', 'Fjäderkrasch': 'Spring crash', 'Tillbakaspolning': 'Rewind', 'Skivskrap': 'Record scratch',
  'Visselpipa': 'Whistle', 'Åska': 'Thunder',
  'Glidflöjt upp': 'Slide whistle up', 'Glidflöjt ner': 'Slide whistle down', 'Plopp': 'Pop',
  'Busvissling': 'Wolf whistle',
  'Cykeltuta': 'Bike horn', 'Mynt': 'Coin', 'Hopp': 'Jump', 'Kraft': 'Power-up', 'Dörrklocka': 'Doorbell',
  'Applåd': 'Applause', 'Xylofonrusch': 'Xylophone run', 'Smäll': 'Bang',
  'Akustiskt': 'Acoustic',
  'Slagverk': 'Percussion',
  'Bastrumma': 'Kick drum',
  'Bastrumma 2': 'Kick drum 2',
  'Virvel': 'Snare',
  'Virvel 2': 'Snare 2',
  'Hihat': 'Hi-hat',
  'Öppen hihat': 'Open hi-hat',
  'Golvtom': 'Floor tom',
  'Låg tom': 'Low tom',
  'Mellantom': 'Mid tom',
  'Hög tom': 'High tom',
  'Kantslag': 'Rimshot',
  'Hihatpedal': 'Hi-hat pedal',
  'Tamburin': 'Tambourine',
  'Handklapp': 'Handclap',
  'Koskälla': 'Cowbell',
  'Ride-klocka': 'Ride bell',
  'Låg conga': 'Low conga',
  'Mellanconga': 'Mid conga',
  'Hög conga': 'High conga',
  'Träblock': 'Wood block',
  'Dov bastrumma': 'Deep kick',
  'Snärt': 'Snap',
  'Dämpad conga': 'Muted conga',
  'Låg bongo': 'Low bongo',
  'Hög bongo': 'High bongo',
  'Låg timbal': 'Low timbale',
  'Hög timbal': 'High timbale',
  'Låg agogo': 'Low agogo',
  'Hög agogo': 'High agogo',
  'Låg träblock': 'Low wood block',
  'Högt träblock': 'High wood block',

  // ---------- Ljudbibliotekets kategorier ----------
  'Klaviatur': 'Keys',
  'Klockor': 'Bells',
  'Stråk & blås': 'Strings & winds',
  'Atmosfär': 'Atmosphere',
  'Retro & chip': 'Retro & chip',
  'Akustisk gitarr': 'Acoustic guitar',
  'Elgitarr': 'Electric guitar',
  'Strängbas': 'String bass',
  'Harpa och lyra': 'Harp and lyre',
  'Asiatiska strängar': 'Asian strings',
  'Folk och lutor': 'Folk and lutes',
  'Slagna strängar': 'Struck strings',
  'Pizzicato och korta': 'Pizzicato and short',
  'Ambienta strängar': 'Ambient strings',
  'Marimba och xylofon': 'Marimba and xylophone',
  'Kyrk- och handklockor': 'Church and hand bells',
  'Metall och speldosor': 'Metal and music boxes',
  'Trummor och trä': 'Drums and wood',
  'Gonggar och skålar': 'Gongs and bowls',
  'Ambienta klanger': 'Ambient tones',
  'FM-piano': 'FM piano',
  'FM-klockor': 'FM bells',
  'FM-stavspel och glas': 'FM mallets and glass',
  'FM-bas': 'FM bass',
  'FM-mässing och träblås': 'FM brass and woodwinds',
  'FM-mattor och röster': 'FM pads and voices',
  'FM-lead och pop': 'FM lead and pop',
  'FM-orgel': 'FM organ',
  'FM-knäppt': 'FM plucked',
  'FM-atmosfär och slagverk': 'FM atmosphere and percussion',
  'Stavspel och glas': 'Mallets and glass',
  'Mässing och träblås': 'Brass and woodwinds',
  'Mattor och röster': 'Pads and voices',
  'Lead och pop': 'Lead and pop',
  'Atmosfär och slagverk': 'Atmosphere and percussion',
  'Vågmattor': 'Wave pads',
  'Våglead': 'Wave leads',
  'Vågbas': 'Wave bass',
  'Vågplock och keys': 'Wave plucks and keys',
  'Röster och vokaler': 'Voices and vowels',
  'Rörliga ljud': 'Moving sounds',
  'Synk och aggressiva': 'Sync and aggressive',
  'Vågklockor och glas': 'Wave bells and glass',
  'Vågorgel': 'Wave organ',
  'Vågatmosfär': 'Wave atmosphere',
  'Sångröster': 'Singing voices',
  'Röstsynt': 'Voice synth',
  'Flöjter': 'Flutes',
  'Rörblad': 'Reeds',
  'Kornmoln': 'Grain clouds',
  'Natur & texturer': 'Nature & textures',
};

// Ljudens namn (snabbval, oscillatorljud och de 560 i biblioteket). Namn som är likadana på engelska saknas.
Object.assign(EN, {
  'Elpiano': 'Electric piano', 'Varm pad': 'Warm pad', 'Supersaw-lead': 'Supersaw lead', 'Rymd': 'Space',
  'Gitarr': 'Guitar', 'Kontrabas': 'Double bass', 'Panflöjt': 'Pan flute', 'Dragspel': 'Accordion', 'Kör': 'Choir',
  'Enkel': 'Simple',
  'Mjukt elpiano': 'Soft electric piano', 'Tine-piano': 'Tine piano', 'Leksakspiano': 'Toy piano', 'Cembalo': 'Harpsichord',
  'Syntpiano': 'Synth piano', 'Distade keys': 'Distorted keys', 'Glaspiano': 'Glass piano', 'Mjuk matta': 'Soft pad',
  'Analog stråkmatta': 'Analogue string pad', 'Körmatta': 'Choir pad', 'Glasmatta': 'Glass pad', 'Mörk drone': 'Dark drone',
  'Svepande matta': 'Sweeping pad', 'Varm mässingsmatta': 'Warm brass pad', 'Tremolomatta': 'Tremolo pad',
  'Orgelmatta': 'Organ pad', 'Klassisk saw-lead': 'Classic saw lead', 'Fyrkantslead': 'Square lead',
  'Sinusflöjt': 'Sine flute', 'Kvintlead': 'Fifths lead', 'Distad lead': 'Distorted lead', 'Mjuk lead': 'Soft lead',
  'FM-lead': 'FM lead', 'Vissling': 'Whistle', 'Acid-lead': 'Acid lead', 'Trance-supersaw': 'Trance supersaw',
  'Sub-bas': 'Sub bass', 'Analog bas': 'Analogue bass', 'Acid-bas': 'Acid bass', 'Fingerbas': 'Finger bass',
  'Wobble-bas': 'Wobble bass', 'Reese-bas': 'Reese bass', 'Knäppbas': 'Plucked bass', 'Distbas': 'Dist bass',
  'Bomb-bas': 'Bomb bass', 'Klassisk pluck': 'Classic pluck', 'Harpa': 'Harp', 'Gitarrknäpp': 'Guitar pluck',
  'Droppe': 'Droplet', 'Syntarpeggio': 'Synth arpeggio', 'Glasknäpp': 'Glass flick', 'Kyrkklocka': 'Church bell',
  'Klockspel': 'Chimes', 'Xylofon': 'Xylophone', 'Speldosa': 'Music box', 'Rörklocka': 'Tubular bell',
  'Kristall': 'Crystal', 'Jazzorgel': 'Jazz organ', 'Rockorgel': 'Rock organ', 'Kyrkorgel': 'Church organ',
  'Gospelorgel': 'Gospel organ', 'Flöjtstämma': 'Flute stop', 'Kombo-orgel': 'Combo organ', 'Kammarorgel': 'Chamber organ',
  'Mörk orgel': 'Dark organ', 'Ångorgel': 'Calliope', 'Stråkensemble': 'String ensemble', 'Solofiol': 'Solo violin',
  'Mässing': 'Brass', 'Klarinett': 'Clarinet', 'Saxofon': 'Saxophone', 'Kör aah': 'Choir aah', 'Rymdvind': 'Space wind',
  'Djuphav': 'Deep sea', 'Norrsken': 'Northern lights', 'Spöke': 'Ghost', 'Ekokammare': 'Echo chamber',
  'Radiostörning': 'Radio static', 'Mörk portal': 'Dark portal', 'Havsvågor': 'Ocean waves', 'Stjärnstoft': 'Stardust',
  '8-bit puls': '8-bit pulse', '8-bit fyrkant': '8-bit square', 'Fickspel': 'Handheld game', 'Hemdator': 'Home computer',
  'Triangelbas': 'Triangle bass', 'Bitklocka': 'Bit bell', 'Pling': 'Ping', 'Retrolead': 'Retro lead',
  'Nylonsträng': 'Nylon string', 'Stålsträng': 'Steel string', 'Spansk gitarr': 'Spanish guitar', 'Fingerspel': 'Fingerpicking',
  'Dämpad gitarr': 'Muted guitar', 'Tolvsträngad': 'Twelve-string', 'Jazzgitarr': 'Jazz guitar', 'Slidegitarr': 'Slide guitar',
  'Lägereldsgitarr': 'Campfire guitar', 'Mjuk gitarr': 'Soft guitar', 'Ren elgitarr': 'Clean electric guitar',
  'Crunchgitarr': 'Crunch guitar', 'Distad gitarr': 'Distorted guitar', 'Fuzzgitarr': 'Fuzz guitar',
  'Tremologitarr': 'Tremolo guitar', 'Chorusgitarr': 'Chorus guitar', 'Surfgitarr': 'Surf guitar', 'Funkgitarr': 'Funk guitar',
  'Ekogitarr': 'Echo guitar', 'Bluesgitarr': 'Blues guitar', 'Kontrabas pizz': 'Double bass pizz',
  'Fingerspelad strängbas': 'Fingered string bass', 'Plektrumbas': 'Pick bass', 'Fretlessbas': 'Fretless bass',
  'Slapbas': 'Slap bass', 'Dämpad bas': 'Muted bass', 'Dubbas': 'Dub bass', 'Distad strängbas': 'Distorted string bass',
  'Mjuk bas': 'Soft bass', 'Bas med eko': 'Bass with echo', 'Harpsträng': 'Harp string', 'Konsertharpa': 'Concert harp',
  'Keltisk harpa': 'Celtic harp', 'Lyra': 'Lyre', 'Psalterium': 'Psaltery', 'Ljus harpa': 'Bright harp',
  'Harpa i sal': 'Harp in a hall', 'Drömharpa': 'Dream harp', 'Kotosträng': 'Koto string', 'Sitarsträng': 'Sitar string',
  'Femsträngad banjo': 'Five-string banjo', 'Luta': 'Lute', 'Balalajka': 'Balalaika', 'Cittra': 'Cittern',
  'Hackbräde': 'Hammered dulcimer', 'Strängpiano': 'String piano', 'Klaverhammare': 'Piano hammer', 'Klavikord': 'Clavichord',
  'Mjukt hammarpiano': 'Soft hammer piano', 'Ljust hammarpiano': 'Bright hammer piano', 'Saloonpiano': 'Saloon piano',
  'Dämpad hammare': 'Muted hammer', 'Hammare i hall': 'Hammer in a hall', 'Stråkcello': 'Bowed cello', 'Fiol': 'Violin',
  'Kontrabas med stråke': 'Bowed double bass', 'Spelmansfiol': 'Fiddle', 'Stråkgrupp': 'String section',
  'Tremolostråke': 'Tremolo strings', 'Långsam stråke': 'Slow bow', 'Pizz-fiol': 'Pizz violin', 'Pizz-cello': 'Pizz cello',
  'Pizz-ensemble': 'Pizz ensemble', 'Dämpat knäpp': 'Muted pluck', 'Klipp': 'Snip', 'Spröd sträng': 'Brittle string',
  'Pickad sträng': 'Picked string', 'Plock i rum': 'Pluck in a room', 'Snabbknäpp': 'Quick pluck',
  'Ambientgitarr': 'Ambient guitar', 'Drömsträng': 'Dream string', 'Kosmisk sträng': 'Cosmic string',
  'Ekande stråke': 'Echoing bow', 'Isande sträng': 'Icy string', 'Mörk sträng': 'Dark string', 'Glittersträng': 'Glitter string',
  'Vågsträng': 'Wave string', 'Shimmergitarr': 'Shimmer guitar', 'Stilla sträng': 'Still string',
  'Marimbaträ': 'Marimba wood', 'Konsertmarimba': 'Concert marimba', 'Mjukt marimbaträ': 'Soft marimba wood',
  'Djup marimbabas': 'Deep marimba bass', 'Träxylofon': 'Wooden xylophone', 'Ljus marimba': 'Bright marimba',
  'Marimba i rum': 'Marimba in a room', 'Dämpad marimba': 'Muted marimba', 'Gungande marimba': 'Swinging marimba',
  'Vibrafonstav': 'Vibraphone bar', 'Jazzvibrafon': 'Jazz vibraphone', 'Vibrafon utan motor': 'Vibraphone without motor',
  'Långsam vibrafon': 'Slow vibraphone', 'Snabb vibrafon': 'Fast vibraphone', 'Mjuk vibrafon': 'Soft vibraphone',
  'Ljus vibrafon': 'Bright vibraphone', 'Vibrafon med eko': 'Vibraphone with echo', 'Dämpad vibrafon': 'Muted vibraphone',
  'Vibrafon i hall': 'Vibraphone in a hall', 'Tornklocka': 'Tower bell', 'Orkesterrörklocka': 'Orchestral tubular bell',
  'Liten klocka': 'Small bell', 'Handklocka': 'Handbell', 'Mässingsklocka': 'Brass bell', 'Stavklockspel': 'Bar chimes',
  'Djup klocka': 'Deep bell', 'Klockor i dimma': 'Bells in the mist', 'Julklocka': 'Christmas bell',
  'Fjärran klocka': 'Distant bell', 'Glasklang': 'Glass tone', 'Vinglas': 'Wine glass', 'Glasharpa': 'Glass harp',
  'Kristallglas': 'Crystal glass', 'Glasskål': 'Glass bowl', 'Isklang': 'Ice tone', 'Glasregn': 'Glass rain',
  'Tunt glas': 'Thin glass', 'Tjockt glas': 'Thick glass', 'Glas i rum': 'Glass in a room', 'Tumpiano': 'Thumb piano',
  'Mekanisk speldosa': 'Mechanical music box', 'Celestastav': 'Celesta bar', 'Triangelstav': 'Triangle bar',
  'Metallofon': 'Metallophone', 'Gamelanstav': 'Gamelan bar', 'Stålstav': 'Steel bar', 'Mjuk metallofon': 'Soft metallophone',
  'Rostig stav': 'Rusty bar', 'Tumkalimba': 'Thumb kalimba', 'Djup kalimba': 'Deep kalimba', 'Ljus kalimba': 'Bright kalimba',
  'Kalimba med eko': 'Kalimba with echo', 'Kalimba i hall': 'Kalimba in a hall', 'Leksakskalimba': 'Toy kalimba',
  'Dämpad kalimba': 'Muted kalimba', 'Kalimbadrömmar': 'Kalimba dreams', 'Handtrumma': 'Hand drum',
  'Stämd tomtom': 'Tuned tom', 'Slitstrumma': 'Slit drum', 'Pauk': 'Timpani', 'Ramtrumma': 'Frame drum', 'Bambu': 'Bamboo',
  'Trinidadpan': 'Trinidad pan', 'Tenorpan': 'Tenor pan', 'Baspan': 'Bass pan', 'Ljus steelpan': 'Bright steelpan',
  'Mjuk steelpan': 'Soft steelpan', 'Steelpan med eko': 'Steelpan with echo', 'Steelpan i rum': 'Steelpan in a room',
  'Dubbeltenor': 'Double tenor', 'Cellopan': 'Cello pan', 'Gitarrpan': 'Guitar pan', 'Djup klangskål': 'Deep singing bowl',
  'Liten klangskål': 'Small singing bowl', 'Kristallskål': 'Crystal bowl', 'Vattengong': 'Water gong', 'Fengong': 'Feng gong',
  'Skålar i rum': 'Bowls in a room', 'Svävande skål': 'Floating bowl', 'Isdroppar': 'Ice drops', 'Rymdklocka': 'Space bell',
  'Drömmarimba': 'Dream marimba', 'Ekande skål': 'Echoing bowl', 'Stjärnstavar': 'Star bars',
  'Undervattensklocka': 'Underwater bell', 'Avlägsna klockor': 'Faraway bells', 'Regndroppar': 'Raindrops',
  'Metallregn': 'Metal rain', 'Tidlös klang': 'Timeless tone',
  'Klassiskt FM-piano': 'Classic FM piano', 'Mjukt FM-piano': 'Soft FM piano', 'Ljust FM-piano': 'Bright FM piano',
  'Tine-klang': 'Tine tone', 'Ballad-EP': 'Ballad EP', 'Glas-EP': 'Glass EP', 'Mörkt EP': 'Dark EP', 'Tremolo-EP': 'Tremolo EP',
  'Chorus-EP': 'Chorus EP', 'FM-klocka': 'FM bell', 'Tempelklocka': 'Temple bell', 'Bjällra': 'Sleigh bell',
  'Kyrkklang': 'Church chime', 'Rörklang': 'Tube chime', 'Vindspel': 'Wind chimes', 'Glasklocka': 'Glass bell',
  'Mörk klocka': 'Dark bell', 'Juleklocka': 'Yule bell', 'FM-marimba': 'FM marimba', 'Mjuk marimba': 'Soft marimba',
  'Basmarimba': 'Bass marimba', 'Vibrafon FM': 'Vibraphone FM', 'Xylofon FM': 'Xylophone FM', 'Kristall FM': 'Crystal FM',
  'Glasharmonika': 'Glass harmonica', 'Isskärva': 'Ice shard', 'Prisma': 'Prism', 'Operatorbas': 'Operator bass',
  'Slapbas FM': 'Slap bass FM', 'Träbas': 'Wooden bass', 'Subbas FM': 'Sub bass FM', 'Solid bas': 'Solid bass',
  'Gummibas': 'Rubber bass', 'Knurrbas': 'Growl bass', 'Funkbas': 'Funk bass', 'Popbas FM': 'Pop bass FM',
  'Mörk bas': 'Dark bass', 'FM-brass': 'FM brass', 'Mjukt horn': 'Soft horn', 'Brass-stöt': 'Brass stab',
  'Syntbrass': 'Synth brass', 'Flöjt FM': 'Flute FM', 'Altflöjt': 'Alto flute', 'Klarinett FM': 'Clarinet FM',
  'Basklarinett': 'Bass clarinet', 'FM-matta': 'FM pad', 'Glasmatta FM': 'Glass pad FM', 'Varm matta FM': 'Warm pad FM',
  'Svepmatta': 'Sweep pad', 'Kristallmatta': 'Crystal pad', 'Kör FM': 'Choir FM', 'Operatorlead': 'Operator lead',
  'Sågtand FM': 'Sawtooth FM', 'Fyrkant FM': 'Square FM', 'Flöjtlead': 'Flute lead', 'Vass lead': 'Sharp lead',
  'Mjuk lead FM': 'Soft lead FM', 'Pop-EP': 'Pop EP', 'Syntklav': 'Synth clav', 'Popklocka': 'Pop bell',
  'Popmarimba': 'Pop marimba', 'Jazz-FM': 'Jazz FM', 'Full orgel': 'Full organ', 'Flöjtorgel': 'Flute organ',
  'Kyrkorgel FM': 'Church organ FM', 'Rockorgel FM': 'Rock organ FM', 'Mjuk orgel': 'Soft organ', 'Kvintorgel': 'Fifths organ',
  'Gospel-FM': 'Gospel FM', 'Kammarorgel FM': 'Chamber organ FM', 'Harpa FM': 'Harp FM', 'Gitarr FM': 'Guitar FM',
  'Klavinett FM': 'Clavinet FM', 'Cembalo FM': 'Harpsichord FM', 'Plektrum': 'Plectrum', 'Polarnatt': 'Polar night',
  'Djuprymd': 'Deep space', 'Stjärnfält': 'Star field', 'Nebulosa': 'Nebula', 'Uppsvep': 'Upsweep', 'Nedsvep': 'Downsweep',
  'Bastrumma FM': 'Kick drum FM', 'Tomtrumma FM': 'Tom drum FM', 'Virvel FM': 'Snare FM',
  'Morfmatta': 'Morph pad', 'Varm vågmatta': 'Warm wave pad', 'Andande matta': 'Breathing pad', 'Bred vågmatta': 'Wide wave pad',
  'Glasvåg': 'Glass wave', 'Dimmatta': 'Mist pad', 'Vokalmatta': 'Vowel pad', 'Dragstångsmatta': 'Drawbar pad',
  'Pulsmatta': 'Pulse pad', 'Mjuk digitalmatta': 'Soft digital pad', 'Synklead': 'Sync lead', 'Vecklead': 'Fold lead',
  'Morflead': 'Morph lead', 'Pulslead': 'Pulse lead', 'Vokallead': 'Vowel lead', 'Digitallead': 'Digital lead',
  'Skrikande lead': 'Screaming lead', 'Mjuk våglead': 'Soft wave lead', 'Glaslead': 'Glass lead', 'Bred våglead': 'Wide wave lead',
  'Synkbas': 'Sync bass', 'Veckbas': 'Fold bass', 'Pulsbas': 'Pulse bass', 'Talande bas': 'Talking bass',
  'Digitalbas': 'Digital bass', 'Morfbas': 'Morph bass', 'Sub-våg': 'Sub wave', 'Reesebas': 'Reese bass',
  'Morrande bas': 'Growling bass', 'Vågpiano': 'Wave piano', 'Digital-EP': 'Digital EP', 'Plockvåg': 'Pluck wave',
  'Vokalplock': 'Vowel pluck', 'Glasplock': 'Glass pluck', 'Synkplock': 'Sync pluck', 'Veckplock': 'Fold pluck',
  'Orgelplock': 'Organ pluck', 'Pulsplock': 'Pulse pluck', 'Harpvåg': 'Harp wave', 'Vokalsvep': 'Vowel sweep',
  'Kör i våg': 'Choir wave', 'Viskande våg': 'Whispering wave', 'Robotröst': 'Robot voice', 'Mumlande röst': 'Mumbling voice',
  'Sjungande våg': 'Singing wave', 'Djup röst': 'Deep voice', 'Ljus röst': 'Bright voice', 'Talande våg': 'Talking wave',
  'Andlig vokal': 'Spiritual vowel', 'Svepande våg': 'Sweeping wave', 'Pendelvåg': 'Pendulum wave',
  'Vandrande våg': 'Wandering wave', 'Pulserande synk': 'Pulsing sync', 'Tidvatten': 'Tide', 'Långsam morf': 'Slow morph',
  'Snabb morf': 'Fast morph', 'Rytmisk våg': 'Rhythmic wave', 'Böljande orgel': 'Undulating organ', 'Synksvep': 'Sync sweep',
  'Hård synk': 'Hard sync', 'Vecksvep': 'Fold sweep', 'Distad veck': 'Distorted fold', 'Raspande digital': 'Rasping digital',
  'Industriell': 'Industrial', 'Laservåg': 'Laser wave', 'Sågsynk': 'Saw sync', 'Metallsynk': 'Metal sync',
  'Brutal veck': 'Brutal fold', 'Vågklocka': 'Wave bell', 'Kristallvåg': 'Crystal wave', 'Glittrande glas': 'Glittering glass',
  'Digitalklocka': 'Digital bell', 'Klingande våg': 'Ringing wave', 'Spröd glasvåg': 'Brittle glass wave', 'Isvåg': 'Ice wave',
  'Klockvåg': 'Bell wave', 'Stjärnvåg': 'Star wave', 'Ljusglas': 'Light glass', 'Dragstångsorgel': 'Drawbar organ',
  'Jazzvågorgel': 'Jazz wave organ', 'Kyrkvåg': 'Church wave', 'Svällande orgel': 'Swelling organ',
  'Roterande orgel': 'Rotary organ', 'Pipvåg': 'Pipe wave', 'Kammarvåg': 'Chamber wave', 'Gospelvåg': 'Gospel wave',
  'Rockvågorgel': 'Rock wave organ', 'Pulsorgel': 'Pulse organ', 'Vågvind': 'Wave wind', 'Spökvåg': 'Ghost wave',
  'Ekande digital': 'Echoing digital', 'Drönare': 'Drone', 'Mörker': 'Darkness', 'Polarljus': 'Polar light',
  'Havsdjup': 'Ocean depths', 'Kortvåg': 'Shortwave', 'Tidsresa': 'Time travel', 'Galax': 'Galaxy',
  'Altsolo': 'Alto solo', 'Tenorsolo': 'Tenor solo', 'Bassolo': 'Bass solo', 'Sopransolo': 'Soprano solo',
  'Barnröst': 'Child’s voice', 'Blandad kör': 'Mixed choir', 'Manskör': 'Male choir', 'Damkör': 'Female choir',
  'Barnkör': 'Children’s choir', 'Gregoriansk kör': 'Gregorian choir', 'Vokalglid': 'Vowel glide',
  'Pratande synt': 'Talking synth', 'Wah-röst': 'Wah voice', 'Nynnande': 'Humming', 'Viskning': 'Whisper',
  'Rymdkör': 'Space choir', 'Röstmatta': 'Voice pad', 'Röstplock': 'Voice pluck', 'Ekoröst': 'Echo voice',
  'Lekfull röst': 'Playful voice', 'Tvärflöjt': 'Concert flute', 'Blockflöjt': 'Recorder', 'Bambuflöjt': 'Bamboo flute',
  'Luftig flöjt': 'Airy flute', 'Skarp flöjt': 'Sharp flute', 'Flaskblås': 'Bottle blow', 'Flöjt i sal': 'Flute in a hall',
  'Konsertklarinett': 'Concert clarinet', 'Mörk klarinett': 'Dark clarinet', 'Ljus klarinett': 'Bright clarinet',
  'Mjuk klarinett': 'Soft clarinet', 'Jazzklarinett': 'Jazz clarinet', 'Skalmeja': 'Shawm',
  'Klarinett i kyrka': 'Clarinet in a church', 'Drömklarinett': 'Dream clarinet', 'Kraftig klarinett': 'Powerful clarinet',
  'Körmoln': 'Choir cloud', 'Frusen kör': 'Frozen choir', 'Vandrande kör': 'Wandering choir', 'Viskande kör': 'Whispering choir',
  'Stråkmoln': 'String cloud', 'Stråkar som andas': 'Breathing strings', 'Stammande stråkar': 'Stuttering strings',
  'Korniga stråkar': 'Grainy strings', 'Glasmoln': 'Glass cloud', 'Kristallstoft': 'Crystal dust', 'Lätt regn': 'Light rain',
  'Bubblor': 'Bubbles', 'Fågelsång': 'Birdsong', 'Skogsfåglar': 'Forest birds', 'Glitterstoft': 'Glitter dust',
});

// Längre stycken med länkar och fetstil: hela innehållet byts (data-i18n i index.html)
const EN_HTML = {
  'pos-hint': `Move the pointer over the pad while it is sounding.
    <strong>Grid and Honeycomb:</strong> from the bottom edge upwards.
    <strong>Circle, Ring and Arc:</strong> from the inner edge (towards the middle) outwards.
    <strong>Strings:</strong> along the string on Notes, across it on Chords.
    The <strong>sound engine’s own</strong> options follow the chosen engine, e.g. wavetable position (Wavetable),
    modulation depth (FM), vowel (Voice) or breath pressure (Winds).
    MIDI sends the same: CC74 (filter), CC11 (volume), CC1 (vibrato), CC2 and CC71 (the engine’s own) or pitch bend.`,
  'xy-hint': 'The right edge is C7. Moving up opens the filter. Sine, Triangle and Warm also get FM upwards (more overtones), and Sine vibrato too. Tone and reverb can also be set on the XY page. Reverb under <em>Sound</em> only applies to the pads.',
  'access-hint': 'Choose a profile and fine-tune below. Everything is saved in <em>My presets</em>.',
  'lock-hint': '<strong>🔒 Lock</strong> at the top right shows only the pads. Unlock by <strong>holding</strong> the button for two seconds.',
  'keys': `<li><kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> play pads 1–10 directly – on the Chords page chord pads 1–8. Several can be held at once, so several switches (through a switch interface that sends numbers) can each play a chord. Hold for a long note.</li>
    <li>One switch: <kbd>Space</kbd>, <kbd>Enter</kbd>, <kbd>F1</kbd>, <kbd>F2</kbd> or a click on the play area plays the highlighted pad.</li>
    <li>Two switches: switch 1 (<kbd>Space</kbd> or <kbd>F1</kbd>) moves on, switch 2 (<kbd>Enter</kbd>, <kbd>F2</kbd> or a click) plays.</li>
    <li><kbd>Tab</kbd> moves between pads and buttons, <kbd>Space</kbd>/<kbd>Enter</kbd> plays the pad that has focus.</li>`,
  'osc-hint': 'Needs the bridge on the computer: <code>node tools/osc-bridge.mjs</code> (sends to port 9000). In Safari: open the app at <code>http://localhost:8765</code>.',
  'about-credits': `Created by John Säbom, <a href="mailto:john.s@tfhuk.com">john.s@tfhuk.com</a>, building on the experience
    from <strong>MISK</strong> – a project funded by the Swedish Inheritance Fund (Allmänna Arvsfonden). MISK was run by Eldorado
    Resource Centre (City of Gothenburg), Furuboda Folk High School and Certec.`,
  'about-install': `Hover Pads can be installed as an app. It then starts from the home screen or the app list,
    runs full screen without the browser bar and works <strong>without internet</strong> after the first visit.`,
  'about-install-list': `<li><strong>iPhone and iPad:</strong> open the page in <em>Safari</em>, tap <em>Share</em>
      (the square with an arrow pointing up) and choose <em>Add to Home Screen</em>.</li>
    <li><strong>Android:</strong> open the page in <em>Chrome</em>, tap the menu ⋮ and choose
      <em>Install app</em> (or <em>Add to Home screen</em>).</li>
    <li><strong>Computer with Chrome or Edge:</strong> press <em>Install</em> at the top right of Hover Pads,
      or the install icon in the address bar.</li>
    <li><strong>Mac with Safari:</strong> choose <em>File → Add to Dock</em>.</li>`,
  'about-tfh': `The app has been developed with support from TFH,
    <a href="https://specialneedstoys.com" target="_blank" rel="noopener">specialneedstoys.com</a>.`,
  'about-tfh-text': `Since 1983 TFH has developed sensory products that create opportunities for learning,
    development, security and joy. We supply health and social care, schools, care for older people and private
    customers, with products that make it easier to overcome barriers – on each person’s own terms.`,
  'about-tfh-rooms': `TFH are experts in <strong>Multi Sensory Environments</strong>, with long and extensive experience of
    designing and building sensory rooms – from a simple sensory corner to a complete multi-sensory room in early years
    settings, schools, health and social care. Do get in touch for tips and advice.`,
  'about-privacy': `<strong>No statistics and no tracking.</strong> Hover Pads has no cookies, no visitor statistics, no adverts
    and no scripts or fonts from other companies. There is no account and no sign-in, and the app sends nothing about how it
    is used – neither to TFH nor to anyone else.`,
  'about-privacy-list': `<li><strong>Stored on the device:</strong> settings, presets, your own chords, the chosen language and
    the last open tab are kept in the browser's local storage on the device you are using. The app's files are kept in the
    browser's cache so that it works without internet. None of this leaves the device.</li>
    <li><strong>Hosting:</strong> the app is served from GitHub Pages. As with any website, the server sees the device's IP
    address when the files are fetched, and GitHub keeps it in logs for a while for security reasons, under GitHub's privacy
    statement. TFH has no access to those logs. An installed app only contacts the server to fetch updates.</li>
    <li><strong>Microphone and camera</strong> are not used. Eye gaze is handled by the device's own eye-gaze system, like an
    ordinary mouse pointer – the app only sees where the pointer is and does not store it.</li>
    <li><strong>MIDI:</strong> if you connect a MIDI instrument, the browser asks for permission first. The notes only go to
    your own connected devices.</li>
    <li><strong>Links</strong> to specialneedstoys.com and other websites lead to pages with their own terms and their own statistics.</li>`,
  'about-gdpr': `<strong>Good to know:</strong> The app collects no personal data, so it needs no cookie banner and no consent,
    and TFH holds no data about you to disclose or erase. What you type in yourselves, such as preset names, is however
    stored on the device. If several people share a device, avoid full names and sensitive information in preset names, and
    treat exported preset files like any other document.`,
  'about-erase': `The button erases everything Hover Pads has stored on this device: settings, presets, your own chords and the
    selected tabs. The app then restarts as on the first visit. If you want to keep your presets, export them first under
    Settings → My presets. The app's own files stay, so that it still works without internet.`,
  'about-erase-browser': `You can also clear the site data for the page in the browser's settings, which also removes the app's
    files. On iPhone and iPad: remove the app from the Home Screen.`,
  'about-disclaimer': `<strong>Disclaimer:</strong> Hover Pads is provided free of charge and as is. TFH accepts no responsibility for
    how the app is used, or for errors, bugs or other problems that may arise when using it – for example with sound,
    connected devices or saved settings. Use the app with care and set the volume to suit the person listening.`,
  'about-tip': 'We would also like to recommend <strong>Lyssna till mitt öga</strong> (Listen to my eye), our sister project run by the Swedish adult education association Studieförbundet Vuxenskolan.',
};

// Texter som byggs ihop med siffror och namn. Varje mönster gäller hela texten.
const q = (s) => `"${s}"`;
const EN_PATTERNS = [
  [/^Laddade "(.+)" till (.+)$/, (n, p) => `Loaded ${q(n)} on ${p}`],
  [/^Kunde inte läsa "(.+)" som ljud\.$/, (n) => `Could not read ${q(n)} as audio.`],
  [/^Laddade presetet "(.+)"$/, (n) => `Loaded the preset ${q(n)}`],
  [/^Tog bort presetet "(.+)"$/, (n) => `Deleted the preset ${q(n)}`],
  [/^Sparade presetet "(.+)"$/, (n) => `Saved the preset ${q(n)}`],
  [/^Skriva över "(.+)" med nuvarande inställningar\?$/, (n) => `Overwrite ${q(n)} with the current settings?`],
  [/^Ta bort presetet "(.+)"\?$/, (n) => `Delete the preset ${q(n)}?`],
  [/^Det finns redan ett preset som heter "(.+)"\. Skriva över det\?$/, (n) => `There is already a preset called ${q(n)}. Overwrite it?`],
  [/^Importerade (\d+) presets? från (.+)$/, (n, f) => `Imported ${n} preset${n === '1' ? '' : 's'} from ${f}`],
  [/^Kunde inte läsa presets från (.+)$/, (f) => `Could not read presets from ${f}`],
  [/^Kunde inte starta ljudet: (.+)$/, (m) => `Could not start the sound: ${m}`],
  [/^Ansluten till (.+)$/, (u) => `Connected to ${u}`],
  [/^OSC: ansluten till (.+)$/, (u) => `OSC: connected to ${u}`],
  [/^MIDI: (.+)$/, (d) => `MIDI: ${t(d)}`],
  [/^Steg (\d+) av (\d+)$/, (a, b) => `Step ${a} of ${b}`],
  [/^Ackordmall i (.+)$/, (k) => `Chord template in ${t(k)}`],
  [/^(\d+) ackord$/, (n) => `${n} chord${n === '1' ? '' : 's'}`],
  [/^Ackord (\d+)$/, (n) => `Chord ${n}`],
  [/^Färg för ackord (\d+)$/, (n) => `Colour for chord ${n}`],
  [/^(.+), ackord (\d+)$/, (a, n) => `${t(a)}, chord ${n}`],
  [/^Ruta (\d+)$/, (n) => `Pad ${n}`],
  [/^Ruta (\d+): (.+)$/, (n, r) => `Pad ${n}: ${t(r)}`],
  [/^Oktav ([−+±]?\d+)$/, (n) => `Octave ${n}`],
  [/^(\d+) röster$/, (n) => `${n} voice${n === '1' ? '' : 's'}`],
  [/^Kör, (\d+) st$/, (n) => `Choir, ${n} voices`],
  [/^(\d+) st$/, (n) => n],
  [/^(\d+) korn\/s$/, (n) => `${n} grains/s`],
  [/^([\d.,]+) okt$/, (n) => `${n} oct`],
  [/^([+−-]?\d+) halvt\.$/, (n) => `${n} st`],
  [/^Framåt (.+)$/, (v) => `Forward ${v}`],
  [/^Bakåt (.+)$/, (v) => `Backward ${v}`],
  [/^→ modulerar (.+)$/, (l) => `→ modulates ${l.replace(/ och /g, ' and ')}`],
  [/^(Föregående|Nästa|Minska|Öka) (.+)$/, (a, b) => { const r = t(b); return `${EN[a]} ${/^.[a-z]/.test(r) ? r.charAt(0).toLowerCase() + r.slice(1) : r}`; }],
  [/^Arpeggiator (på|av)$/, (a) => `Arpeggiator ${a === 'på' ? 'on' : 'off'}`],
  [/^Nu: (.+)\. Välj ett nytt eller gå vidare för att behålla det\.$/, (s) => `Now: ${t(s)}. Choose a new one or continue to keep it.`],
  [/^Guiden klar: (.+)$/, (s) => `Guide finished: ${s.split(', ').map(t).join(', ')}`],
  [/^([■▶]) (.+?)((?: +\(.*\))?(?: +· arp)?)$/, (sym, lab, rest) => `${sym} ${t(lab)}${rest}`],
  [/^([A-G][#b]?) (dur|moll|pentatonisk|blues|kromatisk)$/, (r, s) => `${r} ${t(s)}`],
  // Allmänna: "a: b", "a (b)" och "a · b · c"
  [/^([^:"]+): (.+)$/, (a, b) => `${t(a)}: ${t(b)}`],
  [/^(.+) \(([^()]+)\)$/, (a, b) => `${t(a)} (${t(b)})`],
  [/^(.+ · .+)$/, (s) => s.split(' · ').map(t).join(' · ')],
];

const enCache = new Map();
function enLookup(s) {
  if (s in EN) return EN[s];
  // Små bokstäver i början (t.ex. "dur" ur "C dur"): slå upp med stor och svara med liten
  const c = s.charAt(0);
  if (c !== c.toUpperCase()) {
    const cap = c.toUpperCase() + s.slice(1);
    if (cap in EN) { const r = EN[cap]; return r.charAt(0).toLowerCase() + r.slice(1); }
  }
  if (s.endsWith(':') && s.slice(0, -1) in EN) return `${EN[s.slice(0, -1)]}:`;
  for (const [re, fn] of EN_PATTERNS) {
    const m = s.match(re);
    if (m) return fn(...m.slice(1));
  }
  return s;
}

// Översätt en text (svenska -> engelska). På svenska returneras texten som den är.
function t(s) {
  if (!EN_MODE || s == null) return s;
  const key = String(s).replace(/\s+/g, ' ').trim();
  if (!key) return s;
  let r = enCache.get(key);
  if (r === undefined) {
    // Decimalkomma -> punkt och "50 %" -> "50%"
    r = enLookup(key).replace(/(\d),(\d)/g, '$1.$2').replace(/(\d) %/g, '$1%');
    enCache.set(key, r);
  }
  return r === key ? s : r;
}

// ---------- Översättning av sidan ----------
(function i18nStart() {
  document.documentElement.lang = LANG;
  // Språkknapparna (startrutan och Om-rutan)
  document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('.lang-switch [data-lang]').forEach((b) => {
    b.classList.toggle('on', b.dataset.lang === LANG);
    b.setAttribute('aria-pressed', b.dataset.lang === LANG);
    b.addEventListener('click', () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang); });
  }));
  if (!EN_MODE) return;
  document.title = t(document.title);
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', 'manifest-en.webmanifest');

  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'label'];
  const SKIP = 'script, style, code';
  // translate="no" (t.ex. egna presetnamn) hoppas över; närmaste translate-attribut gäller
  const skip = (el) => !el || !!el.closest(SKIP) || el.closest('[translate]')?.getAttribute('translate') === 'no';
  const done = new WeakMap(); // nod -> senaste engelska text (så att den inte översätts igen)

  function trText(node) {
    const v = node.nodeValue;
    if (!v || done.get(node) === v || !/[A-Za-zÅÄÖåäö]|\d,\d|\d %/.test(v)) return;
    if (skip(node.parentElement)) return;
    const r = t(v);
    if (r !== v) {
      const lead = v.match(/^\s*/)[0];
      const trail = v.match(/\s*$/)[0];
      const out = lead + r + (r.endsWith(trail) ? '' : trail);
      done.set(node, out);
      node.nodeValue = out;
    } else done.set(node, v);
  }
  function trAttrs(el) {
    if (skip(el)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const r = t(v);
      if (r !== v) el.setAttribute(a, r);
    }
  }
  function trTree(root) {
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1) return;
    if (root.dataset?.i18n && root.dataset.i18n in EN_HTML && !root.dataset.i18nDone) {
      root.dataset.i18nDone = '1';
      root.innerHTML = EN_HTML[root.dataset.i18n];
    }
    trAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) trText(n);
      else {
        if (n.dataset?.i18n && n.dataset.i18n in EN_HTML && !n.dataset.i18nDone) {
          n.dataset.i18nDone = '1';
          n.innerHTML = EN_HTML[n.dataset.i18n];
        }
        trAttrs(n);
      }
    }
  }
  // TFH-länkarna leder till TFH i Storbritannien
  function tfhLinks(root) {
    root.querySelectorAll?.('a[href*="tfhsensory.se"]').forEach((a) => { a.href = TFH_URL; });
  }

  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') trText(m.target);
      else if (m.type === 'attributes') trAttrs(m.target);
      else m.addedNodes.forEach((n) => { trTree(n); if (n.nodeType === 1) tfhLinks(n); });
    }
  }).observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS,
  });
  document.addEventListener('DOMContentLoaded', () => { trTree(document.body); tfhLinks(document); });
})();
