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

- **Spel** – spelsätt (håll tonen eller kort ton) och **formation**: *Rutnät*, *Cirkel* (bollar i ring), *Ring* (en cirkel delad i sektorer med ett tomt hål i mitten där muspekaren kan vila), *Bikupa* eller *Strängar*. Under formationen syns bara de reglage som gäller den: *Mellanrum* mellan rutorna, *Stränglängd* för strängarna, och för ringen *Mellanrum mellan sektorer* (hur tight de ligger) och *Hålets storlek*.
- **Toner** – antal toner (2–32), grundton, oktav och skala.
- **Ackord** – antal ackord, oktav, bas, avancerat läge (voicing), färger och ackordlistan.
- **Ljud** – presetbiblioteket och alla reglage för ljudmotorn.
- **Ut & MIDI** – ljud och/eller MIDI, MIDI-enhet, kanal och velocity. *Panik* skickar All Notes Off.
- **Mina presets** – se nedan.

Allt sparas i webbläsaren.

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
- Nya versioner hämtas i bakgrunden och används nästa gång appen startas.

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
- `manifest.webmanifest`, `sw.js` – PWA: appinformation och offline-cache (höj `VERSION` i `sw.js` när filistan ändras)
- `css/style.css` – utseende
- `icons/` – appikoner (skapas med `python3 tools/make_icons.py icons`)
- `js/synth.js` – ljudmotorn (Web Audio), reglagen och de tio snabbpreseten
- `js/sound-library.js` – presetbiblioteket med 100 ljud
- `js/layout.js` – formationerna (cirkel, ring, bikupa, strängar)
- `js/core.js` – grunddata: tonnamn, skalor, ackordtyper, färger, referenser till reglagen
- `js/audio.js` – ljud- och MIDI-utgång
- `js/pads.js` – spela/släppa rutor, mus och pekskärm
- `js/notes.js` – sidan Toner
- `js/chords.js` – sidan Ackord: ackord, voicing, färger, harpa och högerklicksmeny
- `js/sound.js` – ljudreglagen och presetbiblioteket i Inställningar
- `js/view.js` – flikar, underflikar och formationer
- `js/settings.js` – sparade inställningar
- `js/user-presets.js` – Mina presets (spara/ladda/exportera)
- `js/pwa.js` – service worker och Installera-knapp
- `js/main.js` – uppstart
