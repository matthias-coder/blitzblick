# Blitzblick

Web-App für Erstklässler: Mengen, Zahlen oder Buchstaben blitzen kurz auf, danach wählt das Kind, was es gesehen hat. Trainiert das schnelle Erfassen auf einen Blick.

- Läuft im Browser auf Tablet und PC, installierbar als App, offline nutzbar.
- Schwierigkeit passt sich automatisch an; Elternbereich (Zahnrad 3 s halten) für Grenzen, bekannte Buchstaben, Profile und Datensicherung.
- Alle Daten bleiben auf dem Gerät (localStorage).

## Entwicklung

    npm install
    npx playwright install chromium
    npm run serve      # http://localhost:4173
    npm test           # Unit-Tests
    npm run e2e        # Playwright

Hinweis: Der Service Worker cached auch auf localhost:4173. Nach Änderungen im Browser hart neu laden bzw. den Service Worker in den DevTools (Application) abmelden.

Design: `docs/superpowers/specs/2026-10-03-blitzblick-design.md`
