# Hover Pads

En webbsida med rutor som spelar ljud och/eller skickar MIDI när man för musen över dem.

**Prova:** https://johbom.github.io/misk/

Huvudmenyn har symboler: ♪ **Toner**, staplade noter för **Ackord**, en kurva för **XY**, reglage för **Inställningar** och ⓘ **Om**, som berättar vem som skapat appen och om MISK och TFH Sensory. På smal skärm står symbolen ovanför texten.

## Flikar

När appen öppnas väljer man var man vill börja – **Toner**, **Ackord**, **XY** eller **Inställningar** – med stora knappar. Klicket startar också ljudet (webbläsare kräver ett klick först). Det man använde senast är markerat och har fokus, så Enter eller en kontakt startar direkt där.

I spelläge (**Toner** och **Ackord**) syns bara rutorna, ljudval och volym. Allt annat finns under fliken **Inställningar**.

- **Toner** – 1 till 32 rutor (12 från början), en ton per ruta; antalet väljs under *Inställningar → Sidan Toner*. Välj grundton, oktav och skala (dur, moll, pentatonisk, blues, kromatisk). Rutorna med skalans grundton (i alla oktaver) är ljusare, och markeringen flyttar med när grundton, skala eller antal ändras. Dra en ljudfil (wav/mp3) till en ruta för att byta dess ljud; högerklicka för att ta bort den. Ljudfilen följer spelsättet, precis som tonerna.
- **Ackord** – 2 till 8 rutor. **Högerklicka på en ruta/boll** för att byta dess ackord direkt (grundton + typ: dur, moll, 7, maj7, m7, 6, m6, 9, add9, sus2, sus4, dim, dim7, m7b5, aug); inget spelas medan menyn är öppen, och klick utanför eller Esc stänger den. Samma val finns också under Inställningar. Valfri bas en oktav ner. Rutorna visar bara ackordnamnet.
- **Färger** – varje ackord har en egen färg som syns på rutan/bollen/sektorn/strängen och lyser upp när den spelas. Välj färg per ackord under *Inställningar → Sidan Ackord*. Knappen *Standardfärger* ger 1 röd, 2 gul, 3 grön, 4 blå, 5 orange, 6 lila, 7 rosa, 8 turkos (det är också startläget); *Ingen färg* tar bort alla färger.
- **Harpa i strängläge** – med formationen *Strängar* spelar en sträng hela ackordet när musen förs över den, precis som förut. **Håll inne musknappen (eller fingret) och dra:** första anslaget på en sträng spelar hela ackordet, och stannar du kvar och rör dig upp eller ner längs strängen går den över i harpläge – ackordets toner knäpps en och en över två oktaver, lägst nertill och högst upptill (t.ex. C E G C E G C). Prickarna på strängen visar var tonerna ligger.
- **XY** – en XY-platta där **varje muspekare och varje finger är en egen oscillator**. **X = tonhöjd** som steglöst frekvensglissando (inga fasta toner), **Y = highcut** (lågpassfilter) som öppnar uppåt: längst ned dovt, längst upp helt öppet. Musen låter så länge den är över ytan, fingrar så länge de rör skärmen – flera fingrar ger flera röster samtidigt. Varje pekare ritar ett glödande spår i egen färg som bleknar bort. Svaga linjer visar skalans toner (grundtonen tydligast) bara som orientering. Högerkanten är alltid **C7**; omfånget (1–5 oktaver, 5 från början = **C2–C7**) väljs under *Inställningar → Spel*. Tonen tystnar direkt när fingret släpper eller musen lämnar ytan – reverb och delay klingar ut som vanligt. XY har **egen klang** – välj *Sinus, Triangel, Varm, Sågtand, Fyrkant* eller *Bred* (fem ostämda sågtänder i stereo) med knapparna **Klang** i spelraden (ljudlistan för rutorna döljs på XY-sidan) – och egen **Rumsklang** under *Inställningar → Spel*. Rutornas ljud och effekter påverkar alltså inte XY. Vickar man pekaren eller fingret blir det vibrato (även i arpeggio).
- **Avancerat (voicing)** – kryssa i under *Inställningar → Sidan Ackord* för att välja voicing per ackord: *grundläge*, *1:a/2:a/3:e omvändning* (3:e kräver fyrklang), *öppen* eller *drop 2*, plus *oktavläge* −1/±0/+1 och **bas**: en egen baston under ackordet (snedstrecksackord, t.ex. *C/E* eller *C/G*). Ackordnamnet visar basen, och en vald baston spelas även om *Bas* är avkryssat. Valen syns både i listan och i högerklicksmenyn (som då också visar tonerna). Slår du av avancerat läge spelas ackorden i grundläge igen, men dina val sparas.

## Inställningar (fliken)

Inställningarna är uppdelade i underflikar:

- **Spel** – **spelsätt**, valt med knappar vars symbol visar ljudets volym över tid. Gäller både toner och uppladdade ljudfiler:
  - *Håll (gated)* – låter så länge pekaren/fingret är kvar på rutan; ljudfilen tonas ut när man lämnar den.
  - *One-shot* – ett anslag som klingar ut av sig självt, oavsett pekaren. En ljudfil spelas hela; en ton klingar enligt ljudets volymkurva (attack + avklingning).
  - *Bestämd längd* – låter exakt den valda *Tonlängden* (0,1–3 s), även ljudfiler.
  - *Ligg kvar* – låter tills nästa ruta spelas (samma ruta igen tystar).

  **Arpeggiator** – slå på med **Arp**-knappen i spelraden (eller under *Spel*). Då spelas tonerna i det du spelar en i taget, i takt, i stället för samtidigt: en ackordruta arpeggieras, flera tonrutor som hålls (fingrar, tangenter, kontakter) arpeggieras tillsammans, och en ensam ton arpeggieras över oktaverna. Fungerar med **alla spelsätt**: *Håll* så länge du är kvar, *One-shot* och *Längd* en viss tid, *Ligg kvar* tills nästa ruta – byter du ackord fortsätter arpeggiot i takt. Inställningar: *Mönster* (Upp, Ner, Upp & ner, Slump, Spelordning), *Tempo* (40–240 BPM), *Notvärde* (1/4, 1/8, 1/8 triol, 1/16), *Oktaver* (1–3) och *Tonlängd* (staccato–legato). Noterna planeras i ljudklockan så att takten blir stadig; MIDI (med tidsstämplar), OSC, ljudfiler och vibrato följer med. Varje ton blinkar till på sin ruta. **På XY-plattan** är varje finger/pekare en ton i arpeggiot, med sin steglösa tonhöjd och sitt filter: flera fingrar = arpeggio mellan dem (Upp/Ner efter tonhöjd, Spelordning efter vem som kom först), ett finger = arpeggio över oktaverna (1 oktav = rytmisk upprepning). Flyttar du fingret följer nästa steg med, och varje steg syns som en ring som pulserar ut från fingret.

  **Vibrato** – vickar man pekaren eller fingret fram och tillbaka (eller upp och ned) på en ruta som låter blir det ett försiktigt pitchvibrato, även på ljudfiler. Takten följer hur fort man vickar (3–8 Hz), djupet växer med hur ihärdigt man vickar upp till valt *Djup* (0–60 cent, 20 från början, 0 = av), och vibratot tonar ut när man slutar. Ett vanligt svep eller små darrningar ger inget vibrato. Ögon- och kontaktprofilerna slår av det, så att blickens mikrorörelser inte ger vibrato.

  Och **formation**: *Rutnät*, *Cirkel* (bollar i ring), *Ring* (en cirkel delad i sektorer med ett tomt hål i mitten där muspekaren kan vila), *Bikupa* eller *Strängar*. Under formationen syns bara de reglage som gäller den: *Mellanrum* mellan rutorna, *Stränglängd* för strängarna, och för ringen *Mellanrum mellan sektorer* (hur tight de ligger) och *Hålets storlek*.
- **Tillgänglighet** – ögonstyrning, kontakt, tangentbord, storlek och kontrast, se nedan.
- **Toner** – antal toner (1–32, 12 från början), grundton, oktav och skala.
- **Ackord** – antal ackord, oktav, bas, avancerat läge (voicing), färger och ackordlistan.
- **Ljud** – presetbiblioteket och alla reglage för ljudmotorn.
- **Ut & MIDI** – ljud och/eller MIDI, MIDI-enhet, kanal och velocity. *Panik* skickar All Notes Off.
- **Mina presets** – se nedan.

Korta val visas som knappgrupper där alla alternativ syns på en gång (grundton, skala, antal ackord, synlig pekare, storlek, stegning), av/på-val som brytare, och sifferfält har stora − och + knappar. Piltangenterna flyttar mellan valen i en knappgrupp.

Allt sparas i webbläsaren.

## Tillgänglighet och ögonstyrning

Under *Inställningar → Tillgänglighet*. Ögonstyrning styr muspekaren, så allt man tittar på "hovras". Inställningarna gör att man kan titta utan att allt låter, och använda hela appen utan att klicka.

**Snabbval** – färdiga profiler att börja från:

| Profil | För vem |
|---|---|
| *Standard* | Mus och pekskärm, spelar direkt |
| *Ögon – utforska* | Första stegen, orsak och verkan: låter direkt där blicken landar, tål darr, stor pekare och stora mellanrum |
| *Ögon – spela* | Van användare: kort aktiveringstid så man hinner sikta; ögonstyrningen sköter klicken |
| *Ögon – bara titta* | Utan klick: knappar trycks genom att titta, tonen ligger kvar tills nästa ruta |
| *Kontakt* | En kontakt med automatisk stegning |

**Aktivering** (gäller pekare som *svävar* – blick eller mus utan nedtryckt knapp. Trycker eller drar man med finger eller musknapp spelar det direkt, så svep över strängarna och harpan fungerar som vanligt i alla profiler)
- *Aktiveringstid* – pekaren ska vila på rutan så här länge innan den spelar. Rutan och pekarringen fylls under tiden.
- *Darrtolerans* – pekaren får glida ut över kanten en kort stund utan att tonen släpps eller spelas om.
- *Spärrtid* – samma ruta kan inte spelas igen förrän tiden gått (mot stamning vid kanten).
- *Synlig pekare* – en ring som följer blicken/musen och fylls medan man vilar på något.

**Knappar och reglage**
- *Klicka genom att titta* – knappar, flikar, kryssrutor och profiler trycks in när pekaren vilat på dem. En gul ram och stapel visar hur länge det är kvar. Tittar man kvar på − / + fortsätter den att stega. Klick startar bara när pekaren rör sig, inte om sidan flyttar sig under en stilla pekare. Låt stå på *Av* om ögonstyrningen redan klickar åt dig.
- *Stora − och + knappar* – vid alla reglage och listor, så att allt kan ändras utan att dra eller öppna menyer. Långa reglage går från ena änden till den andra på högst ca 20 tryck.
- *Storlek* – Normal, Stor eller Extra stor på flikar, knappar, text och reglage (spelytan påverkas inte).
- Frågor som "Ta bort?" visas i en egen ruta med stora Ja/Nej-knappar (Nej är förval) som går att använda med blicken.

**Visning** – *Hög kontrast* (svart, vita kanter, gul markering) och *Minska rörelse*. Båda följer datorns/telefonens inställning tills man själv väljer.

**Kontakt och tangentbord**
- Tangenterna <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> spelar rutorna 1–10 direkt (på sidan Ackord ackordruta 1–8); håll inne för lång ton. Flera tangenter kan hållas samtidigt, så **flera kontakter** – via ett kontaktinterface som skickar siffror – kan spela var sitt ackord. Både sifferraden och det numeriska tangentbordet fungerar, och siffrorna spelar även om preset-listan eller volymen nyss använts (listan byter inte värde).
- *Visa tangentsiffror på rutorna* – en liten siffra på varje ruta visar vilken tangent/kontakt som spelar den.
- *Stegning med en kontakt*: rutorna markeras en i taget i vald takt (medan stegningen är på spelar pekare och finger inte rutorna, och harpan är avstängd). <kbd>Mellanslag</kbd>, <kbd>Enter</kbd> eller ett klick/tryck på spelytan spelar den markerade, och stegningen står still medan kontakten hålls in.
- *Två kontakter*: <kbd>Mellanslag</kbd> stegar vidare, <kbd>Enter</kbd> (eller klick) spelar.
- <kbd>Tab</kbd> flyttar mellan rutor och knappar med tydlig fokusram; <kbd>Mellanslag</kbd>/<kbd>Enter</kbd> spelar rutan som har fokus.

**Lås spelytan** – knappen *🔒 Lås* (på Toner och Ackord) gömmer flikar, ljudval och volym så att bara rutorna syns. Lås upp genom att **hålla inne** knappen i hörnet i två sekunder. Ett vanligt klick, ett klick med ögonstyrning eller en blick räcker inte, så spelaren kan inte råka hamna i inställningarna. Låset finns kvar om sidan laddas om.

Tillgänglighetsinställningarna följer med i *Mina presets*, så varje användare kan ha sitt eget.

Ljud i webbläsare kräver ett riktigt klick eller tangenttryck en gång innan något får låta. Den som bara använder blicken behöver därför hjälp att välja var appen ska börja en gång.

## Mina presets

Under *Inställningar → Mina presets* sparar du **hela uppsättningen** under ett eget namn: ljud, ackord, färger, voicing, toner, formation, mellanrum, stränglängd, ringens inställningar och utgångar. Ett klick på *Ladda* ställer tillbaka allt. *Skriv över* uppdaterar ett sparat preset med det du har nu.

Kryssa i **Visa på spelsidan** så syns dina presets också på Toner och Ackord, ovanför ljudvalet: **◀ ▶** byter till föregående/nästa (runt i en ring), och listan i mitten hoppar direkt till ett visst preset. Knapparna går att använda med blicken (*Klicka genom att titta*) och växer med *Stora − och + knappar*. Valet sparas för sig självt och påverkas inte av vilket preset du laddar. Raden syns inte när spelytan är låst.

Med *Exportera alla till fil* får du en JSON-fil med alla dina presets (bra som backup eller för att flytta dem till en annan dator/telefon); *Importera från fil* läser in dem igen.

## Ljudmotor

Välj ett färdigt **preset** – Elpiano, Varm pad, Supersaw-lead, Pluck, Bas, Klocka, Orgel, Rymd, Chip eller Enkel – eller gå till **Inställningar → Ljudmotor** och skruva själv:

- **Motor:** *Oscillatorer* (klassisk subtraktiv syntes och FM, allt nedan) eller **fysisk modell**, se nedan.
- **Oscillator 1:** åtta vågformer (sinus, triangel, fyrkant, sågtand, puls, varm, orgel, röst), unison upp till 7 röster med detune och stereobredd.
- **Oscillator 2:** blandas in eller frekvensmodulerar osc 1 (FM), transponering, fininställning, brus.
- **Filter:** lågpass/högpass/bandpass med resonans och egen envelope.
- **Volymkurva:** attack, decay, sustain, release.
- **LFO:** vibrato, filter-wah eller tremolo.
- **Effekter:** drive, chorus, delay och reverb.

**Fysisk modell:** i stället för att forma vågformer räknar motorn ut hur en riktig sträng eller kropp svänger, så klangen beter sig naturligt över hela registret.
- *Sträng* – en räknad sträng (Karplus–Strong) som kan **knäppas**, **slås** (som en pianohammare) eller **strykas med stråke** (klingar så länge tonen hålls).
- *Resonans* – en kropp som slås an, med verkliga deltonsförhållanden: **marimba, vibrafon, glas, klocka, trumma** eller **metallstav**.
- Reglage: *Klingtid* (hur länge den ringer), *Ljushet* (mörk/mjuk eller ljus/hård), *Anslagspunkt* (vid kanten = tunnare, mitten = rundare).
- Filter, volymkurva, LFO, vibrato och alla effekter fungerar som vanligt. Modellerna räknas i ljudtråden (AudioWorklet) och stängs av när de tystnat.

**Presetbibliotek:** överst under *Inställningar → Ljudmotor* finns 110 färdiga ljud i elva kategorier (klaviatur, pad, lead, bas, pluck, klockor, orgel, stråk & blås, atmosfär, retro & chip, fysisk modell – t.ex. *Nylonsträng*, *Stråkcello*, *Marimbaträ*, *Vibrafonstav*, *Glasklang*, *Handtrumma*). Ett klick laddar in ljudet i *Eget* och provspelar det; presetmenyn visar då t.ex. *Eget: Harpa*. De tio i presetmenyn finns kvar som förut.

Ändrar du ett reglage blir ljudet *Eget (ändrat)*. *Återställ preset* går tillbaka, *Slumpa ljud* hittar på något nytt.
Uppladdade ljudfiler går också genom effekterna.

## App (PWA), mobil och iPad

Hover Pads är en installerbar webbapp som fungerar **offline** efter första besöket.

- **iPhone/iPad:** öppna sidan i Safari → *Dela* → *Lägg till på hemskärmen*. Appen öppnas i helskärm utan webbläsarlist.
- **Android, Chrome och Edge på dator:** tryck på *Installera* uppe till höger (eller i webbläsarens meny).
- När du är uppkopplad hämtas alltid senaste versionen; offline används den sparade.
- Fastnar något kan felet visas direkt på skärmen (på startrutan eller längst ner) – skicka gärna texten om det händer.

På pekskärmar ryms hela sidan på skärmen och scrollar inte – rutorna krymper för att få plats i alla formationer, stående som liggande. Bara fliken *Inställningar* scrollar inuti sig själv. På en dator kan samma läge slås på med `?fast` i adressen.

## MIDI

Web MIDI fungerar i Chrome, Edge och Firefox (inte Safari) och kräver https eller localhost.
På Mac kan du skicka till t.ex. Logic/Ableton via en virtuell port: *Ljud-MIDI-konfiguration → MIDI-studio → IAC-drivrutin → "Enheten är online"*.

## OSC

Under *Inställningar → Ut, MIDI & OSC* kan appen skicka **OSC** (Open Sound Control) till t.ex. Max, Pure Data, TouchDesigner, QLab, Ableton (via Max for Live) eller SuperCollider.

Webbläsare får inte skicka UDP, så det behövs en liten brygga på datorn. Den finns i `tools/osc-bridge.mjs` och kräver bara Node 18 eller senare:

```
node tools/osc-bridge.mjs
```

Bryggan tar emot från appen på `ws://localhost:8765` och skickar vidare som vanlig OSC/UDP till `127.0.0.1:9000`. Kryssa i **OSC** under *Utgång*; statusen visar *Ansluten*, och appen återansluter av sig själv om bryggan startas om. *Skicka test* skickar `/hoverpads/test "hej"`.

Val: `--port 7000` (UDP-port), `--host 192.168.1.20` (annan dator), `--ws 8765` (WebSocket-port), `--verbose` (skriv ut varje meddelande), `--lan` (låt andra enheter i nätverket, t.ex. en iPad, ansluta – annars bara den här datorn).

**Safari:** Safari stoppar anslutningen från den publicerade https-sidan. Bryggan serverar därför också själva appen – öppna `http://localhost:8765` så fungerar OSC även i Safari. Chrome, Edge och Firefox fungerar från båda.

Meddelanden (prefixet `/hoverpads` kan ändras):

| Adress | Argument |
|---|---|
| `/hoverpads/note` | ton (MIDI-nummer, int), styrka (int, 0 = släpp) |
| `/hoverpads/pad` | sida (`notes`/`chords`), ruta (1–), 1 = på / 0 = av |
| `/hoverpads/chord` | ackordnamn (t.ex. `C/E`), ruta – när en ackordruta slås an |
| `/hoverpads/vibrato` | sida, ruta, djup i cent (float) |
| `/hoverpads/xy` | pekare (id), x (0–1, float), y (0–1, float, 0 = nederkant), 1 = på / 0 = av |
| `/hoverpads/test` | `"hej"` |

Styrkan är samma som *Velocity* under MIDI. Harpans toner skickas som `/note`.

## Köra lokalt

```bash
python3 -m http.server 8080
```

Öppna sedan http://localhost:8080. Lokalt används ingen offline-cache (så att ändringar syns direkt); lägg till `?pwa` i adressen för att prova service workern.

## Filer

- `index.html` – sidan
- `manifest.webmanifest`, `sw.js` – PWA: appinformation och offline-cache. Kör `python3 tools/bump_version.py` före varje ny version (höjer cacheversionen och `?v=` på filerna så att telefoner hämtar det nya)
- `app.js` – ersättning för gamla cachade sidor: laddar om dem till den nya versionen
- `css/style.css` – utseende
- `icons/` – appikoner (skapas med `python3 tools/make_icons.py icons`)
- `js/synth.js` – ljudmotorn (Web Audio), reglagen och de tio snabbpreseten
- `js/sound-library.js` – presetbiblioteket med 110 ljud
- `js/pm-worklet.js` – fysisk modell i ljudtråden: sträng (Karplus–Strong) och resonanskropp
- `js/layout.js` – formationerna (cirkel, ring, bikupa, strängar)
- `js/core.js` – grunddata: tonnamn, skalor, ackordtyper, färger, referenser till reglagen
- `js/audio.js` – ljud- och MIDI-utgång
- `js/osc.js` – OSC-utgång: kodar OSC-paket och skickar dem till bryggan
- `tools/osc-bridge.mjs` – OSC-bryggan (WebSocket → UDP), serverar också appen lokalt
- `js/arp.js` – arpeggiatorn: tonpool, mönster och planering i ljudklockan
- `js/xy.js` – XY-plattan: en oscillator per pekare, glödande spår
- `js/vibrato.js` – känner av vickning fram och tillbaka och gör om den till vibrato
- `js/pads.js` – spela/släppa rutor, mus, ögonstyrning och pekskärm (aktiveringstid, darrtolerans, spärrtid)
- `js/notes.js` – sidan Toner
- `js/chords.js` – sidan Ackord: ackord, voicing, färger, harpa och högerklicksmeny
- `js/sound.js` – ljudreglagen och presetbiblioteket i Inställningar
- `js/view.js` – flikar, underflikar och formationer
- `js/controls.js` – knappgrupper i stället för korta listor (grundton, skala, antal ackord, pekare, storlek, stegning)
- `js/access.js` – tillgänglighet: profiler, synlig pekare, klicka genom att titta, − / + knappar, lås, stegning och tangentbord
- `js/settings.js` – sparade inställningar
- `js/user-presets.js` – Mina presets (spara/ladda/exportera)
- `js/pwa.js` – service worker och Installera-knapp
- `js/main.js` – uppstart
