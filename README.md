# Hover Pads

En webbsida med rutor som spelar ljud och/eller skickar MIDI när man för musen över dem.

**Prova:** https://johbom.github.io/misk/

Knappen **Om** uppe till höger berättar vem som skapat appen och om MISK och TFH Sensory.

## Flikar

I spelläge (**Toner** och **Ackord**) syns bara rutorna, preset och volym. Allt annat finns under fliken **Inställningar**.

- **Toner** – 2 till 32 rutor (16 från början), en ton per ruta; antalet väljs under *Inställningar → Sidan Toner*. Välj grundton, oktav och skala (dur, moll, pentatonisk, blues, kromatisk). Dra en ljudfil (wav/mp3) till en ruta för att byta dess ljud; högerklicka för att ta bort den.
- **Ackord** – 2 till 8 rutor. **Högerklicka på en ruta/boll** för att byta dess ackord direkt (grundton + typ: dur, moll, 7, maj7, m7, 6, m6, 9, add9, sus2, sus4, dim, dim7, m7b5, aug); inget spelas medan menyn är öppen, och klick utanför eller Esc stänger den. Samma val finns också under Inställningar. Valfri bas en oktav ner. Rutorna visar bara ackordnamnet.
- **Färger** – varje ackord har en egen färg som syns på rutan/bollen/sektorn/strängen och lyser upp när den spelas. Välj färg per ackord under *Inställningar → Sidan Ackord*. Knappen *Standardfärger* ger 1 röd, 2 gul, 3 grön, 4 blå, 5 orange, 6 lila, 7 rosa, 8 turkos (det är också startläget); *Ingen färg* tar bort alla färger.
- **Harpa i strängläge** – med formationen *Strängar* spelar en sträng hela ackordet när musen förs över den, precis som förut. **Håll inne musknappen (eller fingret) och dra:** första anslaget på en sträng spelar hela ackordet, och stannar du kvar och rör dig upp eller ner längs strängen går den över i harpläge – ackordets toner knäpps en och en över två oktaver, lägst nertill och högst upptill (t.ex. C E G C E G C). Prickarna på strängen visar var tonerna ligger.
- **Avancerat (voicing)** – kryssa i under *Inställningar → Sidan Ackord* för att välja voicing per ackord: *grundläge*, *1:a/2:a/3:e omvändning* (3:e kräver fyrklang), *öppen* eller *drop 2*, plus *oktavläge* −1/±0/+1. Valen syns både i listan och i högerklicksmenyn (som då också visar tonerna). Slår du av avancerat läge spelas ackorden i grundläge igen, men dina val sparas.

## Inställningar (fliken)

Inställningarna är uppdelade i underflikar:

- **Spel** – spelsätt (*Håll*, *Kort ton* med valbar tonlängd, eller *Ligg kvar* där tonen spelar tills nästa ruta) och **formation**: *Rutnät*, *Cirkel* (bollar i ring), *Ring* (en cirkel delad i sektorer med ett tomt hål i mitten där muspekaren kan vila), *Bikupa* eller *Strängar*. Under formationen syns bara de reglage som gäller den: *Mellanrum* mellan rutorna, *Stränglängd* för strängarna, och för ringen *Mellanrum mellan sektorer* (hur tight de ligger) och *Hålets storlek*.
- **Tillgänglighet** – ögonstyrning, kontakt, tangentbord, storlek och kontrast, se nedan.
- **Toner** – antal toner (2–32), grundton, oktav och skala.
- **Ackord** – antal ackord, oktav, bas, avancerat läge (voicing), färger och ackordlistan.
- **Ljud** – presetbiblioteket och alla reglage för ljudmotorn.
- **Ut & MIDI** – ljud och/eller MIDI, MIDI-enhet, kanal och velocity. *Panik* skickar All Notes Off.
- **Mina presets** – se nedan.

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

**Aktivering** (gäller blick, mus och finger)
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
- Tangenterna <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> spelar rutorna 1–10 direkt; håll inne för lång ton.
- *Stegning med en kontakt*: rutorna markeras en i taget i vald takt. <kbd>Mellanslag</kbd>, <kbd>Enter</kbd> eller ett klick/tryck på spelytan spelar den markerade, och stegningen står still medan kontakten hålls in.
- *Två kontakter*: <kbd>Mellanslag</kbd> stegar vidare, <kbd>Enter</kbd> (eller klick) spelar.
- <kbd>Tab</kbd> flyttar mellan rutor och knappar med tydlig fokusram; <kbd>Mellanslag</kbd>/<kbd>Enter</kbd> spelar rutan som har fokus.

**Lås spelytan** – knappen *🔒 Lås* (på Toner och Ackord) gömmer flikar, preset och volym så att bara rutorna syns. Lås upp genom att **hålla inne** knappen i hörnet i två sekunder. Ett vanligt klick, ett klick med ögonstyrning eller en blick räcker inte, så spelaren kan inte råka hamna i inställningarna. Låset finns kvar om sidan laddas om.

Tillgänglighetsinställningarna följer med i *Mina presets*, så varje användare kan ha sitt eget.

Ljud i webbläsare kräver ett riktigt klick eller tangenttryck en gång innan något får låta. Den som bara använder blicken behöver därför hjälp att trycka *Starta* en gång.

## Mina presets

Under *Inställningar → Mina presets* sparar du **hela uppsättningen** under ett eget namn: ljud, ackord, färger, voicing, toner, formation, mellanrum, stränglängd, ringens inställningar och utgångar. Ett klick på *Ladda* ställer tillbaka allt. *Skriv över* uppdaterar ett sparat preset med det du har nu.

Med *Exportera alla till fil* får du en JSON-fil med alla dina presets (bra som backup eller för att flytta dem till en annan dator/telefon); *Importera från fil* läser in dem igen.

## Ljudmotor

Välj ett färdigt **preset** – Elpiano, Varm pad, Supersaw-lead, Pluck, Bas, Klocka, Orgel, Rymd, Chip eller Enkel – eller gå till **Inställningar → Ljudmotor** och skruva själv:

- **Oscillator 1:** åtta vågformer (sinus, triangel, fyrkant, sågtand, puls, varm, orgel, röst), unison upp till 7 röster med detune och stereobredd.
- **Oscillator 2:** blandas in eller frekvensmodulerar osc 1 (FM), transponering, fininställning, brus.
- **Filter:** lågpass/högpass/bandpass med resonans och egen envelope.
- **Volymkurva:** attack, decay, sustain, release.
- **LFO:** vibrato, filter-wah eller tremolo.
- **Effekter:** drive, chorus, delay och reverb.

**Presetbibliotek:** överst under *Inställningar → Ljudmotor* finns 100 färdiga ljud i tio kategorier (klaviatur, pad, lead, bas, pluck, klockor, orgel, stråk & blås, atmosfär, retro & chip). Ett klick laddar in ljudet i *Eget* och provspelar det; presetmenyn visar då t.ex. *Eget: Harpa*. De tio i presetmenyn finns kvar som förut.

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
- `js/sound-library.js` – presetbiblioteket med 100 ljud
- `js/layout.js` – formationerna (cirkel, ring, bikupa, strängar)
- `js/core.js` – grunddata: tonnamn, skalor, ackordtyper, färger, referenser till reglagen
- `js/audio.js` – ljud- och MIDI-utgång
- `js/pads.js` – spela/släppa rutor, mus, ögonstyrning och pekskärm (aktiveringstid, darrtolerans, spärrtid)
- `js/notes.js` – sidan Toner
- `js/chords.js` – sidan Ackord: ackord, voicing, färger, harpa och högerklicksmeny
- `js/sound.js` – ljudreglagen och presetbiblioteket i Inställningar
- `js/view.js` – flikar, underflikar och formationer
- `js/access.js` – tillgänglighet: profiler, synlig pekare, klicka genom att titta, − / + knappar, lås, stegning och tangentbord
- `js/settings.js` – sparade inställningar
- `js/user-presets.js` – Mina presets (spara/ladda/exportera)
- `js/pwa.js` – service worker och Installera-knapp
- `js/main.js` – uppstart
