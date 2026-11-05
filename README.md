# Hover Pads

En webbsida med rutor som spelar ljud och/eller skickar MIDI när man för musen över dem.

**Prova:** https://johbom.github.io/misk/

## Flikar

I spelläge (**Toner** och **Ackord**) syns bara rutorna, preset och volym. Allt annat finns under fliken **Inställningar**.

- **Toner** – 16 rutor, en ton per ruta. Välj grundton, oktav och skala (dur, moll, pentatonisk, blues, kromatisk). Dra en ljudfil (wav/mp3) till en ruta för att byta dess ljud; högerklicka för att ta bort den.
- **Ackord** – 2 till 8 rutor. **Högerklicka på en ruta/boll** för att byta dess ackord direkt (grundton + typ: dur, moll, 7, maj7, m7, 6, m6, 9, add9, sus2, sus4, dim, dim7, m7b5, aug); inget spelas medan menyn är öppen, och klick utanför eller Esc stänger den. Samma val finns också under Inställningar. Valfri bas en oktav ner. Rutorna visar bara ackordnamnet.
- **Harpa i strängläge** – med formationen *Strängar* spelar en sträng hela ackordet när musen förs över den, precis som förut. **Håll inne musknappen (eller fingret) och dra:** första anslaget på en sträng spelar hela ackordet, och stannar du kvar och rör dig upp eller ner längs strängen går den över i harpläge – ackordets toner knäpps en och en över två oktaver, lägst nertill och högst upptill (t.ex. C E G C E G C). Prickarna på strängen visar var tonerna ligger.
- **Avancerat (voicing)** – kryssa i under *Inställningar → Sidan Ackord* för att välja voicing per ackord: *grundläge*, *1:a/2:a/3:e omvändning* (3:e kräver fyrklang), *öppen* eller *drop 2*, plus *oktavläge* −1/±0/+1. Valen syns både i listan och i högerklicksmenyn (som då också visar tonerna). Slår du av avancerat läge spelas ackorden i grundläge igen, men dina val sparas.

## Inställningar (fliken)

- **Utgång:** ljud i webbläsaren, MIDI, eller båda.
- **Spelsätt:** håll tonen så länge musen är över, eller en kort ton.
- **Formation:** klicka på en av bildknapparna för hur knapparna ska ligga – *Rutnät*, *Cirkel* (bollar i ring), *Bikupa* (bollar i förskjutna rader) eller *Strängar* (långa lodräta strängar). Gäller båda spelflikarna.
- **Mellanrum:** tomrum mellan rutorna (0–160 px), så att musen kan flyttas mellan dem utan att något spelas.
- **MIDI:** välj enhet, kanal och velocity. *Panik* skickar All Notes Off.

Inställningar och ackordval sparas i webbläsaren.

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

## Mobil och iPad

På pekskärmar ryms hela sidan på skärmen och scrollar inte – rutorna krymper för att få plats i alla formationer, stående som liggande. Bara fliken *Inställningar* scrollar inuti sig själv. Lägg gärna sidan på hemskärmen (*Dela → Lägg till på hemskärmen*) så öppnas den i helskärm utan webbläsarlist. På en dator kan samma läge slås på med `?fast` i adressen.

## MIDI

Web MIDI fungerar i Chrome, Edge och Firefox (inte Safari) och kräver https eller localhost.
På Mac kan du skicka till t.ex. Logic/Ableton via en virtuell port: *Ljud-MIDI-konfiguration → MIDI-studio → IAC-drivrutin → "Enheten är online"*.

## Köra lokalt

```bash
python3 -m http.server 8080
```

Öppna sedan http://localhost:8080.

## Filer

- `index.html` – sidan
- `style.css` – utseende
- `layout.js` – formationerna (cirkel, bikupa, strängar)
- `synth.js` – ljudmotorn (Web Audio), reglage och presets
- `presets.js` – presetbiblioteket med 100 ljud
- `app.js` – rutor, hover-logik, MIDI (Web MIDI) och inställningar
