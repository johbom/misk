# Hover Pads

En webbsida med rutor som spelar ljud och/eller skickar MIDI när man för musen över dem.

**Prova:** https://johbom.github.io/misk/

## Två sidor

- **Toner** – 16 rutor, en ton per ruta. Välj grundton, oktav och skala (dur, moll, pentatonisk, blues, kromatisk). Dra en ljudfil (wav/mp3) till en ruta för att byta dess ljud; högerklicka för att ta bort den.
- **Ackord** – 2 till 8 rutor där du väljer ackord i varje ruta (grundton + typ: dur, moll, 7, maj7, m7, 6, m6, 9, add9, sus2, sus4, dim, dim7, m7b5, aug). Valfri bas en oktav ner.

## Inställningar

- **Utgång:** ljud i webbläsaren, MIDI, eller båda.
- **Spelsätt:** håll tonen så länge musen är över, eller en kort ton.
- **MIDI:** välj enhet, kanal och velocity. *Panik* skickar All Notes Off.

Inställningar och ackordval sparas i webbläsaren.

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
- `app.js` – ljud (Web Audio), MIDI (Web MIDI) och hover-logik
