# Energy Dashboard App

Desktop-App (Electron) zum Starten deiner Energie-Dashboards mit einem Klick.

## Voraussetzungen (macOS)

- **Docker Desktop** (wird automatisch installiert)
- **Node.js** (wird automatisch installiert)
- **Git** (wird automatisch installiert)

## Installation auf dem iMac

1. Terminal öffnen (Cmd + Leertaste → "Terminal")
2. Dieses Script ausführen:

```bash
curl -fsSL https://raw.githubusercontent.com/hachmerb-ui/energy-dashboard-app/main/setup-mac.sh | bash
```

3. .env-Dateien eintragen (siehe unten)
4. App starten: Doppelklick auf die `.app` in `~/Projects/energy/energy-dashboard-app/dist/`

## .env-Dateien

Du musst die API-Keys manuell in folgende Dateien eintragen:

### AlphaESS
- `~/Projects/energy/alphaess/backend/.env`
- `~/Projects/energy/alphaess/bff/.env`  
- `~/Projects/energy/alphaess/frontend/.env`

### Zappi
- `~/Projects/energy/zappi-dashboard/backend/.env`

## Benutzung

1. App starten
2. "▶ Starten" klicken beim gewünschten Dashboard
3. "🌐 Öffnen" klickt, öffnet den Browser mit dem Dashboard
4. "■ Stoppen" beendet die Container wieder

## Entwicklung

```bash
cd energy-dashboard-app
npm install
npm start        # App im Dev-Modus starten
npm run build    # macOS .app bauen
```
