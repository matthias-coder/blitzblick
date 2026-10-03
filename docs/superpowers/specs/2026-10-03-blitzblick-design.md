# Blitzblick – Design

Datum: 2026-10-03 · Status: zur Prüfung

## Ziel

Web-App für Erstklässler, die die Fähigkeit trainiert, Inhalte in kurzer Zeit zu erfassen ("Blitzlesen/Blitzrechnen"): Ein Inhalt wird kurz eingeblendet, danach wählt das Kind, was es gesehen hat.

**Erfolgskriterien**
- Ein Kind, das noch nicht lesen kann, bedient die App ohne Hilfe (Symbole + Sprachausgabe).
- Die Schwierigkeit passt sich selbstständig an; Eltern können Grenzen und Inhalte festlegen.
- Läuft auf Tablet (Touch) und PC (Maus), installierbar, offline nutzbar.
- Fortschritt und Sammelalbum bleiben über Tage erhalten; Daten verlassen das Gerät nicht.

## Umfang

**Version 1:** Übungsarten Mengen, Zahlen, Buchstaben · Schwierigkeitsanpassung · Elternbereich · mehrere Profile · Sterne + Sammelalbum · Sprachausgabe · Export/Import · PWA auf GitHub Pages.

**Später (nicht in v1):** Silben/Wörter blitzlesen · Blitzrechnen · Synchronisierung über Online-Dienst.

## Rahmenbedingungen

- Reines HTML/CSS/JavaScript (ES-Module), **kein Build-Schritt**, keine Laufzeit-Abhängigkeiten.
- Eigenes **öffentliches** Repo `privat/blitzblick/`, ausgeliefert über GitHub Pages (Branch `main`, Root).
- Bedienung mit Touch und Maus gleichwertig; Hoch- und Querformat.
- Keine personenbezogenen Daten im Repo; alle Nutzerdaten nur in `localStorage` des Geräts.

## Aufbau

```
index.html            Einstieg, lädt js/app.js
manifest.webmanifest  PWA (Name, Icons, display: fullscreen, orientation: any)
sw.js                 Service Worker: Precache aller Dateien → offline
css/app.css
js/
  app.js              Start, Bildschirmwechsel (Profilwahl → Menü → Runde → Album / Eltern)
  storage.js          einzige Schnittstelle zu localStorage, Migration, Export/Import
  profiles.js         Profile anlegen/wählen/löschen, Standard-Einstellungen
  adaptive.js         Schwierigkeitsanpassung (reine Logik, kein DOM)
  session.js          Ablauf einer Runde à 10 Aufgaben, Wertung, Sterne
  speech.js           Sprachausgabe (Web Speech API, de-DE)
  rewards.js          Sterne, Sticker-Vergabe, Seitenfreischaltung
  exercises/
    quantity.js       Mengen
    digits.js         Zahlen
    letters.js        Buchstaben
  ui/                 menu.js, round.js, album.js, parents.js, profiles.js
assets/
  objects/            SVG-Objekte für Mengen (Apfel, Ball, Stern, Fisch, Blume, Auto …)
  stickers/           SVG-Sticker fürs Album, nach Themen
  icons/              App-Icons
tests/unit/           node:test
tests/e2e/            Playwright
```

**Modulgrenzen:** `adaptive.js`, `rewards.js`, `storage.js` und die `createTask`-Funktionen der Übungsarten haben keinen DOM-Zugriff und sind direkt unit-testbar. Nur `storage.js` greift auf `localStorage` zu.

### Schnittstelle der Übungsarten

Jedes Modul in `exercises/` exportiert:

```js
export const id = 'quantity';                 // Schlüssel in settings/levels
export function createTask(level, settings, rng) // → { stimulus, answer, choices[] }
export function renderStimulus(task, el)      // zeichnet den Blitz-Inhalt
export function renderChoices(task, el, onPick) // zeichnet Antwortknöpfe
export function speakPrompt(task)             // Text der Frage, z. B. "Wie viele waren es?"
export function speakSolution(task)           // z. B. "Es waren 6."
```

`rng` ist injizierbar (deterministisch in Tests). Neue Übungsarten werden als weitere Datei ergänzt und in einer Liste in `app.js` registriert.

### Grafik

Eigene, einheitliche SVGs statt Emoji (Emoji sehen je nach System unterschiedlich und teils detailreich aus). Klare Formen, kräftige Farben, kein Text auf Kind-Bildschirmen außer Ziffern/Buchstaben als Lerninhalt.

## Ablauf einer Runde

1. Kind wählt Übungsart über großes Symbol. Ansage: „Pass gut auf!“
2. Fixierpunkt in der Mitte, nach 800 ms der **Blitz**: Inhalt wird für `durationMs` angezeigt.
3. Danach Inhalt sofort weg, 200 ms neutrale Fläche (gegen Nachbild), dann Antwortknöpfe + Ansage der Frage.
4. **Richtig:** Haken, Ton, Stern fliegt in die Leiste. **Falsch:** Inhalt wird mit Lösung erneut gezeigt, Ansage der Lösung; kein Fehlerton, kein Abzug.
5. Nach 10 Aufgaben: Rundenende mit Belohnungsanimation und Sticker-Vergabe.

- Kein Zeitlimit für die Antwort.
- Antwortknöpfe mindestens 64 × 64 px; Eingaben über Pointer Events (Touch und Maus identisch).
- Während des Blitzes sind Eingaben gesperrt.
- Abbruch über Zurück-Knopf jederzeit möglich; abgebrochene Runden zählen nicht in Sterne/Sticker, gegebene Antworten fließen aber in die Schwierigkeitsanpassung ein.

## Übungsarten

### Mengen (`quantity`)
- 1 bis `max` gleiche Objekte; Objekt je Runde zufällig.
- Anordnung: **strukturiert** (Würfelbilder 1–6, Fünfer-/Zehnerfeld 7–10), **zufällig** (verstreut, ohne Überlappung, Mindestabstand) oder **gemischt** (Standard; Anteil zufälliger Anordnungen steigt mit der Komplexitätsstufe).
- Antwort: Knöpfe 1 bis `max`, jeweils Ziffer mit kleinem Punktmuster.

### Zahlen (`digits`)
- Zahlenraum einstellbar: 0–9, 0–10, 0–20.
- Antwort: 4 Optionen inkl. ähnlicher Ablenker (Spiegel-/Verwechslungspaare: 6/9, 1/7, 3/8, 2/5; Zahlendreher 12/21 usw.), sonst benachbarte Zahlen.

### Buchstaben (`letters`)
- Nur Buchstaben aus `settings.letters.known`; Schreibweise groß / klein / beide.
- Antwort: 4 Optionen; Ablenker bevorzugt aus Verwechslungsgruppen (b/d/p/q, M/N/W, E/F, n/u/h, i/l), **nur aus bekannten Buchstaben**. Sind weniger als 4 bekannt, entsprechend weniger Optionen, mindestens 2. Mit weniger als 2 bekannten Buchstaben ist die Übungsart im Menü ausgeblendet.
- Sprachausgabe als **Laut** („mmm“) oder **Name** („em“), einstellbar (Standard: Laut). Laut-Texte werden pro Buchstabe in einer Tabelle gepflegt.

## Schwierigkeitsanpassung (`adaptive.js`)

Getrennt je Profil und Übungsart. Zustand: `{ durationMs, complexity, streak, recent }` (`recent` = letzte 3 Ergebnisse).

- **Schwerer:** nach 3 richtigen in Folge.
- **Leichter:** bei 2 Fehlern in den letzten 3 Aufgaben.
- Nach jeder Anpassung werden `streak` und `recent` zurückgesetzt.
- **Schwerer:** `durationMs × 0,85` (gerundet auf 50 ms), mindestens `minMs`. Ist `minMs` bereits erreicht → `complexity + 1` (bis Maximum) und `durationMs` auf `min(maxMs, minMs × 2)`.
- **Leichter:** `durationMs × 1,2`, höchstens `maxMs`. Ist `maxMs` bereits erreicht → `complexity − 1` (bis 0) und `durationMs` auf `maxMs / 2`.
- Nie werden Dauer und Komplexität im selben Schritt beide schwerer.
- Ist „automatisch anpassen“ aus, gilt fest `startMs` und die eingestellte Komplexität.

**Komplexitätsstufen**
| Übungsart | Stufen |
|---|---|
| Mengen | max 3 → 4 → 5 → 6 → 8 → 10 (begrenzt durch `quantity.max`), jeweils erst strukturiert, dann gemischt |
| Zahlen | 0–5 → 0–9 → 0–10 → 0–20 (begrenzt durch eingestellten Zahlenraum) |
| Buchstaben | nur Großbuchstaben → nur Kleinbuchstaben → beide (begrenzt durch eingestellte Schreibweise) |

**Standardwerte:** `startMs` 1500, `minMs` 300, `maxMs` 3000; Mengen starten bei Komplexität „max 5, strukturiert“, Höchstwert 10.

## Elternbereich

- **Zugang:** Zahnrad 3 s gedrückt halten → Rechenaufgabe aus dem kleinen Einmaleins (Zahleneingabe). Falsche Antwort → zurück.
- **Profile:** anlegen, umbenennen, Tier-Avatar wählen, löschen (mit Bestätigung).
- **Einstellungen je Profil:**
  - Übungsarten an/aus
  - Anzeigedauer: Start, Unter-, Obergrenze; automatisch anpassen an/aus
  - Mengen: Höchstwert (3–10), Anordnung (strukturiert / zufällig / gemischt)
  - Zahlen: Zahlenraum
  - Buchstaben: Raster A–Z, Ä, Ö, Ü, ß zum Anhaken; Schreibweise; Laut oder Name
  - Sprachausgabe an/aus, Töne an/aus
  - Stufen zurücksetzen
- **Fortschritt:** je Übungsart aktuelle Stufe und Anzeigedauer, Trefferquote der letzten 7 Tage, Runden pro Tag, häufigste Buchstaben-/Zahlenverwechslungen.
- **Datensicherung:** Export aller Daten als `blitzblick-backup-YYYY-MM-DD.json`; Import mit Prüfung und Rückfrage.
- **Hinweise:** fehlende Speichermöglichkeit, fehlende deutsche Stimme.

## Sammelalbum (`rewards.js`)

- 1 Stern je richtiger Antwort.
- Jede **abgeschlossene** Runde → 1 neuer Sticker aus den freigeschalteten Seiten, keine Duplikate, solange auf freigeschalteten Seiten noch Sticker fehlen. Sind alle freigeschalteten Sticker gesammelt, gibt es statt eines Stickers 3 Bonussterne.
- Seiten nach Themen à 8 Sticker. v1: Tiere, Fahrzeuge, Weltraum, Meer, Dinos (40 Sticker).
- Seite 1 ist frei; jede weitere Seite wird bei je 50 weiteren gesammelten Sternen freigeschaltet (Seite 2 bei 50, Seite 3 bei 100 …). Freischaltung mit Animation.
- Keine Serien/Streaks, keine Strafen für Pausen.
- Album-Inhalte sind Daten (`assets/stickers/` + Liste in `rewards.js`), neue Seiten ohne Code-Änderung an der Logik ergänzbar.

## Datenmodell

Ein `localStorage`-Schlüssel `blitzblick.v1`:

```js
{
  schemaVersion: 1,
  activeProfileId: "p_…",
  profiles: [{
    id, name, avatar, createdAt,
    settings: {
      exercises: { quantity: true, digits: true, letters: true },
      timing:    { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: true },
      quantity:  { max: 10, layout: "mixed" },
      digits:    { range: 9 },                      // 9 | 10 | 20
      letters:   { known: ["A","M","O"], case: "upper", speak: "sound" },
      speech: true, sounds: true
    },
    levels: {
      quantity: { durationMs, complexity, streak, recent: [] },
      digits:   { … }, letters: { … }
    },
    rewards: { stars: 0, stickers: [], unlockedPages: 1 },
    history: [{ date: "2026-10-03", exercise, correct, total, confusions: { "b>d": 2 } }]
  }]
}
```

- `history`: ein Eintrag je abgeschlossener Runde, Einträge älter als 90 Tage werden beim Speichern entfernt.
- `storage.js` migriert beim Laden und beim Import anhand von `schemaVersion`.
- Export/Import nutzt dasselbe Format; die Schnittstelle (`load()`, `save(state)`, `exportFile()`, `importFile(file)`) bleibt für eine spätere Sync-Variante gleich.

## Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| `localStorage` nicht verfügbar / voll | App läuft mit Zustand im Speicher; Hinweis im Elternbereich |
| Gespeicherte Daten beschädigt | Rohdaten unter `blitzblick.corrupt-<zeit>` sichern, frisch starten, Hinweis im Elternbereich |
| Keine deutsche Stimme | Stumm weiterlaufen; Hinweis im Elternbereich |
| Import ungültig (kein JSON, falsches Schema, neuere `schemaVersion`) | Ablehnen mit verständlicher Meldung, bestehender Stand unverändert |
| Import gültig | Vor dem Überschreiben automatische Sicherung `blitzblick.pre-import` |
| Neue App-Version | Service Worker lädt im Hintergrund, aktiviert beim nächsten Start; nie während einer Runde |

## Tests

**Unit (`node --test tests/unit/`)**
- `adaptive`: Schwellen (3 richtig / 2 von 3 falsch), Faktoren und Rundung, Grenzen, Komplexitätswechsel, nie beides gleichzeitig schwerer, „automatisch aus“.
- `exercises/*.createTask`: richtige Antwort immer unter den Optionen, keine doppelten Optionen, Optionen im erlaubten Bereich, Buchstaben-Ablenker nur aus bekannten, Mindestzahl Optionen.
- `quantity`-Anordnung: kein Überlappen, korrekte Anzahl.
- `rewards`: keine Duplikate, Bonussterne bei voller Sammlung, Seitenfreischaltung bei 50/100/….
- `storage`: Rundlauf Export→Import, Ablehnung ungültiger Dateien, Migration, `history`-Kürzung.

**E2E (Playwright, Projekte „Desktop Chrome“ und „iPad“)**
- Profil anlegen → Mengen-Runde komplett spielen (Blitz verschwindet nach eingestellter Zeit, Antwort, Sterne, Sticker).
- Elternbereich: Zugangssperre, Buchstaben anhaken → nur diese werden abgefragt.
- Export und Import.
- Offline-Start nach erstem Laden (Service Worker).

## Repo-Konventionen

Wie die übrigen Repos: `README.md` (deutsch), `CLAUDE.md` (Struktur, Start, Konventionen), `CHANGELOG.md`, `.gitignore`, `package.json` (nur Dev-Abhängigkeit Playwright, Skripte `test:unit`, `test:e2e`), `playwright.config.js` mit statischem Server über `npx http-server` (nicht `python3`, unter Windows nicht verfügbar). Branch `main`, Commits auf Englisch.
