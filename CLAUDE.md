# Blitzblick – Hinweise für Claude

## Struktur
- `js/` reine ES-Module, kein Build. Logikmodule (`adaptive`, `session`, `rewards`, `stats`, `storage`, `profiles`, `exercises/*` außer render-Funktionen) ohne DOM-Zugriff → `tests/unit/`.
- `js/ui/` Bildschirme, gerendert mit `h()` aus `js/ui/dom.js`. Nutzernamen nie per innerHTML.
- Nur `js/storage.js` greift auf localStorage zu.
- Neue Übungsart: Datei in `js/exercises/` mit dem Vertrag aus dem Plan, in `js/exercises/index.js` registrieren.

## Start/Test
- `npm run serve`, `npm test`, `npm run e2e`.
- `node tools/extract-sprites.mjs all` regenerates `_lokal/extracted/` from `_lokal/source/`; `node tools/build-raster-assets.mjs` downscales it into `assets/`; `node tools/gen-svgs.mjs` regenerates the hand-drawn SVGs.
- Nach jeder Änderung an `index.html`, `manifest.webmanifest`, `js/`, `css/`, `assets/`: `npm run precache` (Unit-Test prüft das).

## Konventionen
- UI-Texte Deutsch, Code/Commits Englisch, Branch `main`.
- Test-Hooks über `data-testid`.
- Repo ist öffentlich: keine persönlichen Daten committen.
