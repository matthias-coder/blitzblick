# Blitzblick – Übung „Silben & Wörter“

Datum: 2026-10-04 · Status: zur Prüfung · Zielversion: 1.2.0

## Ziel

Nächster Schritt nach den Einzelbuchstaben: Das Kind liest kurz eingeblendete Silben und kurze Wörter, die ausschließlich aus Buchstaben bestehen, die es schon kennt (`settings.letters.known`). Danach wählt es aus 4 geschriebenen Antworten die richtige.

**Erfolgskriterien**
- Es erscheinen nur Silben/Wörter aus bekannten Buchstaben.
- Groß-/Kleinschreibung ist immer korrekt (`Ella`, `Lea`, `Ma` – nie `ELLA` oder `ella`).
- Eltern können eigene Wörter (Familiennamen, Haustier …) ergänzen.
- Die Silbenstruktur ist sichtbar (farbig), abschaltbar.
- Fügt sich ohne Sonderwege in Runde, Anpassung, Belohnung, Statistik und Backup ein.

**Nicht im Umfang:** Bild-Auswahl, Hör-Aufgaben, aufgenommene Sprache, Sätze.

## Inhalt

Der Vorrat (Pool) setzt sich zusammen aus:

1. **Erzeugte Silben:** bekannter Konsonant + bekannter Vokal (`Ma`, `Lo`, `Mi`) sowie Vokal + Konsonant (`Am`, `Om`). Vokale: A E I O U Ä Ö Ü. Anzeige: erster Buchstabe groß, Rest klein. Mit `ß` werden keine Silben erzeugt; `ß` kommt nur in Wörtern vor.
2. **Eingebaute Wortliste** (`js/exercises/words.js`): 80–120 einfache Wörter und Namen in korrekter Schreibung mit gespeicherter Silbentrennung, z. B. `Ma|ma`, `O|ma`, `O|pa`, `La|ma`, `El|la`, `Le|a`, `Mi|a`, `O|le`, `E|mil`, `Ni|na`, `So|fa`, `Ho|se`, `Ba|na|ne`. Keine Wörter, die für Kinder unpassend sind.
3. **Eigene Wörter** aus `settings.syllables.custom`.

Ein Eintrag ist spielbar, wenn jeder seiner Buchstaben (Vergleich ohne Groß-/Kleinschreibung) in `letters.known` enthalten ist.

## Stufen (complexity)

| Stufe | Inhalt | Beispiele |
|---|---|---|
| 0 | einzelne Silben | `Ma`, `Lo`, `Om` |
| 1 | Wörter aus 2 offenen Silben (jede Silbe endet auf Vokal) | `Ma\|ma`, `O\|ma`, `Le\|a` |
| 2 | alle Wörter | `El\|la`, `E\|mil`, `Ba\|na\|ne` |

- Stufe eines Wortes wird aus seiner Trennung berechnet (gilt auch für eigene Wörter).
- `maxComplexity` = höchste Stufe, die mindestens 1 spielbaren Eintrag hat (mind. 0). Hat die aktuelle Stufe weniger als 3 Einträge, zieht `createTask` mit 50 % Wahrscheinlichkeit aus der nächstniedrigeren Stufe, damit nicht ständig dasselbe Wort kommt. Beispiel Standardprofil (A, M, O): Stufe 0 `Ma`, `Mo`, `Am`, `Om`; Stufe 1 `Mama`, `Oma`.
- Die Anpassung (Dauer, Stufenwechsel) läuft unverändert über `js/adaptive.js`.

## Aufgabe und Ablenker

`createTask` wählt einen spielbaren Eintrag der aktuellen Stufe (bevorzugt nicht denselben wie zuletzt) und erzeugt 3 Ablenker in dieser Reihenfolge, bis 3 verschiedene vorhanden sind:

1. **Vertauschung:** zwei benachbarte Buchstaben getauscht (`Lea` → `Ela`), Schreibung danach neu normalisiert (erster Buchstabe groß, Rest klein).
2. **Ersetzung:** ein Buchstabe durch einen ähnlich aussehenden *bekannten* Buchstaben ersetzt (Gruppen wie in `letters.js`, z. B. M/N/W, b/d/p/q, n/u/h/m), sonst durch einen beliebigen bekannten Buchstaben derselben Art (Vokal ↔ Vokal, Konsonant ↔ Konsonant).
3. **Ähnliche Einträge** aus dem spielbaren Pool (gleiche Länge bevorzugt).

Regeln: Ablenker bestehen nur aus bekannten Buchstaben, sind untereinander und von der Lösung verschieden (Vergleich exakt) und dürfen Fantasiewörter sein. Die Reihenfolge der 4 Antworten wird gemischt (`buildChoices`-Muster).

Aufgabenobjekt (Vertrag wie die anderen Übungen):
```js
{ exercise: 'syllables', stimulus: { text: 'Ella', parts: ['El', 'la'] }, answer: 'Ella', choices: [...], parts: { Ella: ['El','la'], Ela: ['E','la'], ... } }
```

## Silbentrennung

- Echte Wörter (Liste, eigene mit `|`): gespeicherte Trennung hat Vorrang.
- Sonst Regeltrennung `syllabify(text)`:
  - ein Konsonant zwischen zwei Vokalen gehört zur nächsten Silbe (`O|ma`, `E|la`),
  - zwei Konsonanten zwischen Vokalen werden geteilt (`El|la`, `Hun|de`),
  - zwei aufeinanderfolgende Vokale werden getrennt, außer bei den Zwielauten `ei`, `au`, `eu`, `äu`, `ie` (`Le|a`, `Mai`),
  - `ch`, `sch`, `ck` werden nicht zerrissen.
- Ziel ist kindgerechte Lesehilfe, nicht Duden-Vollständigkeit; Abweichungen bei eigenen Wörtern korrigieren Eltern per `|`.

## Anzeige

- Blitz: Text groß in Andika; Silben abwechselnd blau/rot (CSS-Klassen `syl-a`, `syl-b`, Farben als Tokens mit ausreichendem Kontrast in hellem und dunklem Modus). Schriftgröße passt sich an die Länge an, sodass das Wort auch auf Handybreite in eine Zeile passt.
- Antwort-Buttons: identisch eingefärbt; alle 4 Antworten werden mit derselben Logik getrennt (gespeicherte Trennung wenn echtes Wort, sonst Regel), damit die Färbung die Lösung nicht verrät.
- Ist `settings.syllables.colors` aus: einfarbig, keine Trennung sichtbar.
- Rendering über `h()`; Texte nie per innerHTML (eigene Wörter sind Nutzereingaben).

## Sprache

Modi wie bisher (aus / wenig / viel):
- Frage: Stufe 0 „Welche Silbe war das?“, sonst „Welches Wort war das?“
- Lösung: „Das war *Ella*.“ (mit Varianten wie bei Buchstaben). Im Modus „viel“ zusätzlich zuerst silbisch: „El – la. Ella.“
- Ablenker werden nie gesprochen.

## Elternbereich

Neuer Abschnitt „Silben & Wörter“ unter „Buchstaben“ in `js/ui/parents.js`:
- Übungsart erscheint automatisch in „Übungsarten“ (über `EXERCISE_ORDER`).
- Schalter „Silben farbig zeigen“ (`data-testid="syllables-colors"`).
- Eigene Wörter: Eingabefeld + „Hinzufügen“ (`syllables-custom-input`, `syllables-custom-add`); `|` optional als Silbentrenner. Liste als Chips mit Löschen (`syllables-custom-<index>-remove`). Hinweis je Wort, falls nicht spielbar: „noch nicht spielbar – fehlt: R, T“.
- Validierung: nur Buchstaben aus `LETTERS` (beliebige Groß-/Kleinschreibung) plus `|`; 2–12 Buchstaben; höchstens 50 Wörter; Duplikate (ohne Groß-/Kleinschreibung) abgelehnt. Fehlermeldung inline. Schreibung wird so gespeichert, wie eingegeben.
- Anzeige „Spielbar gerade: X Silben, Y Wörter“.

## Daten

- Neue Übungs-ID `syllables`, Titel „Silben & Wörter“, Reihenfolge nach `letters`.
- Standard-Einstellungen: `exercises.syllables: true`, `syllables: { colors: true, custom: [] }`.
- `custom`-Einträge: `{ text: 'Ella', split: 'El|la' }` (`split` mit `|`, Buchstaben ohne `|` müssen exakt `text` ergeben).
- `normalizeSettings` in `js/profiles.js` ergänzt Standardwerte für bestehende Profile und verwirft ungültige `custom`-Einträge (gleiche Regeln wie die Eingabe); greift damit auch beim Import.
- `isAvailable(settings)`: mindestens 4 spielbare Einträge. Nicht verfügbare Übung wird im Menü wie bisher behandelt.
- Statistik/Verwechslungen, Level, Belohnung: unverändert über `session.js`.

## Dateien

- neu `js/exercises/syllables.js` – Übung (Vertrag aus dem Plan, render-Funktionen am Ende).
- neu `js/exercises/words.js` – Wortliste, `syllabify`, Pool-Aufbau, Stufenberechnung; ohne DOM.
- `js/exercises/index.js` – Registrierung.
- `js/profiles.js` – Standardwerte und Normalisierung.
- `js/ui/parents.js` – Abschnitt Elternbereich.
- `css/` – Silbenfarben, Längenanpassung.
- `package.json`, `CHANGELOG.md`, `UEBERSICHT.md` – Version 1.2.0; danach `npm run precache`.

## Tests

Unit (`tests/unit/`):
- `words.test.js`: `syllabify`-Fälle (O|ma, El|la, Le|a, Mai, Ba|na|ne, Ta|sche), Stufenberechnung, Pool-Filter nach bekannten Buchstaben inkl. Groß-/Kleinschreibung und Umlauten, gespeicherte Trennung hat Vorrang.
- `syllables.test.js`: `isAvailable`-Grenzen, `maxComplexity` bei dünnen Stufen, `createTask` über viele Seeds: genau 4 verschiedene Antworten, Lösung enthalten, alle nur aus bekannten Buchstaben, korrekte Schreibung; Sprachtexte je Stufe/Modus.
- `profiles.test.js`: Standardwerte für Alt-Profile, Verwerfen ungültiger eigener Wörter, Import.

E2E (`tests/e2e/`):
- Runde „Silben & Wörter“ mit Standardprofil (A, M, O) spielen bis Rundenende.
- Eigenes Wort im Elternbereich anlegen (mit bekannten Buchstaben) und Farb-Schalter umstellen; Einstellung bleibt nach Neuladen erhalten.
