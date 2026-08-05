# Energy Dashboard App

Desktop-App (Electron) zum Starten deiner Energie-Dashboards mit einem Klick.
**Kein Docker nötig** – die Dienste laufen direkt auf dem Mac.

## Voraussetzungen (macOS)

Alles wird vom Setup-Script automatisch installiert:

- **Homebrew** (Paketverwaltung, Intel + Apple Silicon)
- **Node.js**, **pnpm**, **Git**
- **uv** (Python-Paketmanager)

## Installation auf dem iMac

1. Terminal öffnen (Cmd + Leertaste → "Terminal")
2. Diesen Befehl einfügen und Enter drücken:

```bash
mkdir -p ~/Projects/energy && cd ~/Projects/energy && git clone https://github.com/hachmerb-ui/energy-dashboard-app.git && cd energy-dashboard-app && chmod +x setup-mac.sh && ./setup-mac.sh
```

Das Script klont alle Projekte, installiert die Abhängigkeiten, baut die App und
legt sie im Programme-Ordner ab.

3. **Launchpad** öffnen → **Energy Dashboard** starten

## Benutzung

1. App starten
2. "▶ Starten" beim gewünschten Dashboard klicken (dauert ca. 10 Sekunden)
3. "🌐 Öffnen" öffnet den Browser mit dem Dashboard
4. "■ Stoppen" beendet die Dienste wieder

## Konfiguration

Die App startet im **Demo-Modus** mit Beispieldaten – du kannst sie sofort testen.

Für echte Daten brauchst du keine Datei zu bearbeiten:

1. In der App auf **⚙️ Zugangsdaten** klicken
2. Haken bei **Demo-Modus** entfernen
3. Zugangsdaten eintragen und **Speichern**
4. Projekt neu starten

Die Eingaben landen in der jeweiligen `.env`-Datei im `backend`-Ordner des
Projekts, lesbar nur für deinen Benutzer.

## Entwicklung

```bash
cd energy-dashboard-app
npm install
npm start        # App im Dev-Modus starten (ohne Build)
npm run build    # macOS .app bauen
```
