# Hover Pads

En webbsida med rutor som spelar ljud och/eller skickar MIDI när man för musen över dem.

**Prova:** https://johbom.github.io/misk/

## Två sidor

- **Toner** – 16 rutor, en ton per ruta. Välj grundton, oktav och skala (dur, moll, pentatonisk, blues, kromatisk). Dra en ljudfil (wav/mp3) till en ruta för att byta dess ljud; högerklicka för att ta bort den.
- **Ackord** – 2 till 8 rutor där du väljer ackord i varje ruta (grundton + typ: dur, moll, 7, maj7, m7, 6, m6, 9, add9, sus2, sus4, dim, dim7, m7b5, aug). Valfri bas en oktav ner.

## Inställningar

- **Utgång:** ljud i webbläsaren, MIDI, eller båda.
- **Spelsätt:** håll tonen så länge musen är över, eller en kort ton.
- **Mellanrum:** tomrum mellan rutorna (0–160 px), så att musen kan flyttas mellan dem utan att något spelas.
- **MIDI:** välj enhet, kanal och velocity. *Panik* skickar All Notes Off.

Inställningar och ackordval sparas i webbläsaren.

## Ljudmotor

Välj ett färdigt **preset** – Elpiano, Varm pad, Supersaw-lead, Pluck, Bas, Klocka, Orgel, Rymd, Chip eller Enkel – eller öppna **Ljudmotor ▸** och skruva själv:

- **Oscillator 1:** åtta vågformer (sinus, triangel, fyrkant, sågtand, puls, varm, orgel, röst), unison upp till 7 röster med detune och stereobredd.
- **Oscillator 2:** blandas in eller frekvensmodulerar osc 1 (FM), transponering, fininställning, brus.
- **Filter:** lågpass/högpass/bandpass med resonans och egen envelope.
- **Volymkurva:** attack, decay, sustain, release.
- **LFO:** vibrato, filter-wah eller tremolo.
- **Effekter:** drive, chorus, delay och reverb.

Ändrar du ett reglage blir ljudet *Eget (ändrat)*. *Återställ preset* går tillbaka, *Slumpa ljud* hittar på något nytt.
Uppladdade ljudfiler går också genom effekterna.

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
- `synth.js` – ljudmotorn (Web Audio), reglage och presets
- `app.js` – rutor, hover-logik, MIDI (Web MIDI) och inställningar
