Lokale Notizen und Testdaten. Inhalt außer dieser Datei wird nicht committet.

## Offen für später (1.7.0)

Die Level-Feier nutzt im Repo noch Platzhalter. Echte Bilder so nachziehen:

1. `robot-trophy.jpg` (Roboter mit Pokal) und `medal.jpg` (Medaille) nach `_lokal/source/` legen, jeweils ein Motiv auf weißem Grund.
2. `node tools/extract-sprites.mjs sheets` → `_lokal/extracted/mascot/robot-trophy.png`, `_lokal/extracted/decor/medal.png`
3. `node tools/build-raster-assets.mjs` → `assets/mascot/robot-trophy.webp`, `assets/decor/medal.webp`
4. `npm run precache`, `npm test`

Sechs weitere Stickerbögen (Garten, Bauernhof, Picknick, Bäckerei, Baustelle, Sport; je 4×3, Reihe 3 wiederholt Reihe 2) sind für später vorgesehen und kommen ebenfalls nur nach `_lokal/source/`.
